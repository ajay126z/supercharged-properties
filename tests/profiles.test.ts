import { expect, it } from 'vitest';
import { loadProfiles, loadViewState, sameKeys } from '../src/profiles';
it('restores and normalizes saved profiles without accepting malformed data', () => {
  const profiles = loadProfiles([
    { id: 'a', name: ' Writing ', keys: ['Status', 'status', 4, ' deadline '] },
    { id: 'a', name: 'Duplicate ID', keys: [] },
    { id: 'b', name: 'writing', keys: [] },
    { id: 'c', name: 'Broken', keys: 'status' },
    null
  ]);
  expect(profiles).toEqual([{ id: 'a', name: 'Writing', keys: ['status', 'deadline'] }]);
  expect(loadProfiles(undefined)).toEqual([]);
  expect(loadProfiles({})).toEqual([]);
});
it('compares profile membership without depending on selection order', () => {
  expect(sameKeys(['a', 'b'], ['b', 'a'])).toBe(true);
  expect(sameKeys(['a'], ['a', 'b'])).toBe(false);
});

it('loads inline view state with safe defaults and normalized keys', () => {
  expect(loadViewState(undefined)).toEqual({profiles:[],scope:null,activeProfile:null});
  expect(loadViewState({profiles:[{id:'a',name:'Reading',keys:['Author']}],scope:['Author','author',2],activeProfile:'a'})).toEqual({profiles:[{id:'a',name:'Reading',keys:['author']}],scope:['author'],activeProfile:'a'});
  expect(loadViewState({profiles:[],scope:[],activeProfile:'missing'})).toEqual({profiles:[],scope:[],activeProfile:null});
});
