// SPDX-License-Identifier: MIT
/** Materialize search branches near the viewport, yielding between small chunks. */
export class SearchTreeRenderer {
  private observer?: IntersectionObserver;
  private pending = new Map<HTMLElement, () => void>();
  private ready: HTMLElement[] = [];
  private frame?: number;
  private generation = 0;
  private win: Window & typeof globalThis;
  constructor(private root: HTMLElement) { this.win = root.ownerDocument.defaultView!; }
  reset(): void {
    this.generation++;
    this.observer?.disconnect(); this.observer = undefined;
    this.pending.clear(); this.ready = [];
    if (this.frame !== undefined) this.win.cancelAnimationFrame(this.frame);
    this.frame = undefined;
  }
  add(parent: HTMLElement, height: number, render: () => void, eager = false): void {
    if (eager || !this.win.IntersectionObserver) { render(); return; }
    if (!this.observer) {
      const generation = this.generation;
      this.observer = new this.win.IntersectionObserver(entries => {
        if (generation !== this.generation) return;
        for (const entry of entries) if (entry.isIntersecting && this.pending.has(entry.target as HTMLElement)) {
          this.observer?.unobserve(entry.target); this.ready.push(entry.target as HTMLElement);
        }
        this.schedule();
      }, {root: this.root, rootMargin: '300px 0px'});
    }
    parent.style.minHeight = `${Math.max(28, height)}px`;
    parent.setAttribute('aria-busy', 'true');
    parent.classList.add('pv-search-pending');
    this.pending.set(parent, render); this.observer.observe(parent);
  }
  /** Keyboard navigation and range selection need the complete branch in DOM order. */
  flush(root: HTMLElement): void {
    for (const [parent, render] of this.pending) {
      if (root === parent || root.contains(parent)) {
        this.pending.delete(parent); this.observer?.unobserve(parent);
        parent.style.removeProperty('min-height'); parent.removeAttribute('aria-busy'); parent.classList.remove('pv-search-pending');
        render();
      }
    }
  }
  private schedule(): void {
    if (this.frame !== undefined || !this.ready.length) return;
    const generation = this.generation;
    this.frame = this.win.requestAnimationFrame(() => {
      this.frame = undefined;
      if (generation !== this.generation) return;
      const start = this.win.performance.now();
      // DOM order keeps progressive results predictable when several branches enter together.
      this.ready.sort((a,b) => a.compareDocumentPosition(b) & this.win.Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
      while (this.ready.length) {
        const parent = this.ready.shift()!, render = this.pending.get(parent);
        this.pending.delete(parent);
        if (render && parent.isConnected) {
          parent.style.removeProperty('min-height'); parent.removeAttribute('aria-busy'); parent.classList.remove('pv-search-pending');
          render();
          if (generation !== this.generation) return;
        }
        if (this.win.performance.now() - start >= 6) break;
      }
      this.schedule();
    });
  }
}
