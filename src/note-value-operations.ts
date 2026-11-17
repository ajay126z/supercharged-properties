// SPDX-License-Identifier: MIT
import { fold } from './index';

export type NoteEditType = 'text' | 'number' | 'checkbox' | 'date' | 'datetime' | 'list';
export type ListItem = string | number;
export type NoteValueEdit =
  | { type: NoteEditType; mode: 'delete' }
  | { type: Exclude<NoteEditType, 'list'>; mode: 'set'; value: string | number | boolean | null }
  | { type: 'list'; mode: 'add' | 'remove'; values: ListItem[] };

export function textOnlyList(property: string): boolean {
  return ['aliases', 'cssclasses'].includes(fold(property));
}

export function parseNoteNumber(text: string): number | undefined {
  const value = text.trim();
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(value)) return undefined;
  const number = Number(value);
  if (!Number.isFinite(number) || (Number.isInteger(number) && !Number.isSafeInteger(number))) return undefined;
  return number === 0 ? 0 : number;
}

/** Validate calendar components without Date parsing, timezone conversion, or rollover. */
export function validNoteDate(text: string, withTime = false): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?)?$/.exec(text);
  if (!match || withTime !== (match[4] !== undefined)) return false;
  const [, yearText, monthText, dayText, hours, minutes, seconds] = match;
  const year = Number(yearText), month = Number(monthText), day = Number(dayText);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]
    && (!withTime || (Number(hours) < 24 && Number(minutes) < 60 && Number(seconds ?? 0) < 60));
}

export function noteEditError(edit: NoteValueEdit, property: string): string | undefined {
  if (edit.mode === 'delete') return;
  if (edit.type === 'list') {
    if (!['add', 'remove'].includes(edit.mode) || !edit.values.length) return 'Choose at least one list value.';
    if (edit.values.some(value => typeof value === 'string' ? !value.trim() || value.includes('\0') : typeof value !== 'number' || !Number.isFinite(value))) return 'Use nonblank text or finite numbers for list values.';
    if (textOnlyList(property) && edit.values.some(value => typeof value !== 'string')) return 'Aliases and CSS classes require text list values.';
    return;
  }
  if (edit.mode !== 'set') return 'Choose a supported property operation.';
  if (edit.value === null) return;
  switch (edit.type) {
    case 'text': return typeof edit.value === 'string' && !!edit.value.trim() && !edit.value.includes('\0') ? undefined : 'Enter text or choose Set empty.';
    case 'checkbox': return typeof edit.value === 'boolean' ? undefined : 'Choose true, false, or Set empty.';
    case 'number': return typeof edit.value === 'number' && Number.isFinite(edit.value) && (!Number.isInteger(edit.value) || Number.isSafeInteger(edit.value)) ? undefined : 'Enter a finite number within the supported precision.';
    case 'date': return typeof edit.value === 'string' && validNoteDate(edit.value) ? undefined : 'Choose a valid date (YYYY-MM-DD).';
    case 'datetime': return typeof edit.value === 'string' && validNoteDate(edit.value, true) ? undefined : 'Choose a valid local date and time.';
  }
}

export function transformNoteValue(original: unknown, edit: NoteValueEdit, property: string): { value?: unknown; remove?: boolean; error?: string } {
  const error = noteEditError(edit, property);
  if (error) return { error };
  if (edit.mode === 'delete') return { remove: true };
  if (edit.type === 'list') {
    const empty = original === null || original === '';
    if (!empty && (!Array.isArray(original) || !original.every(item => typeof item === 'string' || (typeof item === 'number' && Number.isFinite(item))))) return { error: 'Only flat text/number lists or empty values are supported.' };
    const items: ListItem[] = empty ? [] : original as ListItem[];
    if (textOnlyList(property) && items.some(item => typeof item !== 'string')) return { error: 'This property requires a text list.' };
    if (edit.mode === 'remove') return { value: empty ? original : items.filter(item => !edit.values.includes(item)) };
    const result = [...items];
    for (const item of edit.values) if (!result.includes(item)) result.push(item);
    return { value: result };
  }
  const empty = original === null || original === '';
  const compatible = edit.type === 'number' ? typeof original === 'number' && Number.isFinite(original)
    : edit.type === 'checkbox' ? typeof original === 'boolean' : typeof original === 'string';
  if (!empty && !compatible) return { error: `Stored value does not match the ${edit.type} property type.` };
  return { value: edit.value };
}
