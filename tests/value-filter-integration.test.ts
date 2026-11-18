// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
const dialogs = vi.hoisted(() => ({ value: undefined as any, rename: undefined as any, remove: undefined as any }));
vi.mock('obsidian', () => ({
  Plugin: class {}, ItemView: class { contentEl = document.createElement('div'); app: any; constructor(leaf: any) { this.app = leaf.app; } },
  PluginSettingTab: class {}, Modal: class {}, Notice: class {}, TFile: class {}, setIcon() {},
  Menu: class { static items: any[] = []; constructor() { (this.constructor as any).items = []; } addItem(cb: any) { const i: any = { setTitle(t: string) { this.title = t; return this; }, setIcon() { return this; }, onClick(f: any) { this.run = f; return this; } }; cb(i); (this.constructor as any).items.push(i); return this; } showAtMouseEvent() {} }
}));
vi.mock('../src/value-dialog', () => ({ ValueEditModal: class { constructor(_app: any, options: any) { dialogs.value = options; } open() {} } }));
vi.mock('../src/property-rename-dialog', () => ({ PropertyRenameModal: class { constructor(_app: any, options: any) { dialogs.rename = options; } open() {} } }));
vi.mock('../src/property-delete-dialog', () => ({ PropertyDeleteModal: class { constructor(_app: any, options: any) { dialogs.remove = options; } open() {} } }));
import Plugin, { PropertiesView } from '../src/main';
import { PropertyIndex } from '../src/index';
import { ValueEditor } from '../src/value-editor';
import { Menu, TFile } from 'obsidian';

it.each(['value', 'rename', 'remove'])('keeps filtered %s writes and undo inside the subset', async mode => {
  const data: Record<string, any> = {
    'recipe.md': { type: 'recipe', status: 'wip' },
    'other-recipe.md': { type: 'recipe', status: 'done' },
    'task.md': { type: 'task', status: 'wip' },
    'other-task.md': { type: 'task', status: 'archived' }
  };
  const original = structuredClone(data);
  const files = Object.fromEntries(Object.keys(data).map(path => [path, Object.assign(new TFile(), { path })]));
  const index = new PropertyIndex(); for (const [path, fm] of Object.entries(data)) index.update(path, fm);
  const app: any = { vault: { getAbstractFileByPath: (path: string) => files[path] }, metadataCache: { getFileCache: (f: TFile) => ({ frontmatter: data[f.path] }) }, fileManager: { processFrontMatter: async (f: TFile, cb: any) => cb(data[f.path]) } };
  const plugin = new Plugin({} as any, {} as any);
  Object.assign(plugin, { app, index, prefs: { counts: true, sort: 'name', hidden: '', pinned: [], expanded: ['type', 'status'], scope: null, profiles: [] }, typeResolver: { typeFor: () => 'text', iconFor: () => 'text' }, valueEditor: new ValueEditor(app), save: vi.fn(), rebuild: vi.fn() });
  const view = new PropertiesView({ app } as any, plugin); document.body.append(view.contentEl); await view.onOpen();
  const menu = (label: string, action: string) => {
    view.contentEl.querySelector(`[aria-label="${label}"]`)!.dispatchEvent(new MouseEvent('contextmenu'));
    (Menu as any).items.find((item: any) => item.title === action).run();
  };
  menu('Show notes with type: recipe (2)', 'Filter by this value');
  if (mode === 'value') {
    menu('Show notes with status: wip (1)', 'Rename value…');
    expect(dialogs.value.siblings).toEqual(['done']);
    await dialogs.value.apply(dialogs.value.preview({ ...dialogs.value.request, replacement: 'in-progress' }));
    expect(data['recipe.md'].status).toBe('in-progress');
  } else if (mode === 'rename') {
    menu('Toggle status (2)', 'Rename property…');
    await dialogs.rename.apply(dialogs.rename.preview('state'));
    expect(data['recipe.md']).toEqual({ type: 'recipe', state: 'wip' });
    expect(data['other-recipe.md']).toEqual({ type: 'recipe', state: 'done' });
  } else {
    menu('Toggle status (2)', 'Delete property…');
    await dialogs.remove.apply(dialogs.remove.preview());
    expect(data['recipe.md']).toEqual({ type: 'recipe' });
    expect(data['other-recipe.md']).toEqual({ type: 'recipe' });
  }
  expect(data['task.md']).toEqual(original['task.md']);
  expect(data['other-task.md']).toEqual(original['other-task.md']);
  await plugin.valueEditor.undo(); expect(data).toEqual(original);
  await view.onClose(); view.contentEl.remove();
});
