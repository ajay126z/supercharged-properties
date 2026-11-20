// SPDX-License-Identifier: MIT
import { excludedFolders, isFolderExcluded } from './folder-exclusions';

/** Canonical include paths: case-sensitive, with redundant descendants absorbed. */
export function normalizeFolders(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const paths = excludedFolders(raw.filter((value): value is string => typeof value === 'string').join('\n')).sort();
  return paths.filter(path => !isFolderExcluded(path, paths));
}
export function sameFolders(a: unknown, b: unknown): boolean {
  const left = normalizeFolders(a), right = normalizeFolders(b);
  return left.length === right.length && left.every((path, index) => path === right[index]);
}
export function folderPaths(paths: Iterable<string>, folders: readonly string[], excluded: readonly string[] = []): Set<string> {
  return new Set([...paths].filter(path => isFolderExcluded(path, folders) && !isFolderExcluded(path, excluded)));
}
export function folderChoices(paths: Iterable<string>, selected: readonly string[], excluded: readonly string[]): string[] {
  // Do not absorb descendants here: the chooser must list all available folders.
  return [...new Set(paths)].filter(path => path && path !== '/' && !selected.includes(path)
    && !isFolderExcluded(path, selected) && !excluded.includes(path) && !isFolderExcluded(path, excluded)).sort();
}
export function intersectPaths(left: ReadonlySet<string> | null, right: ReadonlySet<string> | null): Set<string> | null {
  if (!left) return right ? new Set(right) : null;
  return new Set([...left].filter(path => !right || right.has(path)));
}
