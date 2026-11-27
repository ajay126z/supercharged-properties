import { expect, it } from 'vitest';
import { sortNodes, sortOrder } from '../src/sorting';
const nodes = [
  { id: 'a', label: 'Alpha', paths: new Set(['1', '2']) },
  { id: 'b', label: 'Beta', paths: new Set(['1']) },
  { id: 'g', label: 'Gamma', paths: new Set(['1', '2', '3']) }
];
it('sorts names and distinct-note frequency in both directions', () => {
  const ids = (order: Parameters<typeof sortNodes>[1]) => sortNodes(nodes, order).map(node => node.id);
  expect(ids('name')).toEqual(['a', 'b', 'g']);
  expect(ids('name-desc')).toEqual(['g', 'b', 'a']);
  expect(ids('count')).toEqual(['g', 'a', 'b']);
  expect(ids('count-asc')).toEqual(['b', 'a', 'g']);
});
it('keeps frequency ties alphabetical and supports old saved modes', () => {
  expect(sortNodes(nodes.map(node => ({ ...node, paths: new Set(['1']) })), 'count-asc').map(node => node.id)).toEqual(['a', 'b', 'g']);
  expect(sortOrder('name')).toBe('name'); expect(sortOrder('count')).toBe('count');
  expect(sortOrder('name-desc')).toBe('name-desc'); expect(sortOrder('count-asc')).toBe('count-asc');
  expect(sortOrder('constructor')).toBe('name');
});

import { linkedValueSortKey } from '../src/sorting';
it('uses resolved basenames and strips unresolved wikilink folders, aliases, headings, blocks and extensions', () => {
 const node = (label: string) => ({id: label, label, paths:new Set(['Z/source.md','A/source.md'])});
 const resolve=(target:string,source:string)=>target==='shortcut'&&source==='A/source.md'?{basename:'2026-W2'}:null;
 for(const [label,key] of [['[[2026-W09]]','2026-W09'],['[[Journal/2026-W21|This week]]','2026-W21'],['[[2026-W22#Review]]','2026-W22'],['[[Journal/2026-W23.md#^block|alias]]','2026-W23'],['[[shortcut]]','2026-W2'],['ordinary text','ordinary text'],['prefix [[note]]','prefix [[note]]']]) expect(linkedValueSortKey(node(label),resolve)).toBe(key);
 const values=['[[Journal/2026-W21|First]]','[[2026-W9]]','[[shortcut]]'].map(node);
 const key=(value:typeof values[number])=>linkedValueSortKey(value,resolve);
 expect(sortNodes(values,'name',key).map(key)).toEqual(['2026-W2','2026-W9','2026-W21']);
 expect(sortNodes(values,'name-desc',key).map(key)).toEqual(['2026-W21','2026-W9','2026-W2']);
 expect(values[0].label).toBe('[[Journal/2026-W21|First]]');
 expect(sortNodes(values,'count',key)).toEqual(sortNodes(values,'count'));
});
import {natural} from '../src/index';
it('retains locale-aware natural ordering with the reused collator',()=>{
 const labels=['2026-W9','2026-W21','Éclair','eclair','Alpha','alpha','file 002','file 10'];
 for(const a of labels)for(const b of labels)expect(Math.sign(natural(a,b))).toBe(Math.sign(a.localeCompare(b,undefined,{numeric:true,sensitivity:'base'})));
});
