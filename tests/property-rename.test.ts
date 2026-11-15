import { expect, it, vi } from 'vitest';
vi.mock('obsidian', () => ({ TFile: class {} }));
import { TFile, type App } from 'obsidian';
import { ValueEditor } from '../src/value-editor';
import { includeRenamedProperty } from '../src/property-rename';
function setup(data: Record<string, any>) {
  const files = Object.fromEntries(Object.keys(data).map(path => [path, Object.assign(new TFile(), { path })]));
  const write = vi.fn(async (file: TFile, callback: any) => { const next = structuredClone(data[file.path]); callback(next); data[file.path] = next; });
  const app = { vault: { getAbstractFileByPath: (path: string) => files[path] }, metadataCache: { getFileCache: (file: TFile) => ({ frontmatter: data[file.path] }) }, fileManager: { processFrontMatter: write } };
  return { data, write, editor: new ValueEditor(app as unknown as App) };
}
it('previews and renames scalar, list, empty and object values without changing their types', async () => {
  const values = ['Ada', 42, false, null, [], ['a', ['b']], { nested: { value: 1 } }];
  const { data, write, editor } = setup(Object.fromEntries(values.map((author, i) => [`${i}.md`, { author, other: 'preserve' }])));
  const preview = editor.previewPropertyRename('author', 'authors', Object.keys(data));
  expect(preview.total).toBe(values.length); expect(write).not.toHaveBeenCalled();
  expect((await editor.apply(preview)).updated).toBe(values.length);
  for (const [i, value] of values.entries()) expect(data[`${i}.md`]).toEqual({ authors: value, other: 'preserve' });
  data['0.md'].other = 'later';
  expect((await editor.undo()).restored).toBe(values.length);
  expect(data['0.md']).toEqual({ author: 'Ada', other: 'later' });
});
it('skips destination collisions including case variants and ambiguous source keys', () => {
  const { editor } = setup({ a: { author: 'Ada', AUTHORS: null }, b: { author: 'a', Author: 'b' }, c: {} });
  const plan = editor.previewPropertyRename('author', 'authors', ['a', 'b', 'c', 'missing']);
  expect(plan.total).toBe(0);
  expect(plan.conflicts.map(c => c.message)).toEqual(['Destination property already exists.', 'Ambiguous source keys.', 'Source property is missing.', 'Note or metadata unavailable.']);
});
it('allows and undoes case-only corrections but excludes exact no-ops', async () => {
  const { editor, data } = setup({ a: { Author: 'Ada' }, b: { author: 'Bob' } });
  const plan = editor.previewPropertyRename('author', 'author', ['a', 'b']);
  expect(plan.total).toBe(1);
  await editor.apply(plan); expect(data.a).toEqual({ author: 'Ada' });
  await editor.undo(); expect(data.a).toEqual({ Author: 'Ada' });
});
it('rejects blank, multiline and reserved destinations', () => {
  const { editor } = setup({ a: { author: 'a' } });
  for (const name of ['', '   ', 'a\nb', 'a\0b', ' POSITION ']) expect(editor.previewPropertyRename('author', name, ['a']).error).toBeTruthy();
});
it('skips new destination, source spelling changes, changed values and new ambiguity after preview', async () => {
  const { editor, data } = setup({ a: { author: 1 }, b: { author: 1 }, c: { author: 1 }, d: { author: 1 } });
  const plan = editor.previewPropertyRename('author', 'authors', Object.keys(data));
  data.a.authors = 2; data.b = { Author: 1 }; data.c.author = 2; data.d.Author = 3;
  expect(await editor.apply(plan)).toMatchObject({ updated: 0, unchanged: 4 });
});
it('undo skips recreated sources and modified destinations, and retries failures', async () => {
  const { editor, data, write } = setup({ a: { author: 1 }, b: { author: 2 }, c: { author: 3 } });
  await editor.apply(editor.previewPropertyRename('author', 'authors', Object.keys(data)));
  data.a.Author = 4; data.b.authors = 5;
  write.mockRejectedValueOnce(new Error('write failed'));
  expect(await editor.undo()).toMatchObject({ restored: 1, skipped: 1, failures: [{ path: 'a', message: 'write failed' }] });
  expect(editor.canUndo()).toBe(true);
  delete data.a.Author; data.b.authors = 2;
  expect((await editor.undo()).restored).toBe(2);
});
it('shares the undo slot with value edits and retains successful renames after partial failure', async () => {
  const { editor, data, write } = setup({ a: { author: 'Ada' }, b: { author: 'Bob' } });
  write.mockRejectedValueOnce(new Error('disk full'));
  expect(await editor.apply(editor.previewPropertyRename('author', 'authors', ['a', 'b']))).toMatchObject({ updated: 1, failures: [{ path: 'a', message: 'disk full' }] });
  const valuePlan = editor.preview({ property: 'authors', kind: 'string', value: 'Bob', mode: 'rename', replacement: 'Robert' }, ['b']);
  await editor.apply(valuePlan); await editor.undo();
  expect(data.b).toEqual({ authors: 'Bob' }); expect(data.a).toEqual({ author: 'Ada' });
});
it('handles special keys and nested own __proto__ values without prototype mutation', async () => {
  const value = JSON.parse('{"__proto__":{"safe":true}}');
  const { editor, data } = setup({ a: { author: value } });
  await editor.apply(editor.previewPropertyRename('author', '__proto__', ['a']));
  expect(Object.hasOwn(data.a, '__proto__')).toBe(true);
  expect(data.a.__proto__).toEqual(value);
  await editor.undo(); expect(data.a.author).toEqual(value);
});
it('carries view preferences to the new key while retaining old references for partial edits and undo', () => {
  const prefs = { scope: ['author'], pinned: ['author'], expanded: ['author'], hidden: 'author\nsecret', profiles: [{ id: '1', name: 'Writing', keys: ['author', 'status'] }] };
  includeRenamedProperty(prefs, 'author', 'authors'); includeRenamedProperty(prefs, 'author', 'authors');
  expect(prefs.scope).toEqual(['author', 'authors']); expect(prefs.pinned).toEqual(['author', 'authors']);
  expect(prefs.expanded).toEqual(['author', 'authors']); expect(prefs.hidden).toBe('author\nsecret\nauthors');
  expect(prefs.profiles[0].keys).toEqual(['author', 'status', 'authors']);
  includeRenamedProperty(prefs, 'author', 'Author'); expect(prefs.scope).toHaveLength(2);
});
