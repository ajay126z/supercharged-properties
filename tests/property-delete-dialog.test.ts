// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
vi.mock('obsidian', () => ({ Modal: class { titleEl = document.createElement('h1'); contentEl = document.createElement('div'); close = vi.fn(); }, Notice: class {} }));
import { PropertyDeleteModal } from '../src/property-delete-dialog';
import type { App } from 'obsidian';

it('shows the full preview and conflicts, then requires explicit confirmation', async () => {
  const apply = vi.fn().mockResolvedValue(undefined);
  const plan = { property: 'author', total: 2, changes: Array.from({ length: 2 }, (_, i) => ({ path: `${i}.md`, key: 'author', original: 'Ada', replacement: undefined, remove: true, before: '"Ada"', after: '(removed)' })), conflicts: [{ path: 'conflict.md', message: 'Ambiguous source keys.' }] };
  const preview = vi.fn(() => plan);
  const modal = new PropertyDeleteModal({} as App, { property: 'author', preview, apply });
  modal.onOpen();
  expect(modal.contentEl.textContent).toContain('conflict.md');
  expect(modal.contentEl.querySelectorAll('.pv-edit-path')).toHaveLength(2);
  expect(apply).not.toHaveBeenCalled();
  const button = modal.contentEl.querySelector('.mod-warning') as HTMLButtonElement;
  expect(button.textContent).toBe('Delete from 2 notes');
  button.click(); button.click(); await Promise.resolve();
  expect(apply).toHaveBeenCalledExactlyOnceWith(plan);
});

it('disables confirmation when there is nothing to delete and cancels without writes', () => {
  const apply = vi.fn();
  const modal = new PropertyDeleteModal({} as App, { property: 'author', preview: () => ({ property: 'author', total: 0, changes: [], conflicts: [] }), apply });
  modal.onOpen();
  expect((modal.contentEl.querySelector('.mod-warning') as HTMLButtonElement).disabled).toBe(true);
  (modal.contentEl.querySelector('button') as HTMLButtonElement).click();
  expect(apply).not.toHaveBeenCalled();
  expect(modal.close).toHaveBeenCalled();
});
