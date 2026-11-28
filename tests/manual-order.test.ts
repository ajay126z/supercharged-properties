import {expect,it} from 'vitest';
import {fold} from '../src/index';
import {normalizeOrder,sortByOrder,materializeOrder,moveWithinGroup,placeInGroup} from '../src/manual-order';
it('normalizes optional orders without losing the first occurrence',()=>{
 expect(normalizeOrder(null,fold)).toBeUndefined();expect(normalizeOrder({},fold)).toBeUndefined();
 expect(normalizeOrder([' Status ',3,'STATUS','','Author','e\u0301','é'],fold)).toEqual(['status','author','é']);expect(normalizeOrder([],fold)).toEqual([]);
});
it('sorts listed nodes first and unlisted nodes naturally, preserving ties',()=>{
 const nodes=['x10','same','x2','z','same'].map((label,i)=>({id:String(i),label}));
 expect(sortByOrder(nodes,['3','stale']).map(n=>n.id)).toEqual(['3','1','4','2','0']);
 expect(materializeOrder(['z','stale','z'],['x','z','y','x'])).toEqual(['z','stale','x','y']);
});
it('moves relative to visible neighbors while preserving outsiders',()=>{
 const order=['a','hidden','b','other','c'];const group=['a','b','c'];
 expect(moveWithinGroup(order,'b',group,'up')).toEqual(['b','a','hidden','other','c']);
 expect(moveWithinGroup(order,'a',group,'down')).toEqual(['hidden','b','a','other','c']);
 expect(moveWithinGroup(order,'c',group,'top')).toEqual(['c','a','hidden','b','other']);
 expect(moveWithinGroup(order,'a',group,'bottom')).toEqual(['hidden','b','other','c','a']);
 expect(moveWithinGroup(order,'a',group,'up')).toEqual(order);expect(moveWithinGroup(order,'c',group,'down')).toEqual(order);
 expect(moveWithinGroup(['hidden'],'b',['a','b'],'up')).toEqual(['hidden','b','a']);
 expect(moveWithinGroup(order,'hidden',group,'top')).toEqual(order);
});
it('places before a visible key or after the final group key and preserves no-op drops',()=>{
 const order=['a','hidden','b','tail'];const group=['a','b'];
 expect(placeInGroup(order,'b',group,'a')).toEqual(['b','a','hidden','tail']);
 expect(placeInGroup(order,'a',group,null)).toEqual(['hidden','b','a','tail']);
 expect(placeInGroup(order,'a',group,'b')).toEqual(order);expect(placeInGroup(order,'b',group,null)).toEqual(order);
 expect(placeInGroup(order,'a',group,'a')).toEqual(order);expect(placeInGroup(order,'a',group,'hidden')).toEqual(order);
});
