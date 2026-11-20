// SPDX-License-Identifier: MIT
import type { App } from 'obsidian';
import { transformInline, inlineEditError, type InlineEdit } from './inline-edit';
export interface InlineChange { path:string; before:string; after:string }
export interface InlinePlan { edit:InlineEdit; changes:InlineChange[]; skipped:Array<{path:string;reason:string}>; error?:string }
export class InlineEditor {
  private last:InlineChange[]=[];
  private busy=false;
  constructor(private app:App,private includes:(path:string)=>boolean){}
  canUndo():boolean{return !!this.last.length&&!this.busy;}
  async preview(edit:InlineEdit,paths:Iterable<string>):Promise<InlinePlan>{
    const plan:InlinePlan={edit,changes:[],skipped:[],error:inlineEditError(edit)};if(plan.error)return plan;
    for(const path of new Set(paths)){
      const file=this.app.vault.getFileByPath(path);if(!file||!this.includes(path))continue;
      try{const before=await this.app.vault.read(file),after=transformInline(before,edit);if(after!==before)plan.changes.push({path,before,after});}
      catch(error){plan.skipped.push({path,reason:error instanceof Error?error.message:'Could not read note.'});}
    }return plan;
  }
  async apply(plan:InlinePlan):Promise<{updated:number;skipped:number;failed:number}>{
    if(this.busy)throw new Error('Another inline edit is running.');if(plan.error)throw new Error(plan.error);
    this.busy=true;const applied:InlineChange[]=[];let skipped=0,failed=0;
    try{for(const change of plan.changes){
      const file=this.app.vault.getFileByPath(change.path);if(!file||!this.includes(change.path)){skipped++;continue;}
      let wrote=false;
      try{await this.app.vault.process(file,current=>{if(current!==change.before||!this.includes(file.path)||file.path!==change.path)return current;wrote=true;return change.after;});if(wrote)applied.push(change);else skipped++;}catch{failed++;}
    }if(applied.length)this.last=applied;return {updated:applied.length,skipped,failed};}finally{this.busy=false;}
  }
  async undo():Promise<{updated:number;skipped:number;failed:number}>{
    const changes=this.last.map(c=>({path:c.path,before:c.after,after:c.before}));
    const result=await this.apply({edit:{mode:'delete-property',property:'',replacement:''},changes,skipped:[]});this.last=[];return result;
  }
}
