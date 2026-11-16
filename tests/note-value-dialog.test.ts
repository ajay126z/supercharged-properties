// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('obsidian', () => ({
  Modal: class { containerEl = document.createElement('div'); modalEl = document.createElement('div'); titleEl = document.createElement('h1'); contentEl = document.createElement('div'); close = vi.fn(); }, Notice: class {}
}));
import { NoteValueModal } from '../src/note-value-dialog';
let modal: NoteValueModal;
afterEach(() => { modal?.onClose(); vi.useRealTimers(); });
function setup() {
  const plan = { total: 1, changes: [{ path: 'a.md', key: 'status', before: '"todo"', after: '"done"', original: 'todo', replacement: 'done' }], conflicts: [{ path: 'b.md', message: 'Property is missing.' }], unchanged: 1 };
  const preview = vi.fn(() => plan), apply = vi.fn().mockResolvedValue(undefined);
  modal = new NoteValueModal({} as any, { property: 'status', count: 3, values: ['todo', 'done', 'empty'], preview, apply });
  modal.onOpen();
  return { preview, apply, plan, select: modal.contentEl.querySelector('select')!, input: modal.contentEl.querySelector('input')!, button: modal.contentEl.querySelector('.mod-cta') as HTMLButtonElement };
}
it('requires a destination and explicit confirmation of the displayed preview', async () => {
  const { preview, apply, plan, select, button } = setup();
  expect(button.disabled).toBe(true); expect(apply).not.toHaveBeenCalled();
  select.value = 'value:1'; select.dispatchEvent(new Event('change'));
  expect(preview).toHaveBeenLastCalledWith('done');
  expect(modal.contentEl.textContent).toContain('b.md: Property is missing.');
  expect(modal.contentEl.textContent).toContain('1 already match');
  button.click(); button.click(); await Promise.resolve();
  expect(apply).toHaveBeenCalledExactlyOnceWith(plan);
});
it('distinguishes literal empty from null and requires a nonblank custom value', () => {
  const { preview, select, input, button } = setup();
  select.value = 'value:2'; select.dispatchEvent(new Event('change'));
  expect(preview).toHaveBeenLastCalledWith('empty');
  select.value = 'empty'; select.dispatchEvent(new Event('change'));
  expect(preview).toHaveBeenLastCalledWith(null);
  select.value = 'custom'; select.dispatchEvent(new Event('change'));
  expect(button.disabled).toBe(true);
  input.value = 'closed'; input.dispatchEvent(new Event('input'));
  expect(preview).toHaveBeenLastCalledWith('closed'); expect(button.disabled).toBe(false);
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
