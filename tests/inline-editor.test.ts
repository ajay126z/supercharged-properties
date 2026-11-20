import {expect,it,vi} from 'vitest';
import {InlineEditor} from '../src/inline-editor';
function setup(){
 const disk=new Map([['A.md','status:: todo'],['B.md','status:: doing'],['Excluded.md','status:: todo']]);
 const app:any={vault:{getFileByPath:(path:string)=>disk.has(path)?{path}:null,read:async(file:any)=>disk.get(file.path),process:vi.fn(async(file:any,fn:any)=>{disk.set(file.path,fn(disk.get(file.path)))})}};
 return {disk,app,editor:new InlineEditor(app,path=>path!=='Excluded.md')};
}
const edit={property:'status',mode:'replace-values' as const,replacement:'active',values:['todo','doing']};
it('previews without writing, honors scope, applies once per note, and undoes',async()=>{
 const {disk,app,editor}=setup();const plan=await editor.preview(edit,['A.md','A.md','Excluded.md']);
 expect(plan.changes).toHaveLength(1);expect(app.vault.process).not.toHaveBeenCalled();
 expect((await editor.apply(plan)).updated).toBe(1);expect(disk.get('A.md')).toBe('status:: active');expect(disk.get('B.md')).toBe('status:: doing');
 expect((await editor.undo()).updated).toBe(1);expect(disk.get('A.md')).toBe('status:: todo');expect(editor.canUndo()).toBe(false);
});
it('skips edits after preview and after apply during undo',async()=>{
 const {disk,editor}=setup();const plan=await editor.preview(edit,['A.md','B.md']);disk.set('B.md','status:: later');
 expect(await editor.apply(plan)).toEqual({updated:1,skipped:1,failed:0});disk.set('A.md','status:: mine');
 expect((await editor.undo()).skipped).toBe(1);expect(disk.get('A.md')).toBe('status:: mine');
});
it('reports unsafe notes and individual write failures',async()=>{
 const {disk,app,editor}=setup();disk.set('A.md','status:: `code`');
 const plan=await editor.preview({property:'status',mode:'delete-property',replacement:''},disk.keys());
 expect(plan.skipped).toHaveLength(1);app.vault.process.mockRejectedValue(new Error('write failed'));
 expect((await editor.apply(plan)).failed).toBe(1);expect(editor.canUndo()).toBe(false);
});
