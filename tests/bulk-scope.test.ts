import {it,expect,vi} from 'vitest';
vi.mock('obsidian',()=>({TFile:class{},TFolder:class{}}));
import {TFile,TFolder} from 'obsidian';
import {resolveSelectionScope,resolveTreeScope} from '../src/bulk-scope';
const f=(path:string)=>Object.assign(new TFile(),{path,extension:path.split('.').pop()});
const d=(path:string,children:any[])=>Object.assign(new TFolder(),{path,children});
it('walks folder children, honors recursion and deduplicates selections with exclusions and nonmarkdown counts',()=>{
 const a=f('Recipes/A.md'),b=f('Recipes/Sub/B.md'),excluded=f('Recipes/Templates/T.md'),pic=f('Recipes/pic.png');
 const folder=d('Recipes',[a,d('Recipes/Sub',[b]),d('Recipes/Templates',[excluded]),pic]);const includes=(path:string)=>!path.startsWith('Recipes/Templates/');
 expect(resolveSelectionScope([folder],false,includes)).toMatchObject({paths:[a.path],skippedExcluded:0,skippedNonMarkdown:1});
 expect(resolveSelectionScope([folder,a,b],true,includes)).toMatchObject({paths:[a.path,b.path],skippedExcluded:1,skippedNonMarkdown:1});
 const tree=resolveTreeScope({getAbstractFileByPath:path=>[a,b].find(f=>f.path===path)} as any,[b.path],'status = done',includes,false);expect(tree.paths).toEqual([b.path]);expect(tree.kind).toBe('tree');expect(tree.includeSubfolders).toBeUndefined();
});
