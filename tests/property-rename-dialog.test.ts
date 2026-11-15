// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
vi.mock('obsidian', () => ({ Modal: class { titleEl = document.createElement('h1'); contentEl = document.createElement('div'); close = vi.fn(); }, Notice: class {} }));
import { PropertyRenameModal } from '../src/property-rename-dialog';
import type { App } from 'obsidian';
it('shows conflicts and full preview, requires confirmation, and submits the latest displayed plan once', async () => {
  const apply = vi.fn().mockResolvedValue(undefined);
  const plan = { source: 'author', target: 'authors', total: 5, changes: Array.from({ length: 5 }, (_, i) => ({ path: `${i}.md`, key: 'author', targetKey: 'authors', original: 'Ada', replacement: 'Ada', before: '"Ada"', after: '"Ada"' })), conflicts: [{ path: 'conflict.md', message: 'Destination property already exists.' }] };
  const preview = vi.fn(() => plan);
  const modal = new PropertyRenameModal({} as App, { property: 'author', preview, apply });
  modal.onOpen();
  expect(modal.contentEl.textContent).toContain('conflict.md');
  expect(modal.contentEl.querySelectorAll('.pv-edit-path')).toHaveLength(5);
  expect(apply).not.toHaveBeenCalled();
  const input = modal.contentEl.querySelector('input')!;
  input.value = 'authors'; input.dispatchEvent(new Event('input'));
  expect(preview).toHaveBeenLastCalledWith('authors');
  const button = modal.contentEl.querySelector('.mod-cta') as HTMLButtonElement;
  button.click(); button.click(); await Promise.resolve();
  expect(apply).toHaveBeenCalledExactlyOnceWith(plan);
});
it('disables confirmation for invalid names or no eligible notes and cancels without writes', () => {
  const apply = vi.fn();
  const modal = new PropertyRenameModal({} as App, { property: 'author', preview: () => ({ source: 'author', target: '', total: 0, changes: [], conflicts: [], error: 'Enter a property name.' }), apply });
  modal.onOpen();
  expect((modal.contentEl.querySelector('.mod-cta') as HTMLButtonElement).disabled).toBe(true);
  (modal.contentEl.querySelector('button') as HTMLButtonElement).click();
  expect(apply).not.toHaveBeenCalled(); expect(modal.close).toHaveBeenCalled();
});
