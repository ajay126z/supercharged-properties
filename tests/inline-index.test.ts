import { expect, it, vi } from 'vitest';
import { InlineIndex } from '../src/inline-index';
import type { TFile } from 'obsidian';
const file = (path: string) => ({path,extension:'md',stat:{mtime:1,size:10}} as TFile);
const flush = async () => { for(let i=0;i<20;i++) await Promise.resolve(); };
it('does no reads while disabled and skips unchanged/excluded notes when syncing', async () => {
 const read=vi.fn(async()=> 'author:: AJ'); const service=new InlineIndex(read,p=>!p.startsWith('Templates/'),()=>{});
 const a=file('A.md'), template=file('Templates/A.md'); service.sync([a]);service.update(a);expect(read).not.toHaveBeenCalled();
 service.setEnabled(true);service.sync([a,template]);await flush();expect(read).toHaveBeenCalledTimes(1);
 expect(service.index.properties.get('author')!.paths).toEqual(new Set(['A.md']));
 service.sync([a,template]);await flush();expect(read).toHaveBeenCalledTimes(1);
 service.sync([a],true);await flush();expect(read).toHaveBeenCalledTimes(2);
 service.setEnabled(false);expect(service.index.properties.size).toBe(0);
});
it('discards stale reads after a newer metadata event, deletion, rename, or disable', async () => {
 let finish!:(text:string)=>void;
 const service=new InlineIndex(()=>new Promise(resolve=>finish=resolve),()=>true,()=>{});
 service.setEnabled(true);const a=file('A.md');service.update(a);service.update(a,'status:: new');finish('status:: old');await flush();
 expect([...service.index.properties.get('status')!.values.values()].map(n=>n.label)).toEqual(['new']);
 service.update(a);service.remove('A.md');finish('status:: deleted');await flush();expect(service.index.properties.size).toBe(0);
 service.update(a);a.path='B.md';service.remove('A.md');finish('status:: renamed');await flush();expect(service.index.properties.size).toBe(0);
 service.update(a);service.setEnabled(false);finish('status:: disabled');await flush();expect(service.index.properties.size).toBe(0);
});
it('bounds parallel reads and reports failures without keeping stale values', async () => {
 const releases:Array<()=>void>=[];let active=0,max=0;
 const read=vi.fn(async()=> {active++;max=Math.max(active,max);await new Promise<void>(r=>releases.push(r));active--;return 'x:: y';});
 const service=new InlineIndex(read,()=>true,()=>{});service.setEnabled(true);service.sync(Array.from({length:10},(_,i)=>file(`${i}.md`)));
 expect(read).toHaveBeenCalledTimes(4);
 while(service.pending){releases.splice(0).forEach(r=>r());await flush();}
 expect(max).toBe(4);expect(service.index.properties.get('x')!.paths.size).toBe(10);
 const failing=new InlineIndex(async()=>{throw Error('read error');},()=>true,()=>{});failing.setEnabled(true);failing.update(file('A.md'));await flush();expect(failing.failures.has('A.md')).toBe(true);expect(failing.pending).toBe(0);
});
