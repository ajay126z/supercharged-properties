// @vitest-environment jsdom
import {expect,it,vi} from 'vitest';
vi.mock('obsidian',()=>({Modal:class{titleEl=document.createElement('h1');contentEl=document.createElement('div');containerEl=document.createElement('div');modalEl=document.createElement('div');close=vi.fn();},Notice:class{}}));
import {InlineConversionModal} from '../src/inline-conversion-dialog';
const changes=[{path:'A.md',key:'author',existed:false,replacement:'AJ',body:'author:: AJ',afterBody:'',removed:['author:: AJ']}];
function setup(preview=vi.fn(async(options:any,paths:any)=>({options,changes,skipped:[]}))) {
 const apply=vi.fn().mockResolvedValue(undefined),modal=new InlineConversionModal({} as any,{property:'author',paths:['A.md','B.md'],preview,apply});modal.onOpen();
 const button=(text:string)=>[...modal.contentEl.querySelectorAll('button')].find(b=>b.textContent===text)!;
 return {modal,preview,apply,button};
}
it('defaults to Move, literal text and Skip; allows note selection and requires a fresh preview',async()=>{
 const {modal,preview,apply,button}=setup();expect(button('Confirm conversion').disabled).toBe(true);
 const checkboxes=modal.contentEl.querySelectorAll<HTMLInputElement>('input[type=checkbox]');checkboxes[2].checked=false;checkboxes[2].dispatchEvent(new Event('change'));button('Preview changes').click();await vi.waitFor(()=>expect(button('Confirm conversion').disabled).toBe(false));
 expect(preview.mock.calls[0]).toEqual([{property:'author',move:true,detect:false,conflict:'skip'},['A.md']]);expect(apply).not.toHaveBeenCalled();expect(modal.contentEl.textContent).toContain('Removed from body:');
 const source=modal.contentEl.querySelector<HTMLSelectElement>('[aria-label="Source text"]')!;source.value='keep';source.dispatchEvent(new Event('change'));expect(button('Confirm conversion').disabled).toBe(true);
 button('Preview changes').click();await vi.waitFor(()=>expect(button('Confirm conversion').disabled).toBe(false));button('Confirm conversion').click();button('Confirm conversion').click();await vi.waitFor(()=>expect(apply).toHaveBeenCalledTimes(1));modal.onClose();
});
it('ignores a stale async preview and caps rendered changes without shrinking the batch',async()=>{
 let resolve!:(value:any)=>void;const preview=vi.fn(()=>new Promise<any>(r=>{resolve=r;}));const {modal,button,apply}=setup(preview);
 button('Preview changes').click();modal.contentEl.querySelector<HTMLInputElement>('input')!.dispatchEvent(new Event('change'));resolve({options:{move:true},changes,skipped:[]});await vi.waitFor(()=>expect(button('Preview changes').disabled).toBe(false));expect(button('Confirm conversion').disabled).toBe(true);
 button('Preview changes').click();const batch=Array.from({length:60},(_,i)=>({...changes[0],path:`${i}.md`}));resolve({options:{move:true},changes:batch,skipped:[]});await vi.waitFor(()=>expect(button('Confirm conversion').disabled).toBe(false));expect(modal.contentEl.querySelectorAll('.pv-edit-change')).toHaveLength(50);button('Confirm conversion').click();await vi.waitFor(()=>expect(apply).toHaveBeenCalledOnce());expect(apply.mock.calls[0][0].changes).toHaveLength(60);modal.onClose();
});
