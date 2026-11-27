import { describe, expect, it } from 'vitest';
import { countByFolder, describeCount, folderOf, formatCount, parentFolder } from '../src/explorer-counts/counting';
import { DEFAULT_EXPLORER_COUNTS, normalizeExplorerCounts } from '../src/explorer-counts/settings';

describe('folder helpers', () => {
  it('finds the folder of a file and the parent of a folder', () => {
    expect(folderOf('a.md')).toBe('/');
    expect(folderOf('x/y/c.md')).toBe('x/y');
    expect(parentFolder('x/y')).toBe('x');
    expect(parentFolder('x')).toBe('/');
    expect(parentFolder('/')).toBeNull();
  });
});

describe('countByFolder', () => {
  it('counts direct and total notes for nested folders and the root', () => {
    const counts = countByFolder(['a.md', 'x/b.md', 'x/y/c.md', 'x/y/d.md']);
    expect(counts.get('/')).toEqual({ direct: 1, total: 4 });
    expect(counts.get('x')).toEqual({ direct: 1, total: 3 });
    expect(counts.get('x/y')).toEqual({ direct: 2, total: 2 });
  });

  it('returns an empty map for no files and omits folders with no files', () => {
    expect(countByFolder([]).size).toBe(0);
    expect(countByFolder(['x/y/c.md']).get('x/z')).toBeUndefined();
  });

  it('does not match folders that only share a name prefix', () => {
    const counts = countByFolder(['Recipes/a.md', 'Recipes Archive/b.md']);
    expect(counts.get('Recipes')).toEqual({ direct: 1, total: 1 });
    expect(counts.get('Recipes Archive')).toEqual({ direct: 1, total: 1 });
  });
});

describe('formatCount', () => {
  const counts = { direct: 3, total: 12 };
  it('formats each mode', () => {
    expect(formatCount(counts, 'total', true)).toBe('12');
    expect(formatCount(counts, 'direct', true)).toBe('3');
    expect(formatCount(counts, 'both', true)).toBe('3 · 12');
  });
  it('hides zero counts only when asked', () => {
    expect(formatCount(undefined, 'total', true)).toBeNull();
    expect(formatCount(undefined, 'total', false)).toBe('0');
    expect(formatCount({ direct: 0, total: 5 }, 'direct', true)).toBeNull();
    expect(formatCount({ direct: 0, total: 5 }, 'total', true)).toBe('5');
  });
});

describe('describeCount', () => {
  const notes = { singular: 'note', plural: 'notes' };
  it('uses singular and plural and mentions direct counts only when they differ', () => {
    expect(describeCount({ direct: 3, total: 12 }, notes)).toBe('12 notes, 3 directly in this folder');
    expect(describeCount({ direct: 1, total: 1 }, notes)).toBe('1 note');
    expect(describeCount(undefined, notes)).toBe('0 notes');
  });
});

describe('normalizeExplorerCounts', () => {
  it('loads missing or malformed data as the disabled defaults', () => {
    expect(normalizeExplorerCounts(undefined)).toEqual(DEFAULT_EXPLORER_COUNTS);
    expect(normalizeExplorerCounts('nope')).toEqual(DEFAULT_EXPLORER_COUNTS);
    expect(DEFAULT_EXPLORER_COUNTS.enabled).toBe(false);
  });
  it('keeps valid values and repairs invalid ones', () => {
    const result = normalizeExplorerCounts({ enabled: true, mode: 'both', hideZero: 'yes', countAllFiles: true });
    expect(result).toMatchObject({ enabled: true, mode: 'both', hideZero: true, countAllFiles: true });
    expect(normalizeExplorerCounts({ mode: 'weird' }).mode).toBe('total');
  });
});
