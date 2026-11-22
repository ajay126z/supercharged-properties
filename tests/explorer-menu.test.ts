import {it,expect,vi} from 'vitest';
vi.mock('obsidian',()=>({TFolder:class{},TFile:class{}}));
import {TFile,TFolder} from 'obsidian';
import {registerBulkMenus} from '../src/explorer-menu';
it('offers folder and multi-selection actions only and preserves the complete selection if both events fire',()=>{
 const events=new Map<string,any>(),plugin:any={registerEvent:vi.fn(),app:{workspace:{on:(name:string,callback:any)=>{events.set(name,callback);return name;}}}},open=vi.fn();registerBulkMenus(plugin,open);
 const menu=()=>({items:[] as any[],addItem(fn:any){const item:any={setTitle(title:string){this.title=title;return this},setIcon(){return this},onClick(fn:any){this.run=fn;return this}};fn(item);this.items.push(item);}});
 const file=new TFile(),folder=new TFolder(),a=menu();events.get('file-menu')(a,file);events.get('files-menu')(a,[file]);expect(a.items).toHaveLength(0);
 events.get('file-menu')(a,folder);expect(a.items[0].title).toBe("Add properties to folder's notes…");events.get('files-menu')(a,[folder,file]);expect(a.items).toHaveLength(2);expect(a.items[0].title).toBe('Add properties to selected notes…');a.items[1].run();expect(open).toHaveBeenCalledWith('remove',[folder,file]);expect(plugin.registerEvent).toHaveBeenCalledTimes(2);
});
