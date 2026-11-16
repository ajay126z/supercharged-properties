import { expect, it, vi } from 'vitest';
vi.mock('obsidian', () => ({ TFile: class { constructor(public path: string) {} } }));
import { App, TFile } from 'obsidian';
import { ValueEditor } from '../src/value-editor';
import { previewValue, type ValueEditRequest } from '../src/value-operations';
const request: ValueEditRequest = { property: 'status', kind: 'string', value: 'doing', mode: 'rename', replacement: 'active' };
function setup(includesPath?: (path: string) => boolean) {
  const data: Record<string, any> = { 'a.md': { status: 'doing', other: 1 }, 'b.md': { status: ['doing', 'active'] } };
  const files = Object.fromEntries(Object.keys(data).map(path => [path, Object.assign(new TFile(), { path })]));
  const app = { vault: { getAbstractFileByPath: (path: string) => files[path] }, metadataCache: { getFileCache: (file: TFile) => ({ frontmatter: data[file.path] }) }, fileManager: { processFrontMatter: vi.fn(async (file: TFile, callback: any) => { const next = structuredClone(data[file.path]); callback(next); data[file.path] = next; }) } };
  return { data, app, editor: new ValueEditor(app as unknown as App, includesPath) };
}
it('previews without writes, applies and restores a batch while preserving other properties', async () => {
  const { data, app, editor } = setup();
  const preview = editor.preview(request, Object.keys(data));
  expect(preview.total).toBe(2); expect(app.fileManager.processFrontMatter).not.toHaveBeenCalled();
  expect((await editor.apply(preview)).updated).toBe(2);
  expect(data['b.md'].status).toEqual(['active']);
  data['a.md'].other = 2;
  expect((await editor.undo()).restored).toBe(2);
  expect(data['a.md']).toEqual({ status: 'doing', other: 2 });
  expect(data['b.md'].status).toEqual(['doing', 'active']);
  expect(editor.canUndo()).toBe(false);
});
it('skips stale preview values and preserves later edits during undo', async () => {
  const { data, editor } = setup();
  const preview = editor.preview(request, Object.keys(data));
  data['a.md'].status = 'done';
  expect(await editor.apply(preview)).toMatchObject({ updated: 1, unchanged: 1 });
  data['b.md'].status = ['later'];
  expect(await editor.undo()).toMatchObject({ restored: 0, skipped: 1 });
  expect(data['b.md'].status).toEqual(['later']);
  expect(editor.canUndo()).toBe(true);
});
it('retains undo for successful writes after partial failures and permits retrying undo', async () => {
  const { data, app, editor } = setup();
  app.fileManager.processFrontMatter.mockRejectedValueOnce(new Error('disk full'));
  expect(await editor.apply(editor.preview(request, Object.keys(data)))).toMatchObject({ updated: 1, failures: [{ path: 'a.md', message: 'disk full' }] });
  app.fileManager.processFrontMatter.mockRejectedValueOnce(new Error('busy'));
  expect((await editor.undo()).failures).toHaveLength(1);
  expect(editor.canUndo()).toBe(true);
  expect((await editor.undo()).restored).toBe(1);
});
it('prevents overlapping writes', async () => {
  const { data, app, editor } = setup();
  let release!: () => void;
  app.fileManager.processFrontMatter.mockImplementationOnce(async () => new Promise<void>(resolve => { release = resolve; }));
  const preview = editor.preview(request, Object.keys(data));
  const pending = editor.apply(preview);
  await expect(editor.apply(preview)).rejects.toThrow('running');
  await expect(editor.undo()).rejects.toThrow('running');
  release(); await pending;
});
it('keeps types distinct and normalizes matching', () => {
  expect(previewValue([' DOING ', false, 1], request).value).toEqual(['active', false, 1]);
  expect(previewValue(false, { ...request, value: 'false' }).changed).toBe(0);
});
it('converts plain strings to links but skips links and invalid bracket text', () => {
  for (const text of ['[[Topic]]', 'bad[link', 'a\nb']) expect(previewValue(text, { ...request, value: text, mode: 'wikilink' }).changed).toBe(0);
  expect(previewValue('Topic', { ...request, value: 'Topic', mode: 'wikilink' }).value).toBe('[[Topic]]');
});
it('splits only scalar text, trims parts and omits blanks', () => {
  const split = { ...request, value: 'a, b,,c', mode: 'split' as const, delimiter: ',' };
  expect(previewValue('a, b,,c', split).value).toEqual(['a', 'b', 'c']);
  expect(previewValue(['a, b,,c'], split).changed).toBe(0);
});

it('excludes notes from both previews and rechecks exclusions before applying an older preview', async () => {
  let excluded = false;
  const { editor, data } = setup(path => !(excluded && path === 'a.md'));
  const plan = editor.preview(request, Object.keys(data));
  excluded = true;
  expect(editor.preview(request, Object.keys(data)).total).toBe(1);
  expect(editor.previewPropertyRename('status', 'state', Object.keys(data)).total).toBe(1);
  expect(await editor.apply(plan)).toMatchObject({ updated: 1, unchanged: 1 });
  expect(data['a.md'].status).toBe('doing');
});
it('keeps undo available for a previous edit even after its folder is excluded', async () => {
  let included = true;
  const { editor, data } = setup(() => included);
  await editor.apply(editor.preview(request, ['a.md']));
  included = false;
  expect((await editor.undo()).restored).toBe(1);
  expect(data['a.md'].status).toBe('doing');
});
it('deletes scalar keys and matching list entries, then restores them', async () => {
  const { data, editor } = setup();
  const remove = { ...request, mode: 'delete' as const };
  const preview = editor.preview(remove, Object.keys(data));
  expect(preview.total).toBe(2);
  expect(preview.changes.find(change => change.path === 'a.md')).toMatchObject({ remove: true, after: '(removed)' });
  expect(preview.changes.find(change => change.path === 'b.md')).toMatchObject({ remove: false, after: '["active"]' });
  await editor.apply(preview);
  expect(data['a.md']).toEqual({ other: 1 });
  expect(data['b.md']).toEqual({ status: ['active'] });
  expect((await editor.undo()).restored).toBe(2);
  expect(data['a.md']).toEqual({ status: 'doing', other: 1 });
  expect(data['b.md']).toEqual({ status: ['doing', 'active'] });
});
it('removes nested list entries, prunes emptied lists, and drops a property when no values remain', async () => {
  const { data, editor } = setup();
  data['a.md'] = { tags: ['x', ['y', 'x'], []] };
  data['b.md'] = { tags: [['x']] };
  const preview = editor.preview({ property: 'tags', kind: 'string', value: 'x', mode: 'delete' }, ['a.md', 'b.md']);
  expect(preview.total).toBe(2);
  await editor.apply(preview);
  expect(data['a.md']).toEqual({ tags: [['y'], []] });
  expect(data['b.md']).toEqual({});
  await editor.undo();
  expect(data['a.md']).toEqual({ tags: ['x', ['y', 'x'], []] });
  expect(data['b.md']).toEqual({ tags: [['x']] });
});
it('skips stale values before deleting and refuses to overwrite recreated keys during undo', async () => {
  const { data, editor } = setup();
  const remove = { ...request, mode: 'delete' as const };
  const preview = editor.preview(remove, Object.keys(data));
  data['a.md'].status = 'done';
  expect(await editor.apply(preview)).toMatchObject({ updated: 1, unchanged: 1 });
  expect(data['a.md'].status).toBe('done');
  data['b.md'].status = ['later'];
  expect(await editor.undo()).toMatchObject({ restored: 0, skipped: 1 });
  expect(data['b.md'].status).toEqual(['later']);
  expect(editor.canUndo()).toBe(true);
});
it('retries a skipped scalar deletion only after the recreated key is removed again', async () => {
  const { data, editor } = setup();
  await editor.apply(editor.preview({ ...request, mode: 'delete' }, ['a.md']));
  data['a.md'].Status = 'recreated';
  expect(await editor.undo()).toMatchObject({ restored: 0, skipped: 1 });
  expect(data['a.md']).toEqual({ other: 1, Status: 'recreated' });
  delete data['a.md'].Status;
  expect((await editor.undo()).restored).toBe(1);
  expect(data['a.md']).toEqual({ status: 'doing', other: 1 });
});
it('does not delete empty or object values', () => {
  expect(previewValue(null, { ...request, kind: 'empty', mode: 'delete' }).changed).toBe(0);
  expect(previewValue({ nested: 1 }, { ...request, mode: 'delete' }).changed).toBe(0);
});

it.each(['doing', ['doing'], [['doing']]])('omits ambiguous whole-key value deletion from preview: %j', async original => {
  const { data, editor } = setup();
  data['a.md'] = { status: original, Status: 'keep' };
  const preview = editor.preview({ ...request, mode: 'delete' }, ['a.md']);
  expect(preview.total).toBe(0);
  expect((await editor.apply(preview)).updated).toBe(0);
  expect(data['a.md']).toEqual({ status: original, Status: 'keep' });
});
it.each(['doing', ['doing']])('skips whole-key value deletion if ambiguity appears after preview: %j', async original => {
  const { data, editor } = setup();
  data['a.md'] = { status: original };
  const preview = editor.preview({ ...request, mode: 'delete' }, ['a.md', 'b.md']);
  data['a.md'].Status = 'keep';
  expect(await editor.apply(preview)).toMatchObject({ updated: 1, unchanged: 1 });
  expect(data['a.md']).toEqual({ status: original, Status: 'keep' });
  expect(await editor.undo()).toMatchObject({ restored: 1, skipped: 0 });
  expect(data['b.md'].status).toEqual(['doing', 'active']);
});
it('can still delete part of a list and undo with a pre-existing case variant', async () => {
  const { data, editor } = setup();
  data['b.md'].Status = 'keep';
  expect((await editor.apply(editor.preview({ ...request, mode: 'delete' }, ['b.md']))).updated).toBe(1);
  expect(data['b.md']).toEqual({ status: ['active'], Status: 'keep' });
  expect(await editor.undo()).toMatchObject({ restored: 1, skipped: 0 });
  expect(data['b.md']).toEqual({ status: ['doing', 'active'], Status: 'keep' });
});
