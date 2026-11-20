// SPDX-License-Identifier: MIT
import { getFrontMatterInfo, parseYaml, type App } from 'obsidian';
import { fold } from './index';
import { parseInlineProperties } from './inline-properties';
import { transformInline, inlineRemovalFragments } from './inline-edit';
import { matchingKeys, setOwnValue } from './property-rename';
import { parseNoteNumber } from './note-value-operations';
import { sameValue, cloneValue } from './value-operations';
import type { ValueEditor, ValueUndoResult } from './value-editor';

export interface ConversionOptions { property: string; move: boolean; detect: boolean; conflict: 'skip' | 'merge' | 'overwrite' }
export interface ConversionChange { path: string; before: string; body: string; afterBody: string; removed: string[]; key: string; original: unknown; existed: boolean; replacement: unknown; frontmatter: Record<string, unknown> }
export interface ConversionPlan { options: ConversionOptions; changes: ConversionChange[]; skipped: Array<{path: string; reason: string}> }
function parts(source: string): { body: string; frontmatter: Record<string, unknown>; prefix: string } {
  const info = getFrontMatterInfo(source);
  const raw: unknown = info.exists ? parseYaml(info.frontmatter) : {};
  if (raw !== null && (typeof raw !== 'object' || Array.isArray(raw))) throw new Error('Frontmatter must be a property mapping.');
  if (!info.exists && /^\uFEFF?---\s*(?:\r?\n|$)/.test(source)) throw new Error('Unclosed frontmatter.');
  return {body: source.slice(info.exists ? info.contentStart : 0), prefix: source.slice(0, info.exists ? info.contentStart : 0), frontmatter: (raw ?? {}) as Record<string, unknown>};
}
function detect(text: string): unknown {
  if (/^(true|false)$/i.test(text)) return text.toLowerCase() === 'true';
  // Dates stay ISO text, as required by Obsidian's date properties; never create UTC Date objects.
  return parseNoteNumber(text) ?? text;
}
export function planConversion(source: string, options: ConversionOptions, path: string): ConversionChange {
  if (['position','tags','aliases','cssclasses'].includes(fold(options.property))) throw new Error('Reserved and built-in properties cannot be converted.');
  const parsed = parseInlineProperties(source), keys = Object.keys(parsed).filter(key => fold(key) === fold(options.property));
  if (keys.length !== 1) throw new Error(keys.length ? 'Ambiguous folded inline keys.' : 'Inline property is missing.');
  const key = keys[0], originalParts = parts(source), fm = originalParts.frontmatter;
  const existing = matchingKeys(fm, key);
  if (existing.length > 1 || (existing.length === 1 && existing[0] !== key)) throw new Error('Folded YAML key collision.');
  const existed = existing.length === 1;
  if (existed && options.conflict === 'skip') throw new Error('YAML property already exists.');
  const texts = (parsed[key] as Array<string | null>).map(value => value ?? '');
  const values = texts.map(value => options.detect ? detect(value) : value);
  let replacement: unknown = values.length === 1 ? values[0] : values;
  if (existed && options.conflict === 'merge') {
    const original = fm[key];
    if (original !== null && typeof original === 'object' && !Array.isArray(original)) throw new Error('Cannot merge a YAML object into a property list.');
    const merged: unknown[] = Array.isArray(original) ? [...original as unknown[]] : [original];
    if (merged.some(value => value !== null && typeof value === 'object')) throw new Error('Cannot merge nested YAML values.');
    for (const value of values) if (!merged.some(item => sameValue(item, value))) merged.push(value);
    replacement = merged;
  }
  // Validate removable spans even for Keep, so ambiguous parser contexts cannot be copied accidentally.
  const removed = transformInline(source, {property: key, mode: 'delete-property', replacement: ''});
  return {path, before: source, removed: options.move ? inlineRemovalFragments(source, key) : [], body: originalParts.body, afterBody: options.move ? parts(removed).body : originalParts.body, key, existed, original: cloneValue(fm[key]), replacement, frontmatter: fm};
}
interface Snapshot { change: ConversionChange; after: string }
export class InlineConverter {
  constructor(private app: App, private editor: ValueEditor, private includes: (path: string) => boolean) {}
  async preview(options: ConversionOptions, paths: Iterable<string>): Promise<ConversionPlan> {
    const plan: ConversionPlan = {options: {...options}, changes: [], skipped: []};
    for (const path of new Set(paths)) {
      const file = this.app.vault.getFileByPath(path);
      if (!file || !this.includes(path)) { plan.skipped.push({path, reason: 'Note missing or folder excluded.'}); continue; }
      try { plan.changes.push(planConversion(await this.app.vault.read(file), options, path)); }
      catch (error) { plan.skipped.push({path, reason: error instanceof Error ? error.message : 'Could not read note.'}); }
    }
    return plan;
  }
  async apply(plan: ConversionPlan): Promise<{updated: number; skipped: number; failures: string[]}> {
    return this.editor.runExclusive(async () => {
      const snapshots: Snapshot[] = [], failures: string[] = []; let skipped = 0, updated = 0;
      for (const change of plan.changes) {
        const file = this.app.vault.getFileByPath(change.path);
        if (!file || !this.includes(change.path)) { skipped++; continue; }
        let stage: string | undefined;
        try {
          if (await this.app.vault.read(file) !== change.before) { skipped++; continue; }
          let wrote = false;
          await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
            if (file.path !== change.path || !this.includes(file.path) || !sameValue(fm, change.frontmatter)) throw new Error('Note changed since preview.');
            setOwnValue(fm, change.key, cloneValue(change.replacement)); wrote = true;
          });
          if (!wrote) { skipped++; continue; }
          const written = await this.app.vault.read(file);
          const current = parts(written);
          const expected = {...change.frontmatter}; setOwnValue(expected, change.key, change.replacement);
          if (!sameValue(current.frontmatter, expected) || current.body !== change.body) {
            // Preserve concurrent body edits and undo only our YAML assignment when it still matches.
            await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
              if (!sameValue(fm, expected)) throw new Error('Note changed during conversion; YAML may have been copied. Review the note.');
              if (change.existed) setOwnValue(fm, change.key, cloneValue(change.original)); else delete fm[change.key];
            });
            throw new Error('Note changed during conversion; YAML assignment reverted and source fields retained.');
          }
          stage = written;
          let after = stage;
          if (plan.options.move) {
            let removed = false;
            await this.app.vault.process(file, text => {
              if (text !== stage || file.path !== change.path || !this.includes(file.path)) return text;
              const verified = planConversion(text, {...plan.options, conflict: 'overwrite'}, change.path);
              if (verified.body !== change.body || verified.afterBody !== change.afterBody) return text;
              after = parts(text).prefix + change.afterBody; removed = true; return after;
            });
            if (!removed) throw new Error('Note changed during conversion; source fields retained.');
          }
          snapshots.push({change, after}); updated++;
        } catch (error) {
          // A failed second write must not silently lose the successful YAML write or its undo path.
          if (stage !== undefined) {
            const current = await this.app.vault.read(file).catch(() => undefined);
            if (current === stage || current === undefined) snapshots.push({change, after: stage});
            else {
              // A concurrent body edit wins. Revert only our unchanged frontmatter assignment.
              const expected = {...change.frontmatter}; setOwnValue(expected, change.key, change.replacement);
              try {
                await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
                  if (!sameValue(fm, expected)) throw new Error('Frontmatter also changed.');
                  if (change.existed) setOwnValue(fm, change.key, cloneValue(change.original)); else delete fm[change.key];
                });
              } catch { failures.push(`${change.path}: Could not revert the YAML copy; review this note.`); }
            }
          }
          failures.push(`${change.path}: ${error instanceof Error ? error.message : 'Write failed.'}`);
        }
      }
      if (snapshots.length) this.editor.rememberUndo(() => this.undo(snapshots));
      return {updated, skipped, failures};
    });
  }
  private async undo(snapshots: Snapshot[]): Promise<ValueUndoResult> {
    let restored = 0, skipped = 0; const failures: Array<{path: string; message: string}> = [];
    for (const {change, after} of snapshots) {
      const file = this.app.vault.getFileByPath(change.path);
      if (!file || !this.includes(change.path)) { skipped++; continue; }
      try {
        let done = false;
        // Restore the exact snapshot atomically. This also restores original quoting/comments when available.
        await this.app.vault.process(file, text => { if (text !== after || file.path !== change.path || !this.includes(file.path)) return text; done = true; return change.before; });
        if (done) restored++; else skipped++;
      } catch (error) { failures.push({path: change.path, message: error instanceof Error ? error.message : 'Undo failed.'}); }
    }
    return {restored, skipped, failures};
  }
}
