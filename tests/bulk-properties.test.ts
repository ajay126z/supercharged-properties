import {it,expect} from 'vitest';
import {parseValue,previewAdd,previewRemove,applyChanges,validateRows} from '../src/bulk-properties';
const row=(key='status',type:any='text',value='done')=>({id:key,key,type,value});
it('parses supported types with shared strict validators',()=>{
 for(const [type,raw,value] of [['text',' 42 ','42'],['list','a, b,a,,',['a','b']],['number','-2e2',-200],['checkbox','false',false],['date','2024-02-29','2024-02-29'],['datetime','2024-02-29T12:30','2024-02-29T12:30']] as any[])expect(parseValue(type,raw,',')).toEqual({ok:true,value});
 for(const [type,raw] of [['text',''],['number',''],['number','9007199254740992'],['number','Infinity'],['date','2025-02-29'],['datetime','2025-01-01'],['list',',,']])expect(parseValue(type as any,raw,',').ok).toBe(false);
});
it('preserves key spelling, empties, key order, and rejects ambiguous and protected rows',()=>{
 const p=previewAdd('A',{Status:null,other:3},[row('status')],'skip',',');const fm={Status:null,other:3};applyChanges(fm,p.changes);expect(fm).toEqual({Status:'done',other:3});expect(Object.keys(fm)).toEqual(['Status','other']);
 expect(previewAdd('A',{Status:'x',status:'y'},[row()],'overwrite',',').skipped[0].reason).toBe('ambiguous-key');
 expect(validateRows([row('tags')],',').size).toBe(1);expect(validateRows([row(),row('STATUS')],',').get('STATUS')).toBe('Already listed above');
 expect(previewRemove('A',{Status:'x'},['status']).changes[0].key).toBe('Status');
});
it('implements skip, overwrite and text/list merge without losing existing duplicates',()=>{
 expect(previewAdd('A',{status:'wip'},[row()],'skip',',').changes).toHaveLength(0);
 expect(previewAdd('A',{status:'wip'},[row()],'overwrite',',').changes[0].after).toBe('done');
 expect(previewAdd('A',{status:'wip'},[row()],'merge',',').changes[0].after).toEqual(['wip','done']);
 expect(previewAdd('A',{status:['a','a',2]},[row('status','list','2,b')],'merge',',').changes[0].after).toEqual(['a','a',2,'2','b']);
 for(const value of [42,true,{},[['x']],'2025-01-01'])expect(previewAdd('A',{status:value},[row()],'merge',',').skipped[0].reason).toBe('unsupported-existing');
 expect(previewAdd('A',{rating:'old'},[row('rating','number','4')],'merge',',').changes[0].after).toBe(4);
});
it('preserves static preview/write agreement for combinations of existing values and conflict modes',()=>{
 for(const value of [undefined,null,'',[],['a','a'],'old',1,true,{nested:'x'}])for(const mode of ['skip','merge','overwrite'] as const)for(const type of ['text','list','number','checkbox','date','datetime'] as const){
 const raw={text:'new',list:'a,b',number:'4',checkbox:'true',date:'2026-11-22',datetime:'2026-11-22T10:30'}[type];const before:any=value===undefined?{}:{Status:value};const plan=previewAdd('A',before,[row('status',type,raw)],mode,',');const after=structuredClone(before);applyChanges(after,plan.changes);for(const change of plan.changes)expect(after[change.key]).toEqual(change.after);expect(before).toEqual(value===undefined?{}:{Status:value});
 }
 expect(previewRemove('A',{Status:1,status:2},['status']).skipped[0].reason).toBe('ambiguous-key');expect(previewRemove('A',{},['missing']).changes).toHaveLength(0);
});
it('treats prototype-looking keys as absent own keys and safely snapshots date/recursive values',()=>{
 for(const key of ['__proto__','constructor','toString']){const plan=previewAdd('A',{},[row(key)],'skip',',');expect(plan.changes[0].before).toBeUndefined();const fm:any={};applyChanges(fm,plan.changes);expect(Object.prototype.hasOwnProperty.call(fm,key)).toBe(true);expect(fm[key]).toBe('done');expect(Object.getPrototypeOf(fm)).toBe(Object.prototype);}
 const date=new Date('2026-11-22T00:00:00Z');const plan=previewRemove('A',{date},['date']);expect(plan.changes[0].before).toEqual(date);expect(plan.changes[0].before).not.toBe(date);
});

it('removes entire YAML tags keys, preserves collision safety and blocks position',()=>{
 for(const tags of [['one','two'],'one',[],null]) {
  const fm={Tags:tags,status:'active'};const result=previewRemove('A',fm,['tags']);
  expect(result.changes).toHaveLength(1);applyChanges(fm,result.changes);expect(fm).toEqual({status:'active'});
 }
 expect(previewRemove('A',{tags:['one'],Tags:['two']},['tags']).skipped[0].reason).toBe('ambiguous-key');
 expect(previewRemove('A',{},['tags']).changes).toHaveLength(0);
 expect(()=>previewRemove('A',{position:{}},['position'])).toThrow();
});

it('adds YAML tags as text lists and supports skip, merge, overwrite and collisions',()=>{
 const rows=[row('tags','list','project,work,project')];
 expect(previewAdd('A',{},rows,'skip',',').changes[0].after).toEqual(['project','work']);
 expect(previewAdd('A',{tags:['old']},rows,'skip',',').changes).toHaveLength(0);
 expect(previewAdd('A',{tags:['old','work']},rows,'merge',',').changes[0].after).toEqual(['old','work','project']);
 expect(previewAdd('A',{tags:'old'},rows,'merge',',').changes[0].after).toEqual(['old','project','work']);
 expect(previewAdd('A',{tags:['old']},rows,'overwrite',',').changes[0].after).toEqual(['project','work']);
 expect(previewAdd('A',{tags:[1]},rows,'merge',',').skipped[0].reason).toBe('unsupported-existing');
 expect(previewAdd('A',{tags:[],Tags:[]},rows,'overwrite',',').skipped[0].reason).toBe('ambiguous-key');
});
