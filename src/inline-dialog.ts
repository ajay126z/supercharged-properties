// SPDX-License-Identifier: MIT
import { Modal, Notice, type App } from 'obsidian';
import { fitModalViewport } from './modal-layout';
import type { InlineEdit } from './inline-edit';
import type { InlinePlan } from './inline-editor';
interface Options { edit:InlineEdit; values:Array<{id:string;label:string}>; preview:(edit:InlineEdit)=>Promise<InlinePlan>; apply:(plan:InlinePlan)=>Promise<void> }
export class InlineEditModal extends Modal {
  private dispose?:()=>void;
  private revision=0;
  constructor(app:App,private options:Options){super(app);}
  onOpen():void{
    const edit={...this.options.edit,values:[...(this.options.edit.values??[])]};
    this.titleEl.textContent=edit.mode==='rename-property'?'Rename inline property':edit.mode==='delete-property'?'Delete inline property':'Replace inline values';
    this.contentEl.classList.add('pv-edit-modal', 'pv-note-edit');
    this.containerEl.classList.add('pv-note-modal-container');this.modalEl.classList.add('pv-note-value-modal');
    this.dispose=fitModalViewport(this.containerEl);
    const fields=this.contentEl.createDiv({cls:'pv-note-edit-scroll'});
    fields.createEl('p',{text:`Property: ${edit.property}. Changes apply to included notes in the active Value filter, regardless of tree search or saved-view selection. YAML frontmatter is not edited.`});
    fields.createEl('p',{text:'Preview first, then confirm. Notes changed since preview are skipped. Undo last inline property edit is available until reload; a new inline batch replaces it.'});
    const controls=fields.createDiv();
    const inputs:HTMLInputElement[]=[];
    if(edit.mode==='replace-values'){
      controls.createEl('p',{text:'Select values to replace with one new text value:'});
      for(const value of this.options.values){
        const label=controls.createEl('label',{cls:'pv-scope-choice'}),input=label.createEl('input');input.type='checkbox';
        const raw=JSON.parse(value.id) as string[],text=raw[0]==='empty'?'':value.label;
        input.checked=edit.values.includes(text);input.setAttribute('aria-label',`Replace ${value.label}`);label.createSpan({text:value.label});inputs.push(input);
        input.addEventListener('change',()=>{edit.values=input.checked?[...edit.values,text]:edit.values.filter(v=>v!==text);invalidate();});
      }
    }
    if(edit.mode!=='delete-property'){
      const label=controls.createEl('label',{cls:'pv-edit-field'});label.createSpan({text:edit.mode==='rename-property'?'New property name':'New value'});
      const input=label.createEl('input');input.type='text';input.value=edit.replacement;input.setAttribute('aria-label',edit.mode==='rename-property'?'New inline property name':'New inline value');inputs.push(input);
      input.addEventListener('input',()=>{edit.replacement=input.value;invalidate();});
    }else controls.createEl('p',{text:'Deletes every occurrence of this inline property and its values. Surrounding prose and other fields are preserved.'});
    const preview=fields.createDiv({cls:'pv-edit-preview'});preview.setAttribute('aria-live','polite');
    const actions=this.contentEl.createDiv({cls:'pv-edit-actions'});
    const cancel=actions.createEl('button',{text:'Cancel'});cancel.addEventListener('click',()=>this.close());
    const inspect=actions.createEl('button',{text:'Preview changes'});
    const apply=actions.createEl('button',{text:'Confirm changes',cls:'mod-cta'});apply.disabled=true;
    let plan:InlinePlan|undefined;
    const invalidate=()=>{this.revision++;plan=undefined;apply.disabled=true;preview.replaceChildren();};
    inspect.addEventListener('click',()=>{
      const revision=++this.revision;apply.disabled=true;inspect.disabled=true;preview.textContent='Reading notes…';
      void this.options.preview({...edit,values:[...edit.values]}).then(result=>{
        if(revision!==this.revision)return;plan=result;preview.replaceChildren();
        preview.createEl('p',{text:result.error??`${result.changes.length} notes will change; ${result.skipped.length} skipped.`});
        for(const change of result.changes){const row=preview.createDiv({cls:'pv-edit-change'});row.createEl('strong',{text:change.path});
          row.createEl('pre',{text:`Before:\n${change.before}\nAfter:\n${change.after}`});
        }
        for(const skip of result.skipped)preview.createEl('p',{text:`${skip.path}: ${skip.reason}`});
        apply.disabled=!!result.error||!result.changes.length;
      }).catch(()=>{preview.textContent='Could not preview inline edits.';}).finally(()=>{inspect.disabled=false;});
    });
    apply.addEventListener('click',()=>{
      if(!plan||apply.disabled)return;apply.disabled=true;inspect.disabled=true;cancel.disabled=true;for(const input of inputs)input.disabled=true;
      void this.options.apply(plan).then(()=>this.close()).catch(error=>{new Notice(error instanceof Error?error.message:'Could not edit inline properties.');invalidate();inspect.disabled=false;cancel.disabled=false;for(const input of inputs)input.disabled=false;});
    });
  }
  onClose():void{this.revision++;this.dispose?.();this.contentEl.replaceChildren();}
}
