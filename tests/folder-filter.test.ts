import { expect, it } from 'vitest';
import { normalizeFolders, sameFolders, folderPaths, folderChoices, intersectPaths } from '../src/folder-filter';
import { PropertyIndex } from '../src/index';
it('normalizes and absorbs descendants without case folding or prefix collisions', () => {
 expect(normalizeFolders([' /Books/ ','Books/Fiction','Books','books','Templates Archive','Templates',4,'../bad','/'])).toEqual(['Books','Templates','Templates Archive','books']);
 expect(normalizeFolders(['A/B','A'])).toEqual(['A']);expect(normalizeFolders(['A','A/B'])).toEqual(['A']);
 expect(normalizeFolders(undefined)).toEqual([]);expect(sameFolders(['B','A/C','A'],['A','B'])).toBe(true);
 expect(sameFolders(['Books'],['books'])).toBe(false);
});
it('matches folder boundaries, descendants, exclusions and intersections',()=>{
 const paths=['Books/A.md','Books/Sub/B.md','Books Archive/C.md','books/D.md','Root.md','Books/Templates/T.md'];
 const folders=folderPaths(paths,['Books'],['Books/Templates']);expect([...folders]).toEqual(['Books/A.md','Books/Sub/B.md']);
 expect([...intersectPaths(folders,new Set(['Books/Sub/B.md','Root.md']))!]).toEqual(['Books/Sub/B.md']);
 expect(intersectPaths(null,null)).toBeNull();expect([...intersectPaths(folders,null)!]).toEqual([...folders]);expect(intersectPaths(new Set(),new Set(['a']))?.size).toBe(0);
});
it('suggests ancestors but omits roots, selected descendants and excluded folders',()=>{
 expect(folderChoices(['/','Books','Books/Fiction','Books/Fiction/New','Other','Templates','Templates/Sub','Templates Archive'],['Books/Fiction'],['Templates'])).toEqual(['Books','Other','Templates Archive']);
});
it('lists distinct indexed paths including unsupported values and scoped indexes',()=>{
 const index=new PropertyIndex();index.update('A.md',{status:'active',author:'AJ'});index.update('B.md',{object:{a:1}});index.update('Empty.md',{});
 expect([...index.paths()]).toEqual(['A.md','B.md']);expect([...index.scoped(new Set(['B.md'])).paths()]).toEqual(['B.md']);index.remove('A.md');expect([...index.paths()]).toEqual(['B.md']);
});
