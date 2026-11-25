/**
 * Settings for the optional File explorer counts feature.
 * Pure (no Obsidian imports) so it can be tested without mocks.
 */
import type { CountMode } from './counting';

export interface ExplorerCountsSettings {
  /** Master switch. Off by default; when off the feature registers nothing. */
  enabled: boolean;
  mode: CountMode;
  hideZero: boolean;
  /** Count every file type instead of markdown notes only. */
  countAllFiles: boolean;
  /** Skip files inside the plugin's Excluded folders. */
  skipExcludedFolders: boolean;
}

export const DEFAULT_EXPLORER_COUNTS: ExplorerCountsSettings = {
  enabled: false,
  mode: 'total',
  hideZero: true,
  countAllFiles: false,
  skipExcludedFolders: false,
};

/** Validate persisted data. A missing or malformed object loads as the disabled defaults. */
export function normalizeExplorerCounts(raw: unknown): ExplorerCountsSettings {
  const source = (raw !== null && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const bool = (value: unknown, fallback: boolean): boolean =>
    typeof value === 'boolean' ? value : fallback;
  const mode: CountMode =
    source.mode === 'direct' || source.mode === 'both' || source.mode === 'total'
      ? source.mode
      : DEFAULT_EXPLORER_COUNTS.mode;
  return {
    enabled: bool(source.enabled, DEFAULT_EXPLORER_COUNTS.enabled),
    mode,
    hideZero: bool(source.hideZero, DEFAULT_EXPLORER_COUNTS.hideZero),
    countAllFiles: bool(source.countAllFiles, DEFAULT_EXPLORER_COUNTS.countAllFiles),
    skipExcludedFolders: bool(source.skipExcludedFolders, DEFAULT_EXPLORER_COUNTS.skipExcludedFolders),
  };
}
