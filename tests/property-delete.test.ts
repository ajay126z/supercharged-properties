import { expect, it, vi } from 'vitest';
vi.mock('obsidian', () => ({ TFile: class {} }));
import { TFile, type App } from 'obsidian';
import { ValueEditor } from '../src/value-editor';

function setup(data: Record<string, any>) {
  const files = Object.fromEntries(Object.keys(data).map(path => [path, Object.assign(new TFile(), { path })]));
  const write = vi.fn(async (file: TFile, callback: any) => { const next = structuredClone(data[file.path]); callback(next); data[file.path] = next; });
  const app = { vault: { getAbstractFileByPath: (path: string) => files[path] }, metadataCache: { getFileCache: (file: TFile) => ({ frontmatter: data[file.path] }) }, fileManager: { processFrontMatter: write } };
  return { data, write, editor: new ValueEditor(app as unknown as App) };
}

it('previews and deletes scalar, list, empty and object values, then restores them', async () => {
  const values = ['Ada', 42, false, null, [], ['a', ['b']], { nested: { value: 1 } }];
  const { data, write, editor } = setup(Object.fromEntries(values.map((author, i) => [`${i}.md`, { author, other: 'preserve' }])));
  const preview = editor.previewPropertyDelete('author', Object.keys(data));
  expect(preview.total).toBe(values.length);
  expect(write).not.toHaveBeenCalled();
  expect((await editor.apply(preview)).updated).toBe(values.length);
  for (const i of values.keys()) expect(data[`${i}.md`]).toEqual({ other: 'preserve' });
  data['0.md'].other = 'later';
  expect((await editor.undo()).restored).toBe(values.length);
  for (const [i, value] of values.entries()) expect(data[`${i}.md`]).toEqual({ author: value, other: i === 0 ? 'later' : 'preserve' });
});

it('skips ambiguous folded keys and unavailable metadata', () => {
  const { editor } = setup({ a: { author: 1, Author: 2 }, b: { other: 1 } });
  const plan = editor.previewPropertyDelete('author', ['a', 'b', 'missing']);
  expect(plan.total).toBe(0);
  expect(plan.conflicts.map(conflict => conflict.message)).toEqual(['Ambiguous source keys.', 'Note or metadata unavailable.']);
});

it('rechecks values before deleting and undo skips recreated keys', async () => {
  const { data, editor } = setup({ a: { author: 1 }, b: { author: 2 }, c: { author: 3 } });
  const plan = editor.previewPropertyDelete('author', ['a', 'b', 'c']);
  data.a.author = 9;
  data.b.author = 7;
  expect(await editor.apply(plan)).toMatchObject({ updated: 1, unchanged: 2 });
  expect(data.c).toEqual({});
  data.c.Author = 4;
  expect(await editor.undo()).toMatchObject({ restored: 0, skipped: 1 });
  expect(data.c).toEqual({ Author: 4 });
  delete data.c.Author;
  expect((await editor.undo()).restored).toBe(1);
  expect(data.c).toEqual({ author: 3 });
});

it('skips a property delete when a folded-key ambiguity appears after preview', async () => {
  const { data, editor } = setup({ a: { author: 1 }, b: { author: 2 } });
  const plan = editor.previewPropertyDelete('author', ['a', 'b']);
  data.a.Author = 1;
  expect(await editor.apply(plan)).toMatchObject({ updated: 1, unchanged: 1 });
  expect(data.a).toEqual({ author: 1, Author: 1 });
  expect(data.b).toEqual({});
});
