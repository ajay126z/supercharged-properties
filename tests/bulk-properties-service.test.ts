// @vitest-environment jsdom
import {it,expect,vi} from 'vitest';
import {load,dump,JSON_SCHEMA} from 'js-yaml';
vi.mock('obsidian',()=>({TFile:class{}}));
import {ValueEditor} from '../src/value-editor';
import {BulkPropertiesService} from '../src/bulk-properties-service';
const request={rows:[{id:'r',key:'rating',type:'number' as const,value:'4'}],exists:'skip' as const,delimiter:','};
function setup(){
 const disk=new Map(['Recipes/r1.md','Recipes/r2.md','Work/t1.md'].map(path=>[path,'---\nstatus: wip\n---\nBody\n']));
 const parse=(path:string)=>load(disk.get(path)!.split('---\n')[1],{schema:JSON_SCHEMA}) as any;
 const editor=new ValueEditor({} as any);let hook:undefined|((path:string,fm:any)=>void);let excluded='';
 const host={eligible:(path:string)=>disk.has(path)&&path!==excluded,configuredType:()=>undefined,frontmatter:parse,process:vi.fn(async(path:string,update:any)=>{const fm=parse(path);hook?.(path,fm);update(fm);disk.set(path,'---\n'+dump(fm)+'---\nBody\n');})};
 return {disk,parse,editor,host,service:new BulkPropertiesService(host,editor),hook:(fn:any)=>{hook=fn},exclude:(path:string)=>{excluded=path}};
}
it('writes and undoes folder-scoped notes leaving outside bytes unchanged, including whole-key removal',async()=>{
 const {disk,parse,editor,service}=setup(),original=new Map(disk),paths=['Recipes/r1.md','Recipes/r2.md'];
 expect((await service.apply(service.preview(paths,request))).filter(n=>n.changes.length)).toHaveLength(2);expect(parse(paths[0]).rating).toBe(4);expect(disk.get('Work/t1.md')).toBe(original.get('Work/t1.md'));expect((await editor.undo()).restored).toBe(2);expect(disk).toEqual(original);
 await service.apply(service.preview(paths,{keys:['status']}));expect(parse(paths[0]).status).toBeUndefined();await editor.undo();expect(disk).toEqual(original);
 expect((await service.apply(service.preview([...disk.keys()],request))).filter(n=>n.changes.length)).toHaveLength(3);
});
it('checks drift per key inside the callback and preserves unrelated frontmatter',async()=>{
 const {parse,service,hook}=setup();const path='Recipes/r1.md',plan=service.preview([path],request);hook((p,fm)=>{fm.rating=5;});expect((await service.apply(plan))[0].skipped[0].reason).toBe('changed-since-preview');expect(parse(path).rating).toBeUndefined();
 hook((p,fm)=>{fm.unrelated='keep';});await service.apply(service.preview([path],request));expect(parse(path)).toEqual({status:'wip',rating:4,unrelated:'keep'});
});
it('retains conflicts for retry and keeps the previous snapshot after no writes',async()=>{
 const {disk,editor,service,parse}=setup(),path='Recipes/r1.md';await service.apply(service.preview([path],request));
 await service.apply(service.preview([path],request));disk.set(path,disk.get(path)!.replace('rating: 4','rating: 9'));
 expect((await editor.undo()).skipped).toBe(1);expect(editor.canUndo()).toBe(true);disk.set(path,disk.get(path)!.replace('rating: 9','rating: 4'));expect((await editor.undo()).restored).toBe(1);expect(parse(path).rating).toBeUndefined();expect(editor.canUndo()).toBe(false);
});
it('continues after a failed note, guards concurrent edits, and rechecks exclusions',async()=>{
 const {host,editor,service,exclude}=setup();const plan=service.preview(['Recipes/r1.md','Recipes/r2.md'],request);host.process.mockRejectedValueOnce(new Error('invalid YAML'));const result=await service.apply(plan);expect(result[0].error).toContain('invalid YAML');expect(result[1].changes).toHaveLength(1);
 await editor.runExclusive(async()=>{await expect(service.apply(plan)).rejects.toThrow('running');});
 const next=service.preview(['Recipes/r1.md'],request);exclude('Recipes/r1.md');expect((await service.apply(next))[0].skipped[0].reason).toContain('excluded');
});
it('replaces the shared undo slot and retains ordinary external undo behavior',async()=>{
 const {editor,service}=setup();const prior=vi.fn(async()=>({restored:1,skipped:0,failures:[]}));editor.rememberUndo(prior);await service.apply(service.preview(['Recipes/r1.md'],request));await editor.undo();expect(prior).not.toHaveBeenCalled();
 const conversion=vi.fn(async()=>({restored:1,skipped:0,failures:[]}));await service.apply(service.preview(['Recipes/r1.md'],request));editor.rememberUndo(conversion);await editor.undo();expect(conversion).toHaveBeenCalledOnce();
});
it('reports progress and yields in larger batches while restoring typed snapshots',async()=>{
 const {disk,service,editor,host}=setup();for(let i=0;i<53;i++)disk.set(`Batch/${i}.md`,'---\nstatus: wip\n---\nBody\n');const paths=[...disk.keys()].filter(p=>p.startsWith('Batch/'));const progress=vi.fn();await service.apply(service.preview(paths,request),progress);expect(progress).toHaveBeenLastCalledWith(53,53);expect(progress).toHaveBeenCalledTimes(53);expect(host.process).toHaveBeenCalledTimes(53);expect((await editor.undo()).restored).toBe(53);
});
it('skips a changed configured type and a newly ambiguous key without touching other keys',async()=>{
 const {service,host,hook}=setup();const path='Recipes/r1.md';const plan=service.preview([path],request);host.configuredType=()=> 'text' as any;expect((await service.apply(plan))[0].skipped[0].reason).toBe('changed-since-preview');
 host.configuredType=()=>undefined;hook((p,fm)=>{fm.Rating=2;fm.rating=3;});const next=service.preview([path],request);expect((await service.apply(next))[0].skipped[0].reason).toBe('ambiguous-key');
});
