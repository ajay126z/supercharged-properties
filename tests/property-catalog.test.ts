import {it,expect} from 'vitest';
import {PropertyIndex} from '../src/index';
import {propertyCatalog,inferType,matchChoices,valueSuggestions} from '../src/property-catalog';
it('prefers configured types, samples in-scope metadata, and retains vault-wide choices with scope counts',()=>{
 const index=new PropertyIndex();const fm:any={'A':{rating:4,status:'active'},'B':{rating:5,other:true},'C':{rating:'mixed',status:'active'}};for(const [path,value]of Object.entries(fm))index.update(path,value as any);
 const choices=propertyCatalog(index,['A'],key=>key==='rating'?'text':undefined,path=>fm[path]);expect(choices.find(c=>c.key==='rating')).toMatchObject({type:'text',inScope:1,mixed:true});expect(choices.find(c=>c.key==='other')).toMatchObject({type:'checkbox',inScope:0});
 expect(matchChoices(choices,'r',new Set(['rating'])).map(c=>c.key)).toEqual(['other']);expect(valueSuggestions(index,'status',['A'])).toEqual(['active']);
});
it('infers supported types, mixed majorities, ties and empty fallback',()=>{
 for(const [values,type] of [[[[]],'text'],[[['a']],'list'],[[false],'checkbox'],[[1,2,'x'],'number'],[[1,'x'],'text'],[['2026-01-01'],'date'],[['2026-01-01T12:30'],'datetime']] as any[])expect(inferType(values).type).toBe(type);
});
