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

it('assigns a text value only to selected notes with mixed originals, preserving keys and undo', async () => {
  const { data, editor } = setup();
  data['a.md'] = { Status: 'todo', other: 1 };
  data['b.md'] = { status: null };
  const preview = editor.previewNoteValue('status', 'closed', ['a.md', 'b.md', 'a.md']);
  expect(preview).toMatchObject({ total: 2, unchanged: 0, conflicts: [] });
  expect((await editor.apply(preview)).updated).toBe(2);
  expect(data['a.md']).toEqual({ Status: 'closed', other: 1 });
  expect(data['b.md']).toEqual({ status: 'closed' });
  expect((await editor.undo()).restored).toBe(2);
  expect(data['a.md']).toEqual({ Status: 'todo', other: 1 });
  expect(data['b.md']).toEqual({ status: null });
  await editor.apply(editor.previewNoteValue('status', 'new', ['a.md']));
  expect(data['b.md']).toEqual({ status: null });
});
it('sets empty without removing the key and distinguishes literal empty text', async () => {
  const { data, editor } = setup();
  await editor.apply(editor.previewNoteValue('status', null, ['a.md']));
  expect(data['a.md']).toEqual({ status: null, other: 1 });
  expect(editor.previewNoteValue('status', null, ['a.md'])).toMatchObject({ total: 0, unchanged: 1 });
  await editor.undo();
  expect(data['a.md'].status).toBe('doing');
  await editor.apply(editor.previewNoteValue('status', 'empty', ['a.md']));
  expect(data['a.md'].status).toBe('empty');
});
it.each([[], ['doing'], 5, false, { key: 'value' }])('does not replace unsupported values: %j', original => {
  const { data, editor } = setup();
  data['a.md'].status = original;
  expect(editor.previewNoteValue('status', 'closed', ['a.md'])).toMatchObject({ total: 0, conflicts: [{ path: 'a.md' }] });
});
it('reports excluded, missing and ambiguous assignments and skips newly stale keys', async () => {
  const { data, editor } = setup(path => path !== 'b.md');
  expect(editor.previewNoteValue('status', 'closed', ['b.md', 'missing'])).toMatchObject({ total: 0, conflicts: [{ path: 'b.md' }, { path: 'missing' }] });
  data['a.md'].Status = 'other';
  expect(editor.previewNoteValue('status', 'closed', ['a.md']).conflicts[0].message).toContain('Ambiguous');
  delete data['a.md'].Status;
  let preview = editor.previewNoteValue('status', 'closed', ['a.md']);
  data['a.md'].Status = 'other';
  expect(await editor.apply(preview)).toMatchObject({ updated: 0, unchanged: 1 });
  delete data['a.md'].Status;
  preview = editor.previewNoteValue('status', 'closed', ['a.md']);
  data['a.md'].status = 'later';
  expect(await editor.apply(preview)).toMatchObject({ updated: 0, unchanged: 1 });
  delete data['a.md'].status;
  expect(editor.previewNoteValue('status', 'closed', ['a.md']).conflicts[0].message).toContain('missing');
});
it('rechecks type and folder eligibility before assigning and preserves prior undo on zero writes', async () => {
  const { data, app } = setup();
  let text = true, included = true;
  const editor = new ValueEditor(app as any, () => included, () => text ? 'text' : undefined);
  await editor.apply(editor.previewNoteValue('status', 'active', ['a.md']));
  let preview = editor.previewNoteValue('status', 'closed', ['a.md']);
  text = false;
  expect(await editor.apply(preview)).toMatchObject({ updated: 0, unchanged: 1 });
  expect(editor.previewNoteValue('status', 'closed', ['a.md']).conflicts).toHaveLength(1);
  text = true;
  preview = editor.previewNoteValue('status', 'closed', ['a.md']);
  included = false;
  expect(await editor.apply(preview)).toMatchObject({ updated: 0, unchanged: 1 });
  expect((await editor.undo()).restored).toBe(1);
  expect(data['a.md'].status).toBe('doing');
});

it.each([
  ['number', 3, -2.5], ['checkbox', true, false], ['date', '2026-01-01', '2026-12-31'],
  ['datetime', '2026-01-01T08:00', '2026-12-31T23:59:30']
] as const)('applies and undoes selected-note %s values without string coercion', async (type, original, value) => {
  const { data, app } = setup(); data['a.md'] = { status: original, other: 'keep' };
  const editor = new ValueEditor(app as any, () => true, () => type);
  const plan = editor.previewNoteEdit('status', { type, mode: 'set', value }, ['a.md']);
  expect(plan).toMatchObject({ total: 1, conflicts: [] });
  expect((await editor.apply(plan)).updated).toBe(1);
  expect(data['a.md']).toEqual({ status: value, other: 'keep' });
  expect((await editor.undo()).restored).toBe(1);
  expect(data['a.md'].status).toBe(original);
  await editor.apply(editor.previewNoteEdit('status', { type, mode: 'set', value: null }, ['a.md']));
  expect(data['a.md'].status).toBeNull(); await editor.undo(); expect(data['a.md'].status).toBe(original);
});
it('calculates list edits per note, skips no-ops, preserves unselected notes, and restores exact arrays', async () => {
  const { data, app } = setup();
  data['a.md'] = { status: ['a', 'b', 'a'] }; data['b.md'] = { status: ['b', 'c'] };
  const editor = new ValueEditor(app as any, () => true, () => 'list');
  const remove = editor.previewNoteEdit('status', { type: 'list', mode: 'remove', values: ['a'] }, ['a.md', 'b.md', 'a.md']);
  expect(remove).toMatchObject({ total: 1, unchanged: 1 });
  await editor.apply(remove); expect(data['a.md'].status).toEqual(['b']); expect(data['b.md'].status).toEqual(['b', 'c']);
  await editor.undo(); expect(data['a.md'].status).toEqual(['a', 'b', 'a']);
  await editor.apply(editor.previewNoteEdit('status', { type: 'list', mode: 'add', values: ['a', 'd'] }, ['a.md', 'b.md']));
  expect(data['a.md'].status).toEqual(['a', 'b', 'a', 'd']); expect(data['b.md'].status).toEqual(['b', 'c', 'a', 'd']);
  await editor.undo(); expect(data['a.md'].status).toEqual(['a', 'b', 'a']); expect(data['b.md'].status).toEqual(['b', 'c']);
});
it('snapshots list previews and rejects subsequent array mutation, ambiguity, or configured-type changes', async () => {
  const { data, app } = setup(); data['a.md'] = { status: ['a'] };
  let type: 'list' | 'text' = 'list';
  const editor = new ValueEditor(app as any, () => true, () => type);
  const request = { type: 'list' as const, mode: 'add' as const, values: ['b'] };
  const plan = editor.previewNoteEdit('status', request, ['a.md']); data['a.md'].status.push('later');
  expect(await editor.apply(plan)).toMatchObject({ updated: 0, unchanged: 1 });
  const next = editor.previewNoteEdit('status', request, ['a.md']); data['a.md'].Status = ['other'];
  expect(await editor.apply(next)).toMatchObject({ updated: 0, unchanged: 1 });
  delete data['a.md'].Status; type = 'text';
  expect(await editor.apply(next)).toMatchObject({ updated: 0, unchanged: 1 });
});
it('keeps successful list writes undoable after partial failures and protects later edits', async () => {
  const { data, app } = setup(); data['a.md'] = { status: [] }; data['b.md'] = { status: ['a'] };
  const editor = new ValueEditor(app as any, () => true, () => 'list');
  app.fileManager.processFrontMatter.mockRejectedValueOnce(new Error('write failed'));
  expect(await editor.apply(editor.previewNoteEdit('status', { type: 'list', mode: 'remove', values: ['a'] }, ['b.md', 'a.md']))).toMatchObject({ updated: 0 });
  app.fileManager.processFrontMatter.mockRejectedValueOnce(new Error('write failed'));
  expect(await editor.apply(editor.previewNoteEdit('status', { type: 'list', mode: 'add', values: ['b'] }, ['a.md', 'b.md']))).toMatchObject({ updated: 1, failures: [{ path: 'a.md' }] });
  data['b.md'].status.push('later'); expect(await editor.undo()).toMatchObject({ restored: 0, skipped: 1 });
  data['b.md'].status.pop(); expect((await editor.undo()).restored).toBe(1); expect(data['b.md'].status).toEqual(['a']);
});

it.each([
  ['text', 'active'], ['text', ''], ['text', null], ['number', 0], ['checkbox', false],
  ['date', '2026-11-16'], ['datetime', '2026-11-16T10:30'],
  ['list', ['one']], ['list', ['one', 'two', 3]], ['list', []], ['list', null],
  ['list', ['one', { nested: 'object' }]]
] as const)('removes the entire selected %s property and undoes its exact stored value: %j', async (type, original) => {
  const { data, app } = setup(); data['a.md'] = { Status: structuredClone(original), other: 'keep' };
  const unselected = structuredClone(data['b.md']);
  const editor = new ValueEditor(app as any, () => true, () => type);
  const plan = editor.previewNoteEdit('status', { type, mode: 'delete' }, ['a.md']);
  expect(plan).toMatchObject({ total: 1, conflicts: [], changes: [{ key: 'Status', remove: true, after: '(property removed)' }] });
  expect(app.fileManager.processFrontMatter).not.toHaveBeenCalled();
  expect((await editor.apply(plan)).updated).toBe(1);
  expect(data['a.md']).toEqual({ other: 'keep' }); expect(data['b.md']).toEqual(unselected);
  data['a.md'].other = 'later';
  expect((await editor.undo()).restored).toBe(1);
  expect(data['a.md']).toEqual({ Status: original, other: 'later' });
});
it('distinguishes removing all list values from removing the property itself', async () => {
  const { data, app } = setup(); data['a.md'] = { status: ['one'], other: 1 };
  const editor = new ValueEditor(app as any, () => true, () => 'list');
  await editor.apply(editor.previewNoteEdit('status', { type: 'list', mode: 'remove', values: ['one'] }, ['a.md']));
  expect(data['a.md']).toEqual({ status: [], other: 1 });
  await editor.apply(editor.previewNoteEdit('status', { type: 'list', mode: 'delete' }, ['a.md']));
  expect(data['a.md']).toEqual({ other: 1 });
  await editor.undo(); expect(data['a.md']).toEqual({ status: [], other: 1 });
});
it('skips ambiguous, missing, stale and excluded selected-property removals', async () => {
  const { data, app } = setup(); let excluded = false;
  const editor = new ValueEditor(app as any, path => !(excluded && path === 'a.md'), () => 'text');
  const request = { type: 'text' as const, mode: 'delete' as const };
  data['a.md'].Status = 'collision';
  expect(editor.previewNoteEdit('status', request, ['a.md']).conflicts[0].message).toContain('Ambiguous');
  delete data['a.md'].Status;
  const plan = editor.previewNoteEdit('status', request, ['a.md']);
  data['a.md'].status = 'later'; expect(await editor.apply(plan)).toMatchObject({ updated: 0, unchanged: 1 });
  data['a.md'].status = 'doing'; data['a.md'].Status = 'collision';
  expect(await editor.apply(plan)).toMatchObject({ updated: 0, unchanged: 1 }); delete data['a.md'].Status;
  excluded = true; expect(await editor.apply(plan)).toMatchObject({ updated: 0, unchanged: 1 });
  excluded = false; delete data['a.md'].status;
  expect(editor.previewNoteEdit('status', request, ['a.md']).conflicts[0].message).toContain('missing');
});
it('restores deleted keys with their original casing, but never overwrites recreated case variants', async () => {
  const { data, app } = setup(); data['a.md'] = { Status: 'active' }; data['b.md'] = { status: 'closed' };
  const editor = new ValueEditor(app as any, () => true, () => 'text');
  await editor.apply(editor.previewNoteEdit('status', { type: 'text', mode: 'delete' }, ['a.md', 'b.md']));
  data['a.md'].status = 'recreated';
  expect(await editor.undo()).toMatchObject({ restored: 1, skipped: 1 });
  expect(data['a.md']).toEqual({ status: 'recreated' }); expect(data['b.md']).toEqual({ status: 'closed' });
  delete data['a.md'].status;
  expect((await editor.undo()).restored).toBe(1); expect(data['a.md']).toEqual({ Status: 'active' });
});
it('rechecks the configured type for removal and retains prior undo when no keys are removed', async () => {
  const { data, app } = setup(); let type: 'text' | 'number' = 'text';
  const editor = new ValueEditor(app as any, () => true, () => type);
  await editor.apply(editor.previewNoteValue('status', 'active', ['a.md']));
  const plan = editor.previewNoteEdit('status', { type: 'text', mode: 'delete' }, ['a.md']);
  type = 'number'; expect(await editor.apply(plan)).toMatchObject({ updated: 0, unchanged: 1 });
  expect((await editor.undo()).restored).toBe(1); expect(data['a.md'].status).toBe('doing');
});
