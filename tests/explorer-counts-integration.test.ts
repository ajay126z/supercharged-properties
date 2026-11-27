// @vitest-environment jsdom
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
vi.mock('obsidian', () => ({Notice: vi.fn(), Setting: class {}}));
import {Notice} from 'obsidian';
import {ExplorerCounts} from '../src/explorer-counts/explorer-counts';
import {DEFAULT_EXPLORER_COUNTS} from '../src/explorer-counts/settings';
function events() {
  const callbacks = new Map<string, Set<() => void>>();
  return {
    on: vi.fn((name: string, run: () => void) => { if (!callbacks.has(name)) callbacks.set(name,new Set()); callbacks.get(name)!.add(run); return {name,run}; }),
    offref: vi.fn((ref: any) => callbacks.get(ref.name)?.delete(ref.run)),
    emit: (name: string) => { for (const run of callbacks.get(name) ?? []) run(); },
    size: () => [...callbacks.values()].reduce((sum,runs) => sum+runs.size,0)
  };
}
let showTooltips: boolean;
let settings: typeof DEFAULT_EXPLORER_COUNTS, feature: ExplorerCounts, vault: ReturnType<typeof events> & any, workspace: ReturnType<typeof events> & any;
let layout: Array<() => void>, files: Array<{path: string}>, containers: HTMLElement[], excluded: Set<string>;
function explorer(paths: string[]) {
  const root = document.createElement('div');
  for (const path of paths) {const folder=document.createElement('div'); folder.className='nav-folder'; const title=document.createElement('div');title.className='nav-folder-title';title.dataset.path=path;title.textContent=path;folder.append(title);root.append(folder);}
  document.body.append(root);return root;
}
function badge(path: string, root=containers[0]) { return [...root.querySelectorAll<HTMLElement>('.nav-folder-title')].find(e=>e.dataset.path===path)?.querySelector('.pv-folder-count'); }
async function settle() {await Promise.resolve();await vi.advanceTimersByTimeAsync(300);}
beforeEach(() => {
 vi.useFakeTimers();layout=[];files=[{path:'root.md'},{path:'Books/a.md'},{path:'Books/Sub/b.md'},{path:'Books/cover.png'}];excluded=new Set();
 showTooltips=true;settings={...DEFAULT_EXPLORER_COUNTS};containers=[explorer(['/','Books','Books/Sub','Empty'])];
 vault={...events(),getFiles:vi.fn(()=>files),getMarkdownFiles:vi.fn(()=>files.filter(f=>f.path.endsWith('.md')))};
 workspace={...events(),onLayoutReady:(run:()=>void)=>layout.push(run),getLeavesOfType:vi.fn(()=>containers.map(containerEl=>({view:{containerEl}})))};
 feature=new ExplorerCounts({vault,workspace} as any,()=>settings,{isExcluded:path=>excluded.has(path),showTooltips:()=>showTooltips});
});
afterEach(()=>{feature.stop();vi.restoreAllMocks();vi.useRealTimers();document.body.replaceChildren();});
function enable() {settings.enabled=true;feature.apply();for(const run of layout.splice(0))run();}
it('does no vault or Explorer work while disabled, including unloading',()=>{
 feature.apply();feature.stop();expect(vault.on).not.toHaveBeenCalled();expect(vault.getMarkdownFiles).not.toHaveBeenCalled();expect(workspace.getLeavesOfType).not.toHaveBeenCalled();expect(layout).toHaveLength(0);
});
it('waits for layout and ignores stale startup callbacks after off/on toggles',()=>{
 settings.enabled=true;feature.apply();settings.mode='both';feature.apply();expect(vault.getMarkdownFiles).not.toHaveBeenCalled();
 settings.enabled=false;feature.apply();settings.enabled=true;feature.apply();for(const run of layout)run();
 expect(vault.size()).toBe(3);expect(workspace.size()).toBe(1);expect(vault.getMarkdownFiles).toHaveBeenCalledTimes(1);expect(badge('Books')?.textContent).toBe('1 · 2');
 feature.stop();for(const run of layout)run();expect(vault.size()).toBe(0);expect(workspace.size()).toBe(0);expect(document.querySelector('.pv-folder-count')).toBeNull();
});
it('counts notes without frontmatter, optional attachments, modes and empty folders',()=>{
 enable();expect(badge('/')?.textContent).toBe('3');expect(badge('Books')?.textContent).toBe('2');expect(badge('Empty')).toBeNull();
 settings.countAllFiles=true;settings.mode='both';settings.hideZero=false;feature.apply();expect(badge('Books')?.textContent).toBe('2 · 3');expect(badge('Empty')?.textContent).toBe('0 · 0');expect(badge('Books')?.getAttribute('aria-label')).toBe('3 files, 2 directly in this folder');
 settings.mode='direct';feature.apply();expect(badge('Books')?.textContent).toBe('2');
});
it('debounces create/delete/rename bursts and updates renamed folder rows',async()=>{
 enable();files.push({path:'Books/new.md'});vault.emit('create');vault.emit('create');await settle();expect(badge('Books')?.textContent).toBe('3');expect(vault.getMarkdownFiles).toHaveBeenCalledTimes(2);
 files=files.filter(f=>!f.path.endsWith('new.md'));vault.emit('delete');await settle();expect(badge('Books')?.textContent).toBe('2');
 files=files.map(f=>({path:f.path.replace('Books/','Reading/')}));for(const row of containers[0].querySelectorAll<HTMLElement>('[data-path]'))row.dataset.path=row.dataset.path!.replace('Books','Reading');vault.emit('rename');await settle();expect(badge('Reading')?.textContent).toBe('2');
});
it('refreshes changed exclusions without a vault event only when skipping is enabled',async()=>{
 enable();excluded.add('Books/Sub/b.md');feature.exclusionsChanged();await settle();expect(badge('Books')?.textContent).toBe('2');
 settings.skipExcludedFolders=true;feature.apply();expect(badge('Books')?.textContent).toBe('1');excluded.clear();feature.exclusionsChanged();await settle();expect(badge('Books')?.textContent).toBe('2');
});
it('decorates newly mounted rows and leaves without an observer feedback loop',async()=>{
 enable();const count=vault.getMarkdownFiles.mock.calls.length;
 const folder=explorer(['Books/Sub']);containers[0].append(folder);await settle();expect(badge('Books/Sub',folder)?.textContent).toBe('1');
 const second=explorer(['Books']);containers.push(second);workspace.emit('layout-change');await settle();expect(badge('Books',second)?.textContent).toBe('2');
 containers.pop();workspace.emit('layout-change');await settle();expect(second.querySelector('.pv-folder-count')).toBeNull();expect(vault.getMarkdownFiles).toHaveBeenCalledTimes(count);
 expect(vi.getTimerCount()).toBe(0);
});
it('cancels pending work and removes only its badges when stopped',async()=>{
 enable();vault.emit('create');const title=containers[0].querySelector('.nav-folder-title')!;title.append(document.createElement('strong'));feature.stop();await settle();
 expect(document.querySelector('.pv-folder-count')).toBeNull();expect(title.querySelector('strong')).not.toBeNull();expect(vault.size()).toBe(0);expect(workspace.size()).toBe(0);expect(vault.getMarkdownFiles).toHaveBeenCalledTimes(1);
});
it('contains unsupported Explorer markup and can retry after off/on',()=>{
 const error=vi.spyOn(console,'error').mockImplementation(()=>{});containers[0].querySelectorAll('[data-path]').forEach(e=>e.removeAttribute('data-path'));
 enable();expect(error).toHaveBeenCalledTimes(1);expect(Notice).toHaveBeenCalled();expect(vault.size()).toBe(0);expect(document.querySelector('.pv-folder-count')).toBeNull();
 feature.apply();expect(error).toHaveBeenCalledTimes(1);settings.enabled=false;feature.apply();containers=[explorer(['Books'])];enable();expect(badge('Books')?.textContent).toBe('2');
});
it('contains errors when a new Explorer leaf cannot be observed',()=>{
 enable();vi.spyOn(workspace,'getLeavesOfType').mockImplementation(()=>{throw Error('layout unavailable');});vi.spyOn(console,'error').mockImplementation(()=>{});
 expect(()=>workspace.emit('layout-change')).not.toThrow();expect(vault.size()).toBe(0);expect(document.querySelector('.pv-folder-count')).toBeNull();
});

it('updates hover hints without changing accessible counts or recounting',async()=>{
 enable();expect(badge('Books')?.getAttribute('title')).toBe('2 notes, 1 directly in this folder');
 showTooltips=false;feature.refreshDisplay();await settle();expect(badge('Books')?.hasAttribute('title')).toBe(false);expect(badge('Books')?.getAttribute('aria-label')).toBe('2 notes, 1 directly in this folder');expect(vault.getMarkdownFiles).toHaveBeenCalledTimes(1);
});
