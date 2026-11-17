// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('obsidian', () => ({
  Modal: class { containerEl = document.createElement('div'); modalEl = document.createElement('div'); titleEl = document.createElement('h1'); contentEl = document.createElement('div'); close = vi.fn(); }, Notice: class {}
}));
import { NoteValueModal } from '../src/note-value-dialog';
let modal: NoteValueModal;
afterEach(() => { modal?.onClose(); vi.useRealTimers(); });
function setup(type: import('../src/note-value-operations').NoteEditType = 'text', values: Array<string | number> = ['todo', 'done', 'empty'], property = 'status') {
  const plan = { total: 1, changes: [{ path: 'a.md', key: 'status', before: '"todo"', after: '"done"', original: 'todo', replacement: 'done' }], conflicts: [{ path: 'b.md', message: 'Property is missing.' }], unchanged: 1 };
  const preview = vi.fn(() => plan), apply = vi.fn().mockResolvedValue(undefined);
  modal = new NoteValueModal({} as any, { property, type, count: 3, values, preview, apply });
  modal.onOpen();
  return { preview, apply, plan, select: modal.contentEl.querySelector('select')!, input: modal.contentEl.querySelector('input')!, button: modal.contentEl.querySelector('.mod-cta') as HTMLButtonElement };
}
it('requires a destination and explicit confirmation of the displayed preview', async () => {
  const { preview, apply, plan, select, button } = setup();
  expect(button.disabled).toBe(true); expect(apply).not.toHaveBeenCalled();
  select.value = 'value:1'; select.dispatchEvent(new Event('change'));
  expect(preview).toHaveBeenLastCalledWith({ type: 'text', mode: 'set', value: 'done' });
  expect(modal.contentEl.textContent).toContain('b.md: Property is missing.');
  expect(modal.contentEl.textContent).toContain('1 already match');
  button.click(); button.click(); await Promise.resolve();
  expect(apply).toHaveBeenCalledExactlyOnceWith(plan);
});
it('distinguishes literal empty from null and requires a nonblank custom value', () => {
  const { preview, select, input, button } = setup();
  select.value = 'value:2'; select.dispatchEvent(new Event('change'));
  expect(preview).toHaveBeenLastCalledWith({ type: 'text', mode: 'set', value: 'empty' });
  select.value = 'empty'; select.dispatchEvent(new Event('change'));
  expect(preview).toHaveBeenLastCalledWith({ type: 'text', mode: 'set', value: null });
  select.value = 'custom'; select.dispatchEvent(new Event('change'));
  expect(button.disabled).toBe(true);
  input.value = 'closed'; input.dispatchEvent(new Event('input'));
  expect(preview).toHaveBeenLastCalledWith({ type: 'text', mode: 'set', value: 'closed' }); expect(button.disabled).toBe(false);
  input.value = ' '; input.dispatchEvent(new Event('input')); expect(button.disabled).toBe(true);
});
it('disables apply when nothing changes and recovers from a failed submission', async () => {
  const { preview, apply, select, button } = setup();
  preview.mockReturnValueOnce({ total: 0, changes: [], conflicts: [], unchanged: 3 });
  select.value = 'value:1'; select.dispatchEvent(new Event('change')); expect(button.disabled).toBe(true);
  select.dispatchEvent(new Event('change'));
  apply.mockRejectedValueOnce(new Error('busy'));
  button.click(); await Promise.resolve(); await Promise.resolve();
  expect(select.disabled).toBe(false); expect(button.disabled).toBe(false);
});
it.each([['number', '-2.5', -2.5, 'number'], ['date', '2026-12-31', '2026-12-31', 'date'], ['datetime', '2026-12-31T10:30:15', '2026-12-31T10:30:15', 'datetime-local']] as const)('uses a typed %s input and generates the correct preview request', (type, entered, value, inputType) => {
  const { preview, select, input, button } = setup(type, []);
  expect(input.type).toBe(inputType);
  select.value = 'custom'; select.dispatchEvent(new Event('change')); expect(button.disabled).toBe(true);
  input.value = entered; input.dispatchEvent(new Event('input'));
  expect(preview).toHaveBeenLastCalledWith({ type, mode: 'set', value }); expect(button.disabled).toBe(false);
  select.value = 'empty'; select.dispatchEvent(new Event('change'));
  expect(preview).toHaveBeenLastCalledWith({ type, mode: 'set', value: null });
});
it('requires an explicit checkbox destination and sends false as a boolean', () => {
  const { preview, select, button } = setup('checkbox', []);
  expect(button.disabled).toBe(true);
  select.value = 'false'; select.dispatchEvent(new Event('change'));
  expect(preview).toHaveBeenLastCalledWith({ type: 'checkbox', mode: 'set', value: false });
  select.value = 'true'; select.dispatchEvent(new Event('change'));
  expect(preview).toHaveBeenLastCalledWith({ type: 'checkbox', mode: 'set', value: true });
});
it('combines selected typed list items with custom lines for add/remove and blocks invalid numbers', () => {
  const { preview, select, button } = setup('list', ['1', 1, 'other']);
  expect(button.disabled).toBe(true);
  const checkboxes = modal.contentEl.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
  checkboxes[0].click(); checkboxes[1].click();
  const input = modal.contentEl.querySelector('textarea')!;
  input.value = 'new\nnew\nsecond'; input.dispatchEvent(new Event('input'));
  expect(preview).toHaveBeenLastCalledWith({ type: 'list', mode: 'add', values: ['1', 1, 'new', 'second'] });
  select.value = 'remove'; select.dispatchEvent(new Event('change'));
  expect(preview).toHaveBeenLastCalledWith({ type: 'list', mode: 'remove', values: ['1', 1, 'new', 'second'] });
  const itemType = modal.contentEl.querySelector('[aria-label="Entered value type"]') as HTMLSelectElement;
  itemType.value = 'number'; itemType.dispatchEvent(new Event('change')); expect(button.disabled).toBe(true);
  input.value = '2\n3.5'; input.dispatchEvent(new Event('input'));
  expect(preview).toHaveBeenLastCalledWith({ type: 'list', mode: 'remove', values: ['1', 1, 2, 3.5] });
});
it('keeps aliases and cssclasses custom input as text', () => {
  setup('list', [], 'aliases');
  expect((modal.contentEl.querySelector('[aria-label="Entered value type"]')!.parentElement as HTMLElement).hidden).toBe(true);
});
it.each(['text', 'number', 'checkbox', 'date', 'datetime', 'list'] as const)('offers explicit whole-property removal for %s and requires confirmation', async type => {
  const { preview, select, apply, plan, button } = setup(type, ['one', 'two']);
  select.value = 'delete'; select.dispatchEvent(new Event('change'));
  expect(preview).toHaveBeenLastCalledWith({ type, mode: 'delete' });
  expect(button.textContent).toBe('Remove property from 1 note');
  expect(button.classList.contains('mod-warning')).toBe(true);
  expect(modal.contentEl.textContent).toContain('entire status property and all its values');
  expect(apply).not.toHaveBeenCalled();
  button.click(); await Promise.resolve(); expect(apply).toHaveBeenCalledWith(plan);
});
it('hides list item controls for whole-property removal, ignores their invalid input, and restores them when switching back', () => {
  const { preview, select, button } = setup('list', ['one', 'two']);
  const input = modal.contentEl.querySelector('textarea')!;
  const itemType = modal.contentEl.querySelector('[aria-label="Entered value type"]') as HTMLSelectElement;
  itemType.value = 'number'; input.value = 'invalid'; input.dispatchEvent(new Event('input'));
  expect(button.disabled).toBe(true);
  select.value = 'delete'; select.dispatchEvent(new Event('change'));
  expect(button.disabled).toBe(false); expect(input.parentElement!.hidden).toBe(true);
  expect(preview).toHaveBeenLastCalledWith({ type: 'list', mode: 'delete' });
  select.value = 'remove'; select.dispatchEvent(new Event('change'));
  expect(button.disabled).toBe(true); expect(input.parentElement!.hidden).toBe(false);
  expect(button.classList.contains('mod-warning')).toBe(false); expect(input.value).toBe('invalid');
});
it('keeps Set empty separate from Remove property and clears destructive styling when switching', () => {
  const { preview, select, button } = setup();
  select.value = 'delete'; select.dispatchEvent(new Event('change'));
  select.value = 'empty'; select.dispatchEvent(new Event('change'));
  expect(preview).toHaveBeenLastCalledWith({ type: 'text', mode: 'set', value: null });
  expect(button.textContent).toBe('Apply to 1 note'); expect(button.classList.contains('mod-warning')).toBe(false);
});
