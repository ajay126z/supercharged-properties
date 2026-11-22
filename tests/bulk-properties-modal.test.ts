// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';
vi.mock('obsidian',()=>({
 Modal:class {contentEl=document.createElement('div');titleEl=document.createElement('h1');containerEl=document.createElement('div');modalEl=document.createElement('div');close=vi.fn();},
 Notice:class{},AbstractInputSuggest:class {limit=0;open(){}close(){}},setIcon:(el:HTMLElement,icon:string)=>el.dataset.icon=icon,
 Menu:class {static items:any[]=[];constructor(){(this.constructor as any).items=[];}addItem(fn:any){const i:any={setTitle(t:string){this.title=t;return this},setIcon(){return this},setChecked(){return this},onClick(fn:any){this.run=fn;return this}};fn(i);(this.constructor as any).items.push(i);return this;}showAtPosition(){}},
}));
import {Menu} from 'obsidian';
import {BulkPropertiesModal} from '../src/bulk-properties-modal';
import {previewAdd,previewRemove} from '../src/bulk-properties';
import {BulkNameSuggest,BulkValueSuggest,replaceListToken} from '../src/bulk-property-suggest';
afterEach(()=>document.body.replaceChildren());
function setup(mode:'add'|'remove'='add',size=2){
 const choices=[{key:'Status',type:'text',inScope:1,mixed:false},{key:'rating',type:'number',inScope:0,mixed:false},{key:'tags',type:'list',inScope:1,mixed:false,disabledReason:'Unavailable'}] as any;
 const preview=vi.fn((paths:string[],request:any)=>({mode:'rows'in request?'add':'remove',keys:'rows'in request?request.rows.map((r:any)=>r.key):request.keys,types:new Map(),notes:paths.map(path=>'rows'in request?previewAdd(path,{Status:'todo'},request.rows,request.exists,request.delimiter):previewRemove(path,{Status:'todo'},request.keys))}));
 const apply=vi.fn(async(plan:any)=>plan.notes),undo=vi.fn(async()=>({restored:1,skipped:0,failures:[]}));
 const options:any={mode,settings:{bulkIncludeSubfolders:true,bulkExistsMode:'skip',bulkListDelimiter:','},scope:(recursive:boolean)=>({kind:'folder',label:'Recipes',paths:Array.from({length:recursive?size:1},(_,i)=>`Recipes/${i}.md`),includeSubfolders:recursive,skippedExcluded:1,skippedNonMarkdown:0}),catalog:()=>choices,values:()=>['todo','done'],preview,apply,undo,canUndo:()=>true};
 const modal=new BulkPropertiesModal({} as any,options);document.body.append(modal.contentEl);modal.onOpen();
 const button=(name:string)=>[...modal.contentEl.querySelectorAll('button')].find(b=>b.textContent===name)!;
 const input=(label:string)=>modal.contentEl.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!;
 const set=(label:string,value:string)=>{input(label).value=value;input(label).dispatchEvent(new Event('input'));};
 return {modal,button,input,set,preview,apply,undo,options};
}
it('validates rows, resets types, preserves Back state, and supports explicit preview/apply/undo',async()=>{
 const {modal,button,input,set,apply,undo}=setup();button('Preview changes').click();expect(modal.contentEl.textContent).toContain('Enter a property name');expect(document.activeElement).toBe(input('Property name'));
 set('Property name','rating');set('Value','5');input('Property type: Text').click();(Menu as any).items.find((i:any)=>i.title==='Number').run();expect(input('Value').value).toBe('');expect(input('Value').type).toBe('number');set('Value','4');button('Preview changes').click();expect(modal.titleEl.textContent).toBe('Review changes');expect(apply).not.toHaveBeenCalled();button('Back').click();expect(input('Value').value).toBe('4');button('Preview changes').click();button('Add to 2 notes').click();await vi.waitFor(()=>expect(modal.titleEl.textContent).toBe('Changes complete'));button('Undo').click();await vi.waitFor(()=>expect(undo).toHaveBeenCalledOnce());modal.onClose();
});
it('chooses existing properties, blocks reserved keys, enforces the row cap and keeps a final empty row',()=>{
 const {modal,button,input}=setup();button('Choose from existing').click();expect(input('Choose tags').disabled).toBe(true);input('Choose rating').checked=true;input('Choose rating').dispatchEvent(new Event('change'));button('Add 1 property').click();expect(input('Property name').value).toBe('rating');expect(input('Value').type).toBe('number');expect(document.activeElement).toBe(input('Value'));
 for(let i=0;i<25;i++)button('Add property').click();expect(modal.contentEl.querySelectorAll('.pv-bulk-row')).toHaveLength(20);expect(button('Choose from existing').disabled).toBe(true);
 for(let i=0;i<20;i++)input('Remove property row').click();expect(modal.contentEl.querySelectorAll('.pv-bulk-row')).toHaveLength(1);expect(input('Property name').value).toBe('');modal.onClose();
});
it('removes only present properties, Select shown respects filters, and paginates previews',()=>{
 const {modal,button,input,set}=setup('remove',45);expect(input('Remove rating')).toBeNull();expect(input('Remove tags').disabled).toBe(true);
 set('Filter properties','Status');button('Select shown').click();button('Preview changes').click();expect(modal.contentEl.querySelectorAll('.pv-edit-change')).toHaveLength(20);expect(modal.contentEl.textContent).toContain('and 25 more notes');button('Show more').click();expect(modal.contentEl.querySelectorAll('.pv-edit-change')).toHaveLength(40);button('Back').click();expect(input('Filter properties').value).toBe('Status');expect(input('Remove Status').checked).toBe(true);modal.onClose();
});
it('updates scope on subfolder change and preserves focused name input while updating info',()=>{
 const {modal,input,set}=setup();input('Property name').focus();set('Property name','new');expect(modal.contentEl.textContent).toContain('New property');expect(document.activeElement).toBe(input('Property name'));set('Property name','status');expect(modal.contentEl.textContent).toContain('Already on 1 of 2 notes');input('Include subfolders').checked=false;input('Include subfolders').dispatchEvent(new Event('change'));expect(input('Property name').value).toBe('status');expect(modal.contentEl.textContent).toContain('Already on 1 of 1 notes');modal.onClose();
});
it('uses native suggestion ranking and replaces only the current list token',()=>{
 const input=document.createElement('input'),select=vi.fn();const choices=[{key:'State',type:'text',inScope:3},{key:'Status',type:'text',inScope:5},{key:'tags',type:'list',inScope:2,disabledReason:'Unavailable'}] as any;
 const suggest=new BulkNameSuggest({} as any,input,()=>choices,()=>new Set(['state']),select);expect(suggest.getSuggestions('sta').map(c=>c.key)).toEqual(['Status']);suggest.selectSuggestion(choices[2]);expect(select).not.toHaveBeenCalled();suggest.selectSuggestion(choices[1]);expect(select).toHaveBeenCalledWith(choices[1]);
 expect(replaceListToken('one, tw, three',6,6,'two',',').text).toBe('one, two, three');expect(replaceListToken(',tail',0,0,'first',',').text).toBe('first,tail');
 input.value='one, tw, three';input.setSelectionRange(6,6);const values=new BulkValueSuggest({} as any,input,()=>['two','ten'],()=>',',vi.fn());expect(values.getSuggestions(input.value)).toEqual(['two']);const event=new KeyboardEvent('keydown',{key:'Enter',cancelable:true});values.selectSuggestion('two',event);expect(event.defaultPrevented).toBe(true);expect(input.value).toBe('one, two, three');
});
