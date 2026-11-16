// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('obsidian', () => ({
  Modal: class { titleEl = document.createElement('h1'); contentEl = document.createElement('div'); close = vi.fn(); }, Notice: class {}
}));
import { ValueEditModal } from '../src/value-dialog';
import type { App } from 'obsidian';
afterEach(() => vi.useRealTimers());
it('shows all preview paths and applies only the displayed preview after explicit confirmation', async () => {
  const plan = { total: 6, changes: Array.from({ length: 6 }, (_, i) => ({ path: `${i}.md`, key: 'status', before: 'doing', after: 'active', original: 'doing', replacement: 'active' })) };
  const apply = vi.fn().mockResolvedValue(undefined);
  const modal = new ValueEditModal({} as App, { request: { property: 'status', kind: 'string', value: 'doing', mode: 'rename', replacement: 'active' }, siblings: [], preview: () => plan, apply });
  modal.onOpen();
  expect(modal.contentEl.querySelectorAll('.pv-edit-change')).toHaveLength(6);
  expect(apply).not.toHaveBeenCalled();
  (modal.contentEl.querySelector('.mod-cta') as HTMLButtonElement).click();
  await Promise.resolve();
  expect(apply).toHaveBeenCalledWith(plan);
});
it('disables confirmation while a changed input awaits its preview and for blank inputs', () => {
  vi.useFakeTimers();
  const modal = new ValueEditModal({} as App, { request: { property: 'status', kind: 'string', value: 'doing', mode: 'rename', replacement: 'doing' }, siblings: [], preview: () => ({ total: 1, changes: [] }), apply: vi.fn() });
  modal.onOpen();
  const input = modal.contentEl.querySelector('input')!;
  input.value = ''; input.dispatchEvent(new Event('input'));
  expect((modal.contentEl.querySelector('.mod-cta') as HTMLButtonElement).disabled).toBe(true);
  vi.advanceTimersByTime(120);
  expect((modal.contentEl.querySelector('.mod-cta') as HTMLButtonElement).disabled).toBe(true);
});
it('offers a destructive delete confirmation without an input', async () => {
  const plan = { total: 2, changes: [
    { path: 'a.md', key: 'status', before: '"obsolete"', after: '(removed)', original: 'obsolete', replacement: undefined, remove: true },
    { path: 'b.md', key: 'status', before: '["active","obsolete"]', after: '["active"]', original: ['active', 'obsolete'], replacement: ['active'], remove: false }
  ] };
  const apply = vi.fn().mockResolvedValue(undefined);
  const modal = new ValueEditModal({} as App, { request: { property: 'status', kind: 'string', value: 'obsolete', mode: 'delete' }, siblings: [], preview: () => plan, apply });
  modal.onOpen();
  expect(modal.titleEl.textContent).toBe('Delete value');
  expect(modal.contentEl.querySelector('input')).toBeNull();
  const button = modal.contentEl.querySelector('.mod-cta') as HTMLButtonElement;
  expect(button.classList.contains('mod-warning')).toBe(true);
  expect(button.textContent).toBe('Delete from 2 notes');
  expect(modal.contentEl.textContent).toContain('(removed)');
  button.click(); await Promise.resolve();
  expect(apply).toHaveBeenCalledWith(plan);
});
