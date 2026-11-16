// SPDX-License-Identifier: MIT
// Supercharged Properties: preview and apply frontmatter value edits.

import { App, TFile } from 'obsidian';
import { canRename, matchingKeys, propertyNameError, setOwnValue } from './property-rename';
import {
  cloneValue,
  getPropertyValue,
  previewValue,
  propertyKey,
  sameValue,
  type ValueEditRequest
} from './value-operations';

export interface ValueEditChange { readonly path: string; readonly before: string; readonly after: string; readonly key: string; readonly original: unknown; readonly replacement: unknown; readonly targetKey?: string; readonly remove?: boolean; readonly propertyDelete?: boolean }
export interface ValueEditPreview { readonly total: number; readonly changes: ValueEditChange[] }
export interface PropertyRenamePreview extends ValueEditPreview { readonly source: string; readonly target: string; readonly conflicts: ValueEditFailure[]; readonly error?: string }
export interface PropertyDeletePreview extends ValueEditPreview { readonly property: string; readonly conflicts: ValueEditFailure[] }
export interface ValueEditFailure { readonly path: string; readonly message: string }
export interface ValueEditResult { readonly updated: number; readonly unchanged: number; readonly failures: ValueEditFailure[] }
export interface ValueUndoResult { readonly restored: number; readonly skipped: number; readonly failures: ValueEditFailure[] }

interface Snapshot { readonly path: string; readonly key: string; readonly before: unknown; readonly after: unknown; readonly targetKey?: string; readonly remove: boolean }
interface LastEdit { readonly snapshots: Snapshot[] }

export class ValueEditor {
  private busy = false;
  private last: LastEdit | undefined;

  constructor(private readonly app: App, private readonly includesPath: (path: string) => boolean = () => true) {}

  canUndo(): boolean { return !!this.last && !this.busy; }

  preview(request: ValueEditRequest, paths: Iterable<string>): ValueEditPreview {
    const changes: ValueEditChange[] = [];
    for (const path of new Set(paths)) {
      if (!this.includesPath(path)) continue;
      const file = this.file(path);
      if (!file) continue;
      const frontmatter = this.frontmatter(file);
      if (!frontmatter) continue;
      const raw = getPropertyValue(frontmatter, request.property);
      if (raw === undefined) continue;
      const result = previewValue(raw, request);
      if (!result.changed) continue;
      const remove = result.remove === true;
      changes.push({ path, key: propertyKey(frontmatter, request.property)!, original: cloneValue(raw), replacement: remove ? undefined : cloneValue(result.value), remove, before: JSON.stringify(raw), after: remove ? '(removed)' : JSON.stringify(result.value) });
    }
    return { total: changes.length, changes };
  }

  previewPropertyDelete(property: string, paths: Iterable<string>): PropertyDeletePreview {
    const changes: ValueEditChange[] = [], conflicts: ValueEditFailure[] = [];
    for (const path of new Set(paths)) {
      if (!this.includesPath(path)) continue;
      const file = this.file(path);
      const frontmatter = file ? this.frontmatter(file) : undefined;
      if (!frontmatter) { conflicts.push({ path, message: 'Note or metadata unavailable.' }); continue; }
      const keys = matchingKeys(frontmatter, property);
      if (!keys.length) continue;
      if (keys.length !== 1) { conflicts.push({ path, message: 'Ambiguous source keys.' }); continue; }
      const key = keys[0];
      const original = cloneValue(frontmatter[key]);
      changes.push({ path, key, original, replacement: undefined, remove: true, propertyDelete: true, before: JSON.stringify(original), after: '(removed)' });
    }
    return { property, total: changes.length, changes, conflicts };
  }

  previewPropertyRename(source: string, name: string, paths: Iterable<string>): PropertyRenamePreview {
    const target = name.trim();
    const error = propertyNameError(name);
    const changes: ValueEditChange[] = [], conflicts: ValueEditFailure[] = [];
    if (error) return { source, target, total: 0, changes, conflicts, error };
    for (const path of new Set(paths)) {
      if (!this.includesPath(path)) continue;
      const file = this.file(path);
      const frontmatter = file ? this.frontmatter(file) : undefined;
      if (!frontmatter) { conflicts.push({ path, message: 'Note or metadata unavailable.' }); continue; }
      const keys = matchingKeys(frontmatter, source);
      if (keys.length !== 1) { conflicts.push({ path, message: keys.length ? 'Ambiguous source keys.' : 'Source property is missing.' }); continue; }
      const key = keys[0];
      if (key === target) continue;
      if (!canRename(frontmatter, key, target)) { conflicts.push({ path, message: 'Destination property already exists.' }); continue; }
      const original = cloneValue(frontmatter[key]);
      changes.push({ path, key, targetKey: target, original, replacement: cloneValue(original), before: JSON.stringify(original), after: JSON.stringify(original) });
    }
    return { source, target, total: changes.length, changes, conflicts };
  }

  async apply(preview: ValueEditPreview): Promise<ValueEditResult> {
    if (this.busy) throw new Error('Another value edit is running.');
    this.busy = true;
    const snapshots: Snapshot[] = [];
    const failures: ValueEditFailure[] = [];
    let unchanged = 0;
    try {
      for (const change of preview.changes) {
        if (!this.includesPath(change.path)) { unchanged++; continue; }
        const file = this.file(change.path);
        if (!file) { failures.push({ path: change.path, message: 'Note not found.' }); continue; }
        let snapshot: Snapshot | undefined;
        try {
          await this.app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
            if (!this.includesPath(change.path)) return;
            if (!Object.prototype.hasOwnProperty.call(frontmatter, change.key) || !sameValue(frontmatter[change.key], change.original)) return;
            if (change.propertyDelete && matchingKeys(frontmatter, change.key).length !== 1) return;
            if (change.targetKey !== undefined && !canRename(frontmatter, change.key, change.targetKey)) return;
            const remove = change.remove === true;
            snapshot = { path: change.path, key: change.key, before: cloneValue(change.original), after: remove ? undefined : cloneValue(change.replacement), targetKey: change.targetKey, remove };
            if (remove) delete frontmatter[change.key];
            else {
              setOwnValue(frontmatter, change.targetKey ?? change.key, cloneValue(change.replacement));
              if (change.targetKey !== undefined) delete frontmatter[change.key];
            }
          });
          if (snapshot) snapshots.push(snapshot);
          else unchanged++;
        } catch (error) { failures.push({ path: change.path, message: message(error) }); }
      }
      if (snapshots.length) this.last = { snapshots };
      return { updated: snapshots.length, unchanged, failures };
    } finally { this.busy = false; }
  }

  async undo(): Promise<ValueUndoResult> {
    if (this.busy) throw new Error('Another value edit is running.');
    const last = this.last;
    if (!last) return { restored: 0, skipped: 0, failures: [] };
    this.busy = true;
    const remaining: Snapshot[] = [];
    const failures: ValueEditFailure[] = [];
    let restored = 0;
    let skipped = 0;
    for (const snapshot of last.snapshots) {
      const file = this.file(snapshot.path);
      if (!file) { failures.push({ path: snapshot.path, message: 'Note not found.' }); remaining.push(snapshot); continue; }
      let matched = false;
      try {
        await this.app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
          if (snapshot.remove) {
            if (matchingKeys(frontmatter, snapshot.key).length) { skipped++; remaining.push(snapshot); return; }
            matched = true;
            setOwnValue(frontmatter, snapshot.key, cloneValue(snapshot.before));
            return;
          }
          const currentKey = snapshot.targetKey ?? snapshot.key;
          const safeKey = snapshot.targetKey === undefined || canRename(frontmatter, currentKey, snapshot.key);
          if (!safeKey || !Object.prototype.hasOwnProperty.call(frontmatter, currentKey) || !sameValue(frontmatter[currentKey], snapshot.after)) { skipped++; remaining.push(snapshot); return; }
          matched = true;
          setOwnValue(frontmatter, snapshot.key, cloneValue(snapshot.before));
          if (snapshot.targetKey !== undefined) delete frontmatter[snapshot.targetKey];
        });
        if (matched) restored++;
      } catch (error) {
        failures.push({ path: snapshot.path, message: message(error) });
        remaining.push(snapshot);
      }
    }
    this.last = remaining.length ? { snapshots: remaining } : undefined;
    this.busy = false;
    return { restored, skipped, failures };
  }

  private file(path: string): TFile | undefined {
    const file = this.app.vault.getAbstractFileByPath(path);
    return file instanceof TFile ? file : undefined;
  }

  private frontmatter(file: TFile): Record<string, unknown> | undefined {
    return this.app.metadataCache.getFileCache(file)?.frontmatter;
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
