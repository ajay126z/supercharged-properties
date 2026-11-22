import { expect, it, vi } from 'vitest';
vi.mock('obsidian', () => ({
  AbstractInputSuggest: class {close(){}}, TFolder: class {},
  FuzzySuggestModal: class {},
  Plugin: class {}, ItemView: class {}, PluginSettingTab: class {},
  Modal: class {}, Notice: class {}, TFile: class {}
}));
const dialog = vi.hoisted(() => ({ options: undefined as any }));
vi.mock('../src/property-delete-dialog', () => ({ PropertyDeleteModal: class {
  constructor(_app: unknown, options: unknown) { dialog.options = options; }
  open() {}
} }));
import Plugin from '../src/main';
import { ValueEditor } from '../src/value-editor';
import { PropertyIndex } from '../src/index';
import { TFile } from 'obsidian';

it('preserves saved views and selection through property deletion and undo', async () => {
  const plugin = new Plugin({} as any, {} as any);
  const file = Object.assign(new TFile(), { path: 'a.md' });
  let data: Record<string, unknown> = { status: 'doing', other: 'keep' };
  const app = {
    vault: { getAbstractFileByPath: () => file },
    metadataCache: { getFileCache: () => ({ frontmatter: data }) },
    fileManager: { processFrontMatter: async (_file: unknown, callback: any) => {
      const next = structuredClone(data); callback(next); data = next;
    } }
  };
  const prefs = {
    scope: ['status'], pinned: ['status'], expanded: ['status'], hidden: 'secret',
    profiles: [{ id: 'one', name: 'Status only', keys: ['status'] }], activeProfile: 'one'
  };
  const original = structuredClone(prefs);
  const index = new PropertyIndex();
  const rebuild = () => index.update(file.path, data);
  rebuild();
  Object.assign(plugin, { app, prefs, index, valueEditor: new ValueEditor(app as any), rebuild, save: vi.fn() });
  plugin.deleteProperty(index.properties.get('status')!);
  await dialog.options.apply(dialog.options.preview());
  expect(data).toEqual({ other: 'keep' });
  expect(index.properties.has('status')).toBe(false);
  expect(plugin.prefs).toEqual(original);
  await plugin.undoValueEdit();
  expect(data).toEqual({ status: 'doing', other: 'keep' });
  expect(index.properties.has('status')).toBe(true);
  expect(plugin.prefs).toEqual(original);
  expect(plugin.save).not.toHaveBeenCalled();
});
