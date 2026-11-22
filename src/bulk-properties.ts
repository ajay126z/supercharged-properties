// SPDX-License-Identifier: MIT
import { fold } from './index';
import { matchingKeys, propertyNameError, setOwnValue } from './property-rename';
import { noteEditError, parseNoteNumber, validNoteDate, textOnlyList, type NoteEditType } from './note-value-operations';
export const cloneBulkValue = (value: unknown): unknown => structuredClone(value);
export function sameBulkValue(a: unknown, b: unknown): boolean {
    const seen = new WeakMap<object, WeakSet<object>>();
    const equal = (left: unknown, right: unknown): boolean => {
        if (Object.is(left, right)) return true;
        if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
        if (left instanceof Date || right instanceof Date) return left instanceof Date && right instanceof Date && left.getTime() === right.getTime();
        if (Array.isArray(left) !== Array.isArray(right)) return false;
        if (Array.isArray(left) && Array.isArray(right) && left.length !== right.length) return false;
        if (seen.get(left)?.has(right)) return true;
        const partners = seen.get(left) ?? new WeakSet<object>(); partners.add(right); seen.set(left, partners);
        const x = left as Record<string, unknown>, y = right as Record<string, unknown>;
        const keys = Object.keys(x);
        return keys.length === Object.keys(y).length && keys.every(key => Object.prototype.hasOwnProperty.call(y, key) && equal(x[key], y[key]));
    };
    return equal(a, b);
}

export type DialogType = NoteEditType;
export type ExistsMode = 'skip' | 'merge' | 'overwrite';
export interface AddRow {
    id: string;
    key: string;
    type: DialogType;
    value: string;
}
export interface KeyChange {
    key: string;
    action: 'add' | 'overwrite' | 'merge' | 'remove';
    existed: boolean;
    before: unknown;
    after: unknown;
}
export interface NoteResult {
    path: string;
    changes: KeyChange[];
    skipped: {
        key: string;
        reason: string;
    }[];
    error?: string;
}
export const isReserved = (key: string): boolean => ['tags', 'position'].includes(fold(key));
export const isEmpty = (value: unknown): boolean => value === undefined || value === null || value === '' || Array.isArray(value) && value.length === 0;
export function parseValue(type: DialogType, raw: string, delimiter: string): {
    ok: true;
    value: unknown;
} | {
    ok: false;
    error: string;
} {
    const text = raw.trim();
    if (type === 'number') {
        const value = parseNoteNumber(text);
        return value === undefined ? { ok: false, error: 'Enter a number' } : { ok: true, value };
    }
    if (type === 'checkbox')
        return ['true', 'false'].includes(raw) ? { ok: true, value: raw === 'true' } : { ok: false, error: 'Choose checked or unchecked' };
    if (!text)
        return { ok: false, error: 'Enter a value' };
    if (type === 'list') {
        const values = [...new Set(raw.split(delimiter).map(item => item.trim()).filter(Boolean))];
        const error = noteEditError({ type: 'list', mode: 'add', values }, '');
        return error ? { ok: false, error: values.length ? error : 'Enter a value' } : { ok: true, value: values };
    }
    const error = noteEditError({ type, mode: 'set', value: text }, '');
    return error ? { ok: false, error } : { ok: true, value: text };
}
export function validateRows(rows: AddRow[], delimiter: string): Map<string, string> {
    const errors = new Map<string, string>(), used = new Set<string>();
    for (const row of rows) {
        const parsed = parseValue(row.type, row.value, delimiter), key = fold(row.key);
        const error = !key ? 'Enter a property name' : isReserved(key) ? `${row.key} is not supported yet` : used.has(key) ? 'Already listed above' : propertyNameError(row.key) ?? (textOnlyList(key) && row.type !== 'list' ? 'Use List for this property' : !parsed.ok ? parsed.error : undefined);
        if (error)
            errors.set(row.id, error);
        used.add(key);
    }
    return errors;
}
export function previewAdd(path: string, fm: Record<string, unknown>, rows: AddRow[], mode: ExistsMode, delimiter: string): NoteResult {
    const result: NoteResult = { path, changes: [], skipped: [] };
    const errors = validateRows(rows, delimiter);
    if (errors.size || rows.length > 20 || !rows.length)
        throw new Error([...errors.values()][0] ?? 'Use 1 to 20 properties.');
    for (const row of rows) {
        const matches = matchingKeys(fm, row.key);
        if (matches.length > 1) {
            result.skipped.push({ key: row.key, reason: 'ambiguous-key' });
            continue;
        }
        const key = matches[0] ?? row.key.trim(), existed = !!matches.length, before = existed ? fm[key] : undefined;
        const parsed = parseValue(row.type, row.value, delimiter);
        if (!parsed.ok)
            continue;
        let after = parsed.value;
        let action: KeyChange['action'] = !existed || isEmpty(before) ? 'add' : 'overwrite';
        if (existed && !isEmpty(before)) {
            if (mode === 'skip') {
                result.skipped.push({ key, reason: 'already-has' });
                continue;
            }
            if (mode === 'merge' && (row.type === 'text' || row.type === 'list')) {
                const flat = Array.isArray(before) && before.every(v => typeof v === 'string' || typeof v === 'number' && Number.isFinite(v));
                const text = typeof before === 'string' && !validNoteDate(before) && !validNoteDate(before, true);
                if (!flat && !text || textOnlyList(key) && Array.isArray(before) && before.some(v => typeof v !== 'string')) {
                    result.skipped.push({ key, reason: 'unsupported-existing' });
                    continue;
                }
                const items: unknown[] = Array.isArray(before) ? [...before as unknown[]] : [before];
                for (const item of Array.isArray(after) ? after : [after])
                    if (!items.some(old => sameBulkValue(old, item)))
                        items.push(item);
                after = items;
                action = 'merge';
            }
        }
        if (!existed || !sameBulkValue(before, after))
            result.changes.push({ key, action, existed, before: cloneBulkValue(before), after: cloneBulkValue(after) });
    }
    return result;
}
export function previewRemove(path: string, fm: Record<string, unknown>, keys: string[]): NoteResult {
    const result: NoteResult = { path, changes: [], skipped: [] };
    for (const requested of new Set(keys.map(fold))) {
        if (isReserved(requested))
            throw new Error(`${requested} is not supported yet`);
        const matches = matchingKeys(fm, requested);
        if (matches.length > 1)
            result.skipped.push({ key: requested, reason: 'ambiguous-key' });
        else if (matches.length === 1) {
            const key = matches[0];
            result.changes.push({ key, action: 'remove', existed: true, before: cloneBulkValue(fm[key]), after: undefined });
        }
    }
    return result;
}
export function applyChanges(fm: Record<string, unknown>, changes: KeyChange[]): void {
    for (const change of changes)
        if (change.action === 'remove')
            delete fm[change.key];
        else
            setOwnValue(fm, change.key, cloneBulkValue(change.after));
}
export interface BulkSettings {
    bulkIncludeSubfolders: boolean;
    bulkExistsMode: ExistsMode;
    bulkListDelimiter: string;
}
export const validDelimiter = (value: unknown): value is string => typeof value === 'string' && Array.from(value).length === 1 && value !== '\0';
export function bulkSettings(raw: Record<string, unknown>): BulkSettings {
    return { bulkIncludeSubfolders: typeof raw.bulkIncludeSubfolders === 'boolean' ? raw.bulkIncludeSubfolders : true, bulkExistsMode: ['skip', 'merge', 'overwrite'].includes(String(raw.bulkExistsMode)) ? raw.bulkExistsMode as ExistsMode : 'skip', bulkListDelimiter: validDelimiter(raw.bulkListDelimiter) ? raw.bulkListDelimiter : ',' };
}
