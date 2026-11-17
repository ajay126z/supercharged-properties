import { expect, it } from 'vitest';
import { noteEditError, parseNoteNumber, transformNoteValue, validNoteDate } from '../src/note-value-operations';

it.each(['0', '-2.5', '.25', '+10', '2e3'])('parses literal finite numbers: %s', value => {
  expect(parseNoteNumber(value)).toBe(Number(value));
});
it.each(['', ' ', '1+2', '1,000', '0xff', 'NaN', 'Infinity', '1e999', '9007199254740993'])('rejects invalid or unsafe numbers: %s', value => {
  expect(parseNoteNumber(value)).toBeUndefined();
});
it.each(['2024-02-29', '2000-02-29', '2026-11-16', '0001-01-01'])('accepts real calendar dates: %s', date => expect(validNoteDate(date)).toBe(true));
it.each(['2025-02-29', '1900-02-29', '2026-04-31', '2026-00-01', '2026-13-01', '0000-01-01', '26-01-01', '2026-01-01T12:30'])('rejects invalid date values: %s', date => expect(validNoteDate(date)).toBe(false));
it('validates date/time components without a timezone conversion', () => {
  expect(validNoteDate('2026-03-08T02:30', true)).toBe(true);
  expect(validNoteDate('2026-11-16T10:30:15', true)).toBe(true);
  expect(validNoteDate('2026-11-16T10:30:15.250', true)).toBe(true);
  for (const date of ['2026-11-16', '2026-11-16T24:00', '2026-11-16T12:60', '2026-11-16T12:00:60', '2026-11-16T12:00Z']) expect(validNoteDate(date, true)).toBe(false);
});
it('keeps list types distinct, matches exact case, and preserves existing order and duplicates', () => {
  const raw = ['one', 'One', 1, '1', 'one'];
  expect(transformNoteValue(raw, { type: 'list', mode: 'add', values: ['one', 'two', 'two', 2] }, 'topics').value).toEqual([...raw, 'two', 2]);
  expect(transformNoteValue(raw, { type: 'list', mode: 'remove', values: ['one', 1] }, 'topics').value).toEqual(['One', '1']);
  expect(raw).toEqual(['one', 'One', 1, '1', 'one']);
});
it('keeps emptied lists, initializes empty values only on add, and rejects nested or mismatched values', () => {
  expect(transformNoteValue(['a'], { type: 'list', mode: 'remove', values: ['a'] }, 'topics').value).toEqual([]);
  expect(transformNoteValue(null, { type: 'list', mode: 'add', values: ['a'] }, 'topics').value).toEqual(['a']);
  expect(transformNoteValue(null, { type: 'list', mode: 'remove', values: ['a'] }, 'topics').value).toBeNull();
  for (const raw of [['a', ['b']], ['a', {}], [true], 'a']) expect(transformNoteValue(raw, { type: 'list', mode: 'add', values: ['b'] }, 'topics').error).toBeTruthy();
  expect(transformNoteValue('12', { type: 'number', mode: 'set', value: 12 }, 'rating').error).toBeTruthy();
  expect(transformNoteValue('false', { type: 'checkbox', mode: 'set', value: false }, 'done').error).toBeTruthy();
});
it('validates actual typed values and preserves text-only built-in lists', () => {
  expect(noteEditError({ type: 'checkbox', mode: 'set', value: 'false' }, 'done')).toBeTruthy();
  expect(noteEditError({ type: 'number', mode: 'set', value: '2' }, 'rating')).toBeTruthy();
  expect(noteEditError({ type: 'date', mode: 'set', value: '2025-02-29' }, 'due')).toBeTruthy();
  expect(noteEditError({ type: 'list', mode: 'add', values: [2] }, 'aliases')).toBeTruthy();
  expect(noteEditError({ type: 'list', mode: 'add', values: ['two'] }, 'cssclasses')).toBeUndefined();
});
