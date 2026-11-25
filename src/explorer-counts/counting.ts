/**
 * Pure counting helpers for the optional File explorer counts feature.
 * No Obsidian imports, so this file is trivially unit-testable.
 */

export type CountMode = 'total' | 'direct' | 'both';

export interface FolderCounts {
  /** Files directly inside the folder. */
  direct: number;
  /** Files inside the folder and all of its subfolders. */
  total: number;
}

/** Obsidian's path for the vault root folder. */
export const ROOT_PATH = '/';

/** Folder path that contains a file path. Files at the vault root belong to "/". */
export function folderOf(filePath: string): string {
  const index = filePath.lastIndexOf('/');
  return index === -1 ? ROOT_PATH : filePath.slice(0, index);
}

/** Parent of a folder path, or null for the vault root. */
export function parentFolder(folderPath: string): string | null {
  if (folderPath === ROOT_PATH) return null;
  const index = folderPath.lastIndexOf('/');
  return index === -1 ? ROOT_PATH : folderPath.slice(0, index);
}

/** One pass over file paths: direct and total counts for every folder that contains a file. */
export function countByFolder(filePaths: Iterable<string>): Map<string, FolderCounts> {
  const counts = new Map<string, FolderCounts>();
  const bump = (folder: string, field: keyof FolderCounts): void => {
    const entry = counts.get(folder) ?? { direct: 0, total: 0 };
    entry[field] += 1;
    counts.set(folder, entry);
  };
  for (const path of filePaths) {
    const folder = folderOf(path);
    bump(folder, 'direct');
    for (let current: string | null = folder; current !== null; current = parentFolder(current)) {
      bump(current, 'total');
    }
  }
  return counts;
}

/** Text for the badge, or null when the badge should not be shown. */
export function formatCount(
  counts: FolderCounts | undefined,
  mode: CountMode,
  hideZero: boolean,
): string | null {
  const value = counts ?? { direct: 0, total: 0 };
  const shown = mode === 'direct' ? value.direct : value.total;
  if (hideZero && shown === 0) return null;
  if (mode === 'direct') return String(value.direct);
  if (mode === 'both') return `${value.direct} · ${value.total}`;
  return String(value.total);
}

/** Tooltip text, for example "12 notes, 3 directly in this folder". */
export function describeCount(
  counts: FolderCounts | undefined,
  noun: { singular: string; plural: string },
): string {
  const value = counts ?? { direct: 0, total: 0 };
  const words = (n: number): string => `${n} ${n === 1 ? noun.singular : noun.plural}`;
  return value.total === value.direct
    ? words(value.total)
    : `${words(value.total)}, ${value.direct} directly in this folder`;
}
