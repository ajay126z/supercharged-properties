import { expect, it, vi } from 'vitest';
vi.mock('obsidian', () => ({ Plugin: class {}, ItemView: class {}, PluginSettingTab: class {}, Modal: class {}, Notice: class {}, TFile: class {} }));
const dialog = vi.hoisted(() => ({ options: undefined as any }));
vi.mock('../src/note-value-dialog', () => ({ NoteValueModal: class {
  constructor(_app: unknown, options: unknown) { dialog.options = options; }
  open() {}
} }));
import Plugin from '../src/main';
import { ValueEditor } from '../src/value-editor';
import { PropertyIndex } from '../src/index';
import { TFile } from 'obsidian';
it('wires only the selected property and paths into the dialog, type recheck and shared undo', async () => {
  const plugin = new Plugin({} as any, {} as any);
  const data: Record<string, any> = { 'a.md': { status: 'active', author: 'Ada' }, 'b.md': { status: 'todo' } };
  const files = Object.fromEntries(Object.keys(data).map(path => [path, Object.assign(new TFile(), { path })]));
  const app = {
    vault: { getAbstractFileByPath: (path: string) => files[path] },
    metadataCache: { getFileCache: (file: TFile) => ({ frontmatter: data[file.path] }) },
    fileManager: { processFrontMatter: async (file: TFile, callback: any) => { const next = structuredClone(data[file.path]); callback(next); data[file.path] = next; } }
  };
  let text = true;
  const index = new PropertyIndex();
  for (const [path, value] of Object.entries(data)) index.update(path, value);
  const load = vi.fn(async () => {});
  Object.assign(plugin, { app, index, valueEditor: new ValueEditor(app as any, () => true, () => text ? 'text' : 'number'), typeResolver: { typeFor: () => text ? 'text' : 'number', load }, rebuild: vi.fn() });
  const complete = vi.fn();
  plugin.changeNoteValue(index.properties.get('status')!, ['a.md', 'a.md'], complete);
  expect(dialog.options.values).toEqual(['active', 'todo']);
  expect(dialog.options.count).toBe(1);
  const plan = dialog.options.preview({ type: 'text', mode: 'set', value: 'closed' });
  expect(plan.changes.map((change: any) => change.path)).toEqual(['a.md']);
  await dialog.options.apply(plan);
  expect(load).toHaveBeenCalledOnce(); expect(complete).toHaveBeenCalledOnce();
  expect(data).toEqual({ 'a.md': { status: 'closed', author: 'Ada' }, 'b.md': { status: 'todo' } });
  await plugin.undoValueEdit(); expect(data['a.md'].status).toBe('active');
  const stale = dialog.options.preview({ type: 'text', mode: 'set', value: 'closed' });
  load.mockImplementationOnce(async () => { text = false; });
  await dialog.options.apply(stale);
  expect(data['a.md'].status).toBe('active');
});
