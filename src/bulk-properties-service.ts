// SPDX-License-Identifier: MIT
import { matchingKeys, setOwnValue } from './property-rename';
import {cloneBulkValue as cloneValue, sameBulkValue as sameValue} from './bulk-properties';
import { previewAdd, previewRemove, applyChanges, type AddRow, type ExistsMode, type NoteResult, type KeyChange } from './bulk-properties';
import type { ValueEditor, ValueUndoResult } from './value-editor';
export interface BulkHost {
    eligible(path: string): boolean;
    frontmatter(path: string): Record<string, unknown> | undefined;
    process(path: string, change: (fm: Record<string, unknown>) => void): Promise<void>;
    configuredType(key: string): string | undefined;
}
export interface BulkPlan {
    mode: 'add' | 'remove';
    notes: NoteResult[];
    keys: string[];
    types: Map<string, string | undefined>;
}
class NoChanges extends Error {
}
export class BulkPropertiesService {
    constructor(private host: BulkHost, private editor: Pick<ValueEditor, 'runExclusive' | 'rememberUndo'>) { }
    preview(paths: readonly string[], request: {
        rows: AddRow[];
        exists: ExistsMode;
        delimiter: string;
    } | {
        keys: string[];
    }): BulkPlan {
        const mode = 'rows' in request ? 'add' : 'remove', keys = 'rows' in request ? request.rows.map(r => r.key) : request.keys;
        const notes = [...new Set(paths)].map(path => {
            if (!this.host.eligible(path))
                return { path, changes: [], skipped: [{ key: '', reason: 'not-found or excluded' }] };
            const fm = this.host.frontmatter(path);
            if (!fm)
                return { path, changes: [], skipped: [], error: 'Metadata is not ready. Refresh and preview again.' };
            try {
                return 'rows' in request ? previewAdd(path, fm, request.rows, request.exists, request.delimiter) : previewRemove(path, fm, request.keys);
            }
            catch (error) {
                return { path, changes: [], skipped: [], error: String(error) };
            }
        });
        return { mode, notes, keys, types: new Map(keys.map(key => [key, this.host.configuredType(key)])) };
    }
    async apply(plan: BulkPlan, progress: (done: number, total: number) => void = () => { }): Promise<NoteResult[]> {
        return this.editor.runExclusive(async () => {
            const results: NoteResult[] = [], snapshots: {
                path: string;
                changes: KeyChange[];
            }[] = [];
            const notes = plan.notes.filter(note => note.changes.length);
            for (const [index, note] of notes.entries()) {
                const result: NoteResult = { path: note.path, changes: [], skipped: [...note.skipped] };
                if (!this.host.eligible(note.path))
                    result.skipped.push({ key: '', reason: 'not-found or excluded' });
                else
                    try {
                        await this.host.process(note.path, fm => {
                            if (!this.host.eligible(note.path)) {
                                result.skipped.push({ key: '', reason: 'not-found or excluded' });
                                throw new NoChanges();
                            }
                            const changes: KeyChange[] = [];
                            for (const planned of note.changes) {
                                const matches = matchingKeys(fm, planned.key), current = matches.length === 1 ? fm[matches[0]] : undefined;
                                const requestKey = plan.keys.find(key => matchingKeys({ [planned.key]: true }, key).length) ?? planned.key;
                                const reason = matches.length > 1 ? 'ambiguous-key' : (matches.length === 1) !== planned.existed || !sameValue(current, planned.before) || this.host.configuredType(requestKey) !== plan.types.get(requestKey) ? 'changed-since-preview' : undefined;
                                if (reason) {
                                    result.skipped.push({ key: planned.key, reason });
                                    continue;
                                }
                                changes.push({ ...planned, key: matches[0] ?? planned.key, before: cloneValue(current), after: cloneValue(planned.after) });
                            }
                            if (!changes.length)
                                throw new NoChanges();
                            applyChanges(fm, changes);
                            result.changes = changes;
                        });
                        if (result.changes.length)
                            snapshots.push({ path: note.path, changes: result.changes });
                    }
                    catch (error) {
                        result.changes = [];
                        if (!(error instanceof NoChanges))
                            result.error = error instanceof Error ? error.message : String(error);
                    }
                results.push(result);
                progress(index + 1, notes.length);
                if ((index + 1) % 25 === 0)
                    await new Promise(resolve => window.setTimeout(resolve, 0));
            }
            if (snapshots.length) {
                let pending = snapshots;
                this.editor.rememberUndo(async () => {
                    const remaining: typeof pending = [], failures: ValueUndoResult['failures'] = [];
                    let restored = 0, skipped = 0;
                    for (const snapshot of pending) {
                        if (!this.host.eligible(snapshot.path)) {
                            remaining.push(snapshot);
                            skipped++;
                            continue;
                        }
                        let successful = 0;
                        const conflicts: KeyChange[] = [];
                        try {
                            await this.host.process(snapshot.path, fm => {
                                if (!this.host.eligible(snapshot.path))
                                    throw new NoChanges();
                                for (const entry of snapshot.changes) {
                                    const keys = matchingKeys(fm, entry.key), absent = entry.action === 'remove';
                                    if (keys.length > 1 || (absent ? keys.length !== 0 : keys.length !== 1 || !sameValue(fm[keys[0]], entry.after))) {
                                        conflicts.push(entry);
                                        continue;
                                    }
                                    if (entry.existed)
                                        setOwnValue(fm, keys[0] ?? entry.key, cloneValue(entry.before));
                                    else
                                        delete fm[keys[0]];
                                    successful++;
                                }
                                if (!successful)
                                    throw new NoChanges();
                            });
                            if (successful)
                                restored++;
                            if (conflicts.length) {
                                remaining.push({ path: snapshot.path, changes: conflicts });
                                skipped++;
                            }
                        }
                        catch (error) {
                            remaining.push(snapshot);
                            if (error instanceof NoChanges)
                                skipped++;
                            else
                                failures.push({ path: snapshot.path, message: String(error) });
                        }
                    }
                    pending = remaining;
                    return { restored, skipped, failures };
                }, true);
            }
            return [...plan.notes.filter(note => !note.changes.length), ...results];
        });
    }
}
