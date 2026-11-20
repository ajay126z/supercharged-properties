// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('obsidian', () => ({
  FuzzySuggestModal: class {},
  Modal: class {},
  Plugin: class {
    app: any; cleanups: Array<() => void> = [];
    loadData = async () => null;
    registerHoverLinkSource() {} registerView() {} addRibbonIcon() {} addCommand() {} addSettingTab() {}
    registerEvent(ref: { off: () => void }) { this.cleanups.push(ref.off); }
    register(fn: () => void) { this.cleanups.push(fn); }
  },
  ItemView: class {}, PluginSettingTab: class {}, Setting: class {}, Menu: class {}, Notice: class {}, TFile: class {}, setIcon() {},
  normalizePath: (path: string) => path.replaceAll('\\', '/')
}));
import Plugin from '../src/main';
import { TFile } from 'obsidian';
function emitter() {
  const listeners = new Map<string, Set<(...args: any[]) => void>>();
  return {
    on(event: string, callback: (...args: any[]) => void) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(callback);
      return { off: () => { listeners.get(event)!.delete(callback); } };
    },
    emit(event: string, ...args: any[]) { for (const callback of listeners.get(event) ?? []) callback(...args); }
  };
}
async function setup(saved: unknown = null, types?: string) {
  vi.useFakeTimers();
  const cache = emitter(); const vault = emitter();
  const plugin = new Plugin({} as any, {} as any);
  const files: any[] = []; const metadata = new Map<string, any>();
  const disk = new Map<string, string>();
  if (types !== undefined) disk.set('.obsidian/types.json', types);
  (plugin as any).app = {
    metadataCache: { ...cache, getFileCache: (file: any) => metadata.get(file.path) },
    vault: {
      ...vault,
      configDir: '.obsidian',
      adapter: {
        exists: async (path: string) => disk.has(path),
        read: async (path: string) => disk.get(path) ?? ''
      },
      getMarkdownFiles: () => files
    },
    workspace: { onLayoutReady: (run: () => void) => run(), getLeavesOfType: () => [] }
  };
  (plugin as any).loadData = async () => saved;
  await plugin.onload(); vi.runAllTimers();
  return { plugin, cache, vault, files, metadata, disk };
}
afterEach(() => { vi.useRealTimers(); });
it('indexes new notes when metadata is ready, updates edits, and removes deleted notes', async () => {
  const { plugin, cache, vault } = await setup();
  const file = Object.assign(new TFile(), { path: 'a.md', extension: 'md' });
  vault.emit('create', file); expect(plugin.index.properties.size).toBe(0);
  cache.emit('changed', file, '', { frontmatter: { status: 'Todo' } });
  expect(plugin.index.properties.get('status')!.paths.has('a.md')).toBe(true);
  cache.emit('changed', file, '', { frontmatter: { due: 'today' } });
  expect(plugin.index.properties.has('status')).toBe(false);
  vault.emit('delete', file); expect(plugin.index.properties.size).toBe(0);
});
it('coalesces metadata and folder rebuild events', async () => {
  const { plugin, cache, vault } = await setup();
  const rebuild = vi.spyOn(plugin, 'rebuild');
  cache.emit('resolved'); cache.emit('resolved'); vault.emit('rename', {}, 'Folder');
  expect(rebuild).not.toHaveBeenCalled(); vi.advanceTimersByTime(150);
  expect(rebuild).toHaveBeenCalledOnce();
});
it('cancels queued work and unregisters events on unload', async () => {
  const { plugin, cache } = await setup();
  const rebuild = vi.spyOn(plugin, 'rebuild'); const refresh = vi.spyOn(plugin, 'refresh');
  cache.emit('resolved');
  for (const cleanup of (plugin as any).cleanups) cleanup();
  vi.runAllTimers();
  expect(rebuild).not.toHaveBeenCalled(); expect(refresh).not.toHaveBeenCalled();
});
it('loads configured property types during startup', async () => {
  const { plugin } = await setup(null, JSON.stringify({ types: { rating: 'number', due: 'date' } }));
  expect(plugin.typeResolver.typeFor({ id: 'rating' })).toBe('number');
  expect(plugin.typeResolver.iconFor({ id: 'rating' })).toBe('hash');
  expect(plugin.typeResolver.iconFor({ id: 'due' })).toBe('calendar');
});

it('restores profiles and the active selection when the plugin loads', async () => {
  const { plugin } = await setup({
    profiles: [{ id: 'writing', name: 'Writing View', keys: ['status', 'deadline', 'word_count'] }],
    activeProfile: 'writing', scope: ['status', 'deadline', 'word_count']
  });
  expect(plugin.prefs.activeProfile).toBe('writing');
  expect(plugin.prefs.scope).toEqual(['status', 'deadline', 'word_count']);
  expect(plugin.prefs.profiles[0].name).toBe('Writing View');
});
it('loads older settings without requiring profiles and ignores a stale active profile', async () => {
  const { plugin } = await setup({ scope: ['status'], activeProfile: 'missing' });
  expect(plugin.prefs.profiles).toEqual([]);
  expect(plugin.prefs.activeProfile).toBeNull();
  expect(plugin.prefs.scope).toEqual(['status']);
});
it('serializes settings snapshots so rapid changes persist in order', async () => {
  const { plugin } = await setup();
  let releaseFirst!: () => void;
  const firstWrite = new Promise<void>(resolve => { releaseFirst = resolve; });
  const saveData = vi.fn().mockImplementationOnce(() => firstWrite).mockResolvedValue(undefined);
  (plugin as any).saveData = saveData;
  plugin.prefs.scope = ['status']; const first = plugin.save();
  plugin.prefs.scope = ['deadline']; const second = plugin.save();
  await Promise.resolve();
  expect(saveData).toHaveBeenCalledTimes(1);
  expect(saveData.mock.calls[0][0].scope).toEqual(['status']);
  releaseFirst(); await first; await second;
  expect(saveData.mock.calls[1][0].scope).toEqual(['deadline']);
});
it('recovers the settings save queue after a failed write', async () => {
  const { plugin } = await setup();
  const saveData = vi.fn().mockRejectedValueOnce(new Error('disk full')).mockResolvedValue(undefined);
  (plugin as any).saveData = saveData;
  await expect(plugin.save()).resolves.toBeUndefined();
  await plugin.save();
  expect(saveData).toHaveBeenCalledTimes(2);
});
it('treats malformed settings roots as defaults', async () => {
  const { plugin } = await setup('not a settings object');
  expect(plugin.prefs.scope).toBeNull();
  expect(plugin.prefs.profiles).toEqual([]);
});
it('excludes configured folders on rebuild, create, and metadata changes without excluding similar prefixes', async () => {
  const { plugin, files, metadata, cache, vault } = await setup({ excludedFolders: 'Templates' });
  for (const path of ['Templates/A.md', 'Templates/Nested/B.md', 'Templates Archive/C.md', 'D.md']) {
    const file = Object.assign(new TFile(), { path, extension: 'md' }); files.push(file);
    metadata.set(path, { frontmatter: { status: 'doing' } });
    vault.emit('create', file); cache.emit('changed', file, '', metadata.get(path));
  }
  expect([...plugin.index.properties.get('status')!.paths]).toEqual(['Templates Archive/C.md', 'D.md']);
  plugin.rebuild();
  expect(plugin.index.properties.get('status')!.paths.size).toBe(2);
});
it('reindexes immediately when exclusions change and persists the setting', async () => {
  const { plugin, files, metadata } = await setup();
  const file = Object.assign(new TFile(), { path: 'Templates/A.md', extension: 'md' }); files.push(file);
  metadata.set(file.path, { frontmatter: { template: true } }); plugin.rebuild();
  const save = vi.fn().mockResolvedValue(undefined); (plugin as any).saveData = save;
  await plugin.setExcludedFolders('Templates'); expect(plugin.index.properties.size).toBe(0);
  expect(save.mock.calls[0][0].excludedFolders).toBe('Templates');
  await plugin.setExcludedFolders(''); expect(plugin.index.properties.has('template')).toBe(true);
});
it('handles notes moving into and out of excluded folders and folder renames', async () => {
  const { plugin, vault, files, metadata } = await setup({ excludedFolders: 'Templates' });
  const file = Object.assign(new TFile(), { path: 'A.md', extension: 'md' }); files.push(file);
  const cache = { frontmatter: { status: 'doing' } };
  metadata.set('A.md', cache); metadata.set('Templates/A.md', cache); plugin.rebuild();
  file.path = 'Templates/A.md'; vault.emit('rename', file, 'A.md'); expect(plugin.index.properties.size).toBe(0);
  file.path = 'A.md'; vault.emit('rename', file, 'Templates/A.md'); expect(plugin.index.properties.get('status')!.paths.has('A.md')).toBe(true);
  file.path = 'Templates/A.md'; vault.emit('rename', {}, 'OldFolder'); vi.advanceTimersByTime(150);
  expect(plugin.index.properties.size).toBe(0);
});
it('defaults malformed or absent excluded folder settings to include everything', async () => {
  const { plugin } = await setup({ excludedFolders: ['Templates'] });
  expect(plugin.prefs.excludedFolders).toBe(''); expect(plugin.includesPath('Templates/A.md')).toBe(true);
});


it('keeps one author path after repeated metadata updates and note renames', async () => {
  const { plugin, vault, cache, files, metadata } = await setup();
  const file = Object.assign(new TFile(), { path: 'Note-A.md', extension: 'md' });
  const entry = { frontmatter: { author: 'AJ', rating: 4, topic: 'design' } };
  files.push(file); metadata.set(file.path, entry);
  vault.emit('create', file);
  cache.emit('changed', file, '', entry); cache.emit('changed', file, '', entry);
  const paths = () => [...plugin.index.properties.get('author')!.values.values()][0].paths;
  expect(paths()).toEqual(new Set(['Note-A.md']));
  for (const next of ['Renamed.md', 'Projects/Renamed.md']) {
    const old = file.path;
    file.path = next; metadata.delete(old); metadata.set(next, entry);
    // Cache updates can arrive before the vault rename event.
    cache.emit('changed', file, '', entry);
    vault.emit('rename', file, old);
    cache.emit('changed', file, '', entry);
    expect(paths()).toEqual(new Set([next]));
    for (const property of plugin.index.properties.values()) {
      expect(property.paths.has(old)).toBe(false);
      for (const value of property.values.values()) expect(value.paths.has(old)).toBe(false);
    }
  }
  plugin.rebuild(); expect(paths()).toEqual(new Set(['Projects/Renamed.md']));
});
it('enables inline body indexing separately, updates from metadata text, handles renames and disables reads', async () => {
 const {plugin,cache,vault,files,metadata}=await setup();
 const note=Object.assign(new TFile(),{path:'A.md',extension:'md',stat:{mtime:1,size:20}});files.push(note);metadata.set('A.md',{frontmatter:{author:'YAML'}});
 const read=vi.fn(async()=> 'author:: Inline\n[topic:: design]');(plugin as any).app.vault.cachedRead=read;(plugin as any).saveData=vi.fn();
 expect(plugin.prefs.showInlineProperties).toBe(false);plugin.rebuild();expect(read).not.toHaveBeenCalled();
 await plugin.setShowInlineProperties(true);await Promise.resolve();
 expect([...plugin.inline.index.properties.get('author')!.values.values()][0].label).toBe('Inline');
 expect([...plugin.index.properties.get('author')!.values.values()][0].label).toBe('YAML');
 cache.emit('changed',note,'author:: New',{frontmatter:{author:'YAML'}});
 expect([...plugin.inline.index.properties.get('author')!.values.values()][0].label).toBe('New');
 note.path='Projects/B.md';metadata.set('Projects/B.md',{frontmatter:{author:'YAML'}});vault.emit('rename',note,'A.md');await Promise.resolve();await Promise.resolve();
 expect(plugin.inline.index.properties.get('author')!.paths).toEqual(new Set(['Projects/B.md']));
 await plugin.setExcludedFolders('Projects');
 expect(plugin.inline.index.properties.size).toBe(0);
 await plugin.setShowInlineProperties(false);const reads=read.mock.calls.length;vault.emit('modify',note);expect(read).toHaveBeenCalledTimes(reads);
 expect(plugin.inline.index.properties.size).toBe(0);
});

it('persists inline view settings separately from YAML view settings', async () => {
  const inlineViews={profiles:[{id:'inline-a',name:'Reading',keys:['author']}],scope:['author'],activeProfile:'inline-a'};
  const {plugin}=await setup({inlineViews, profiles:[{id:'yaml-a',name:'Reading',keys:['status']}],scope:['status'],activeProfile:'yaml-a'});
  expect(plugin.prefs.inlineViews).toEqual(inlineViews);
  const saveData=vi.fn().mockResolvedValue(undefined);(plugin as any).saveData=saveData;
  await plugin.save();
  expect(saveData.mock.calls[0][0].inlineViews).toEqual(inlineViews);
  expect(saveData.mock.calls[0][0].scope).toEqual(['status']);
  const restored=await setup(saveData.mock.calls[0][0]);
  expect(restored.plugin.prefs.inlineViews).toEqual(inlineViews);
});

it('defaults tooltips to enabled and restores the disabled preference', async () => {
  expect((await setup()).plugin.prefs.showTooltips).toBe(true);
  const {plugin}=await setup({showTooltips:false});
  expect(plugin.prefs.showTooltips).toBe(false);
  const saveData=vi.fn().mockResolvedValue(undefined);(plugin as any).saveData=saveData;
  await plugin.save();expect(saveData.mock.calls[0][0].showTooltips).toBe(false);
});

it('loads and saves independent view pin overrides without changing legacy global pins', async () => {
  const {plugin}=await setup({pinned:['tags'],profiles:[{id:'books',name:'Books',keys:['status'],pinOverrides:{Status:true,TAGS:false,bad:'yes'}}],customPinOverrides:{Rating:true}});
  expect(plugin.prefs.pinned).toEqual(['tags']);
  expect(plugin.prefs.profiles[0].pinOverrides).toEqual({status:true,tags:false});
  expect(plugin.prefs.customPinOverrides).toEqual({rating:true});
  const saveData=vi.fn().mockResolvedValue(undefined);(plugin as any).saveData=saveData;await plugin.save();
  const restored=await setup(saveData.mock.calls[0][0]);expect(restored.plugin.prefs.profiles).toEqual(plugin.prefs.profiles);
  expect(restored.plugin.prefs.customPinOverrides).toEqual({rating:true});
});

it('persists normalized folder selections through saveQueue for YAML and Inline sources',async()=>{
 const {plugin}=await setup({folders:['/Books/','Books/Sub','Other'],profiles:[{id:'books',name:'Books',keys:['status'],folders:['Books/Sub','Books']}],inlineViews:{folders:['Inline/Sub','Inline'],profiles:[{id:'inline',name:'Inline',keys:['author'],folders:['Inline']}],scope:['author'],activeProfile:'inline'}});
 expect(plugin.prefs.folders).toEqual(['Books','Other']);expect(plugin.prefs.profiles[0].folders).toEqual(['Books']);expect(plugin.prefs.inlineViews.folders).toEqual(['Inline']);
 const saved:any[]=[];(plugin as any).saveData=vi.fn(async data=>{saved.push(data);});
 const first=plugin.save();plugin.prefs.folders=['Changed'];const second=plugin.save();await Promise.all([first,second]);
 expect(saved[0].folders).toEqual(['Books','Other']);expect(saved[1].folders).toEqual(['Changed']);expect(saved[1].inlineViews.folders).toEqual(['Inline']);
});
it('retains stale include paths on folder rename/delete and lets exclusions win at index time',async()=>{
 const {plugin,vault,cache,files,metadata}=await setup({folders:['Books'],excludedFolders:'Books/Templates',profiles:[{id:'books',name:'Books',keys:['status'],folders:['Books']}],inlineViews:{folders:['Books']}});
 const note=Object.assign(new TFile(),{path:'Books/A.md',extension:'md'}),excluded=Object.assign(new TFile(),{path:'Books/Templates/T.md',extension:'md'});files.push(note,excluded);metadata.set(note.path,{frontmatter:{status:'active'}});metadata.set(excluded.path,{frontmatter:{status:'active'}});plugin.rebuild();
 expect(plugin.index.paths()).toEqual(new Set(['Books/A.md']));cache.emit('changed',excluded,'',{frontmatter:{status:'active'}});expect(plugin.index.paths()).toEqual(new Set(['Books/A.md']));
 note.path='Library/A.md';metadata.set(note.path,{frontmatter:{status:'active'}});vault.emit('rename',{path:'Library'},'Books');await vi.advanceTimersByTimeAsync(151);
 expect(plugin.index.paths()).toEqual(new Set(['Library/A.md']));expect(plugin.prefs.folders).toEqual(['Books']);expect(plugin.prefs.profiles[0].folders).toEqual(['Books']);expect(plugin.prefs.inlineViews.folders).toEqual(['Books']);expect(plugin.prefs.excludedFolders).toBe('Books/Templates');
 files.splice(0,files.length);vault.emit('delete',{path:'Library'});await vi.advanceTimersByTimeAsync(151);expect(plugin.index.paths().size).toBe(0);expect(plugin.prefs.folders).toEqual(['Books']);
});
