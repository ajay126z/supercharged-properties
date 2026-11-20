// @vitest-environment jsdom
import {expect,it,vi} from 'vitest';
vi.mock('obsidian',()=>({Modal:class{titleEl=document.createElement('h1');contentEl=document.createElement('div');containerEl=document.createElement('div');modalEl=document.createElement('div');close=vi.fn();},Notice:class{}}));
import {InlineEditModal} from '../src/inline-dialog';
import type {App} from 'obsidian';
it('selects multiple values, invalidates old previews, and requires confirmation',async()=>{
 const apply=vi.fn().mockResolvedValue(undefined),preview=vi.fn(async(edit:any)=>({edit,changes:[{path:'A.md',before:'status:: todo',after:'status:: active'}],skipped:[]}));
 const modal=new InlineEditModal({} as App,{edit:{mode:'replace-values',property:'status',replacement:'active',values:['todo']},values:[{id:'["string","todo"]',label:'todo'},{id:'["string","doing"]',label:'doing'}],preview,apply});
 modal.onOpen();
 const button=(text:string)=>[...modal.contentEl.querySelectorAll('button')].find(b=>b.textContent===text)!;
 const confirm=button('Confirm changes');expect(confirm.disabled).toBe(true);
 const check=modal.contentEl.querySelector<HTMLInputElement>('[aria-label="Replace doing"]')!;check.checked=true;check.dispatchEvent(new Event('change'));
 button('Preview changes').click();await vi.waitFor(()=>expect(confirm.disabled).toBe(false));
 expect(preview.mock.calls[0][0].values).toEqual(['todo','doing']);expect(apply).not.toHaveBeenCalled();
 const input=modal.contentEl.querySelector<HTMLInputElement>('[aria-label="New inline value"]')!;input.value='done';input.dispatchEvent(new Event('input'));expect(confirm.disabled).toBe(true);
 button('Preview changes').click();await vi.waitFor(()=>expect(confirm.disabled).toBe(false));confirm.click();confirm.click();await vi.waitFor(()=>expect(apply).toHaveBeenCalledTimes(1));modal.onClose();
});
