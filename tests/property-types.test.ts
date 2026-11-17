import { expect, it, vi } from 'vitest';
vi.mock('obsidian', () => ({ normalizePath: (path: string) => path.replaceAll('\\', '/') }));
import { PropertyTypeResolver } from '../src/property-types';

function resolverFor(files: Record<string, string>): PropertyTypeResolver {
  const app = {
    vault: {
      configDir: '.obsidian',
      adapter: {
        exists: async (path: string) => path in files,
        read: async (path: string) => files[path]
      }
    }
  };
  return new PropertyTypeResolver(app as never);
}

const property = (id: string) => ({ id });
const typesFile = (types: Record<string, unknown>) => ({ '.obsidian/types.json': JSON.stringify({ types }) });

it('uses configured types and their matching icons', async () => {
  const resolver = resolverFor(typesFile({
    title: 'text', topics: 'multitext', alias: 'aliases', labels: 'tags', rating: 'number',
    done: 'checkbox', due: 'date', updated: 'datetime'
  }));
  await resolver.load();
  expect(['title', 'topics', 'alias', 'labels', 'rating', 'done', 'due', 'updated'].map(id => resolver.typeFor(property(id))))
    .toEqual(['text', 'multitext', 'aliases', 'tags', 'number', 'checkbox', 'date', 'datetime']);
  expect(['title', 'topics', 'alias', 'labels', 'rating', 'done', 'due', 'updated'].map(id => resolver.iconFor(property(id))))
    .toEqual(['text', 'list', 'list', 'tags', 'hash', 'check-square', 'calendar', 'calendar-clock']);
});

it('falls back to built-in property names and text', async () => {
  const resolver = resolverFor({});
  await resolver.load();
  expect(resolver.typeFor(property('tags'))).toBe('tags');
  expect(resolver.iconFor(property('tags'))).toBe('tags');
  expect(resolver.typeFor(property('aliases'))).toBe('aliases');
  expect(resolver.iconFor(property('aliases'))).toBe('list');
  expect(resolver.typeFor(property('cssclasses'))).toBe('multitext');
  expect(resolver.iconFor(property('cssclasses'))).toBe('list');
  expect(resolver.typeFor(property('anything'))).toBe('text');
  expect(resolver.iconFor(property('anything'))).toBe('text');
});

it('normalizes keys and ignores unsupported or unknown types', async () => {
  const resolver = resolverFor(typesFile({
    ' Rating ': 'Number', 'Café': 'number', invalid: 3, custom: 'not-a-widget'
  }));
  await resolver.load();
  expect(resolver.typeFor(property('rating'))).toBe('number');
  expect(resolver.typeFor(property('café'))).toBe('number');
  expect(resolver.typeFor(property('cafe\u0301'))).toBe('number');
  expect(resolver.typeFor(property('invalid'))).toBe('text');
  expect(resolver.typeFor(property('custom'))).toBe('not-a-widget');
  expect(resolver.iconFor(property('custom'))).toBe('text');
});

it('does not read inherited object keys', async () => {
  const resolver = resolverFor(typesFile({ constructor: 'number' }));
  await resolver.load();
  expect(resolver.typeFor(property('constructor'))).toBe('number');
  expect(resolver.typeFor(property('toString'))).toBe('text');
  expect(resolver.typeFor(property('__proto__'))).toBe('text');
});

it('reloads file changes and clears types when the file disappears', async () => {
  const files = typesFile({ rating: 'number' });
  const resolver = resolverFor(files);
  await resolver.load();
  expect(resolver.typeFor(property('rating'))).toBe('number');
  files['.obsidian/types.json'] = JSON.stringify({ types: { rating: 'checkbox' } });
  await resolver.load();
  expect(resolver.typeFor(property('rating'))).toBe('checkbox');
  delete files['.obsidian/types.json'];
  await resolver.load();
  expect(resolver.typeFor(property('rating'))).toBe('text');
});

it('keeps working when types.json is malformed or unreadable', async () => {
  const files = { '.obsidian/types.json': '{not json' };
  const resolver = resolverFor(files);
  await expect(resolver.load()).resolves.toBeUndefined();
  expect(resolver.typeFor(property('rating'))).toBe('text');
  files['.obsidian/types.json'] = JSON.stringify({ types: [] });
  await resolver.load();
  expect(resolver.typeFor(property('rating'))).toBe('text');
});

it('resolves selected-note types while retaining the special tags restriction', async () => {
  const { noteEditType } = await import('../src/property-types');
  const resolver = resolverFor(typesFile({ rating: 'number', done: 'checkbox', due: 'date', updated: 'datetime', topics: 'multitext', invalid: 'unknown' }));
  await resolver.load();
  expect(['title', 'rating', 'done', 'due', 'updated', 'topics', 'aliases', 'cssclasses', 'tags', 'invalid'].map(id => noteEditType({ id }, resolver)))
    .toEqual(['text', 'number', 'checkbox', 'date', 'datetime', 'list', 'list', 'list', undefined, undefined]);
});
