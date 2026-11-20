import {expect, it, vi} from 'vitest';
import {load, dump} from 'js-yaml';
vi.mock('obsidian', () => ({
  TFile: class {},
  parseYaml: (text:string) => load(text),
  getFrontMatterInfo: (text:string) => {
    const match = /^\uFEFF?---[^\S\r\n]*\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[^\S\r\n]*(?:\r?\n|$)/.exec(text);
    return match ? {exists:true,frontmatter:match[1],contentStart:match[0].length} : {exists:false,frontmatter:'',contentStart:0};
  }
}));
import {getFrontMatterInfo, parseYaml} from 'obsidian';
import {InlineConverter, planConversion, type ConversionOptions} from '../src/inline-conversion';
import {ValueEditor} from '../src/value-editor';
import {InlineEditor} from '../src/inline-editor';
const options:ConversionOptions={property:'author',move:true,detect:false,conflict:'skip'};
function setup(initial:Record<string,string>={'A.md':'author:: AJ\n','Outside.md':'author:: AJ\n','Templates/T.md':'author:: AJ\n'}) {
  const disk=new Map(Object.entries(initial));const files=new Map([...disk.keys()].map(path=>[path,{path}]));
  const app:any={vault:{getFileByPath:(path:string)=>files.get(path),read:vi.fn(async(file:any)=>disk.get(file.path)),process:vi.fn(async(file:any,fn:any)=>{disk.set(file.path,fn(disk.get(file.path)));})},fileManager:{processFrontMatter:vi.fn(async(file:any,fn:any)=>{
    const text=disk.get(file.path)!,info=getFrontMatterInfo(text),fm=info.exists?(parseYaml(info.frontmatter)??{}):{};
    fn(fm);disk.set(file.path,`---\n${dump(fm)}---\n${text.slice(info.contentStart)}`);
  })}};
  const includes=(path:string)=>!path.startsWith('Templates/');const editor=new ValueEditor(app,includes);
  return {disk,app,editor,converter:new InlineConverter(app,editor,includes)};
}
it('keeps literal text and repeated fields, and excludes code/comments/nested code continuations',()=>{
 const source='author:: 004\n[author:: [[AJ]]]\n```\nauthor:: code\n```\n%% author:: comment %%\n- parent\n      author:: nested code\n';
 const change=planConversion(source,options,'A.md');expect(change.replacement).toEqual(['004','[[AJ]]']);
 expect(change.afterBody).toContain('author:: code');expect(change.afterBody).toContain('author:: comment');expect(change.afterBody).toContain('author:: nested code');expect(change.afterBody).not.toContain('004');expect(change.removed).toEqual(['author:: 004\n','[author:: [[AJ]]]']);
});
it('copies with Keep, detects numbers/booleans, and preserves ISO dates and literal links',()=>{
 const text='author:: 004\nauthor:: true\nauthor:: 2026-11-20\nauthor:: [[AJ]]\n';
 const change=planConversion(text,{...options,move:false,detect:true},'A');
 expect(change.replacement).toEqual([4,true,'2026-11-20','[[AJ]]']);expect(change.afterBody).toBe(text);expect(change.removed).toEqual([]);
});
it('rejects ambiguous folded keys, special keys and malformed YAML',()=>{
 for(const source of ['author:: AJ\nAuthor:: B','---\nAuthor: old\n---\nauthor:: AJ','---\nauthor: old\nAuthor: other\n---\nauthor:: AJ','---\nauthor: old\nauthor: duplicate\n---\nauthor:: AJ','---\n- list\n---\nauthor:: AJ','---\nauthor: unclosed'])expect(()=>planConversion(source,{...options,conflict:'overwrite'},'A')).toThrow();
 for(const property of ['position','Tags','aliases','cssclasses'])expect(()=>planConversion(`${property}:: text`,{...options,property},'A')).toThrow();
});
it('skips existing YAML by default and supports merge and overwrite',()=>{
 const source='---\nauthor: [Previous, AJ]\nother: keep\n---\nauthor:: AJ\nauthor:: New\n';
 expect(()=>planConversion(source,options,'A')).toThrow('already exists');
 expect(planConversion(source,{...options,conflict:'merge'},'A').replacement).toEqual(['Previous','AJ','New']);
 expect(planConversion(source,{...options,conflict:'overwrite'},'A').replacement).toEqual(['AJ','New']);
});
it('previews without writes, applies only selected filtered paths, and undoes both body and YAML',async()=>{
 const {disk,app,editor,converter}=setup();const original=new Map(disk);
 const plan=await converter.preview(options,['A.md','A.md','Templates/T.md']);expect(plan.changes).toHaveLength(1);expect(plan.skipped).toHaveLength(1);expect(app.vault.process).not.toHaveBeenCalled();expect(app.fileManager.processFrontMatter).not.toHaveBeenCalled();
 expect((await converter.apply(plan)).updated).toBe(1);expect(disk.get('A.md')).toContain('author: AJ');expect(disk.get('A.md')).not.toContain('author::');expect(app.vault.process).toHaveBeenCalledTimes(1);
 expect(disk.get('Outside.md')).toBe(original.get('Outside.md'));expect(disk.get('Templates/T.md')).toBe(original.get('Templates/T.md'));
 expect(editor.canUndo()).toBe(true);expect((await editor.undo()).restored).toBe(1);expect(disk).toEqual(original);expect(editor.canUndo()).toBe(false);
});
it('Keep writes only frontmatter and undo preserves original formatting',async()=>{
 const source='---\n# Comment\nother: "quoted"\n---\nauthor:: AJ\n';const {converter,disk,app,editor}=setup({'A.md':source});
 await converter.apply(await converter.preview({...options,move:false},['A.md']));expect(app.vault.process).not.toHaveBeenCalled();expect(disk.get('A.md')).toContain('author:: AJ');await editor.undo();expect(disk.get('A.md')).toBe(source);
});
it('skips drift before apply and before undo, leaving user edits untouched',async()=>{
 const {converter,disk,editor,app}=setup();const plan=await converter.preview(options,['A.md']);disk.set('A.md','author:: new\n');expect((await converter.apply(plan)).skipped).toBe(1);expect(app.fileManager.processFrontMatter).not.toHaveBeenCalled();
 await converter.apply(await converter.preview(options,['A.md']));disk.set('A.md',disk.get('A.md')+'User text\n');const changed=disk.get('A.md');expect((await editor.undo()).skipped).toBe(1);expect(disk.get('A.md')).toBe(changed);
});
it('rechecks frontmatter inside its write callback',async()=>{
 const {converter,disk,app}=setup();const plan=await converter.preview(options,['A.md']);const original=app.fileManager.processFrontMatter.getMockImplementation();
 app.fileManager.processFrontMatter.mockImplementationOnce(async(file:any,fn:any)=>{disk.set(file.path,'---\nnew: mine\n---\nauthor:: AJ\n');await original(file,fn);});
 expect((await converter.apply(plan)).failures).toHaveLength(1);expect(disk.get('A.md')).toContain('new: mine');expect(disk.get('A.md')).not.toContain('author: AJ');
});
it('preserves body edits between the two write stages and reverts the YAML assignment',async()=>{
 const {converter,disk,app}=setup();const plan=await converter.preview(options,['A.md']);const original=app.fileManager.processFrontMatter.getMockImplementation();
 app.fileManager.processFrontMatter.mockImplementationOnce(async(file:any,fn:any)=>{await original(file,fn);disk.set(file.path,disk.get(file.path)+'User text\n');});
 expect((await converter.apply(plan)).failures).toHaveLength(1);expect(disk.get('A.md')).toContain('User text');expect(disk.get('A.md')).toContain('author:: AJ');expect(disk.get('A.md')).not.toContain('author: AJ');
});
it('retains undo for a partial conversion if body writing fails',async()=>{
 const {converter,disk,app,editor}=setup();const original=disk.get('A.md');app.vault.process.mockRejectedValueOnce(new Error('disk failure'));
 const result=await converter.apply(await converter.preview(options,['A.md']));expect(result.updated).toBe(0);expect(result.failures).toHaveLength(1);expect(disk.get('A.md')).toContain('author: AJ');expect(disk.get('A.md')).toContain('author:: AJ');expect((await editor.undo()).restored).toBe(1);expect(disk.get('A.md')).toBe(original);
});
it('shares the ValueEditor busy guard with conversion and inline edits',async()=>{
 const {converter,editor,app}=setup();let finish!:()=>void;const pending=editor.runExclusive(()=>new Promise<void>(resolve=>{finish=resolve;}));
 const plan=await converter.preview(options,['A.md']);await expect(converter.apply(plan)).rejects.toThrow('running');await expect(editor.undo()).rejects.toThrow('running');
 const inline=new InlineEditor(app,()=>true,editor);await expect(inline.apply({edit:{property:'author',mode:'delete-property',replacement:''},changes:[],skipped:[]})).rejects.toThrow('running');finish();await pending;
});
it('replaces the session undo snapshot only after a successful write',async()=>{
 const {converter,editor,disk}=setup({'A.md':'author:: AJ\n','B.md':'author:: B\n'});
 await converter.apply(await converter.preview(options,['A.md']));await converter.apply(await converter.preview(options,['missing.md']));expect(editor.canUndo()).toBe(true);
 await converter.apply(await converter.preview(options,['B.md']));await editor.undo();expect(disk.get('B.md')).toBe('author:: B\n');expect(disk.get('A.md')).toContain('author: AJ');
});

it('does not remove fields when the body changes inside vault.process',async()=>{
 const {converter,disk,app}=setup();const plan=await converter.preview(options,['A.md']);const original=app.vault.process.getMockImplementation();
 app.vault.process.mockImplementationOnce(async(file:any,fn:any)=>{disk.set(file.path,disk.get(file.path)+'Concurrent edit\n');await original(file,fn);});
 expect((await converter.apply(plan)).updated).toBe(0);expect(disk.get('A.md')).toContain('Concurrent edit');expect(disk.get('A.md')).toContain('author:: AJ');expect(disk.get('A.md')).not.toContain('author: AJ');
});
