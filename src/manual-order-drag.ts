// SPDX-License-Identifier: MIT
export interface ManualDragOptions {
  rows: HTMLElement[];
  keys: string[];
  scrollEl: HTMLElement;
  onStart?: () => void;
  onEnd?: () => void;
  onDrop: (key: string, before: string | null) => void;
}
/** Pointer-only preview: never move Explorer/tree DOM nodes during a gesture. */
export function attachManualOrderDrag({rows, keys, scrollEl, onDrop, onStart, onEnd}: ManualDragOptions): () => void {
  const doc = scrollEl.ownerDocument, win = doc.defaultView!;
  let state: {id: number; key: string; grip: HTMLElement; x: number; y: number; currentY: number; currentX: number; active: boolean} | undefined;
  let indicator: HTMLElement | undefined, frame: number | undefined;
  let before: string | null | undefined;
  const header = (row: HTMLElement) => row.querySelector<HTMLElement>('.pv-property-row') ?? row;
  const clear = (notify = true) => {
    const previous = state; state = undefined; before = undefined;
    if (frame !== undefined) win.cancelAnimationFrame(frame); frame = undefined;
    indicator?.remove(); indicator = undefined;
    scrollEl.classList.remove('pv-dragging');
    scrollEl.querySelectorAll('.pv-drag-other-group').forEach(row => row.classList.remove('pv-drag-other-group'));
    try { if (previous?.grip.hasPointerCapture?.(previous.id)) previous.grip.releasePointerCapture(previous.id); } catch { /* View may have closed. */ }
    if (previous && notify) onEnd?.();
  };
  const update = () => {
    if (!state?.active || !indicator) return;
    const y = state.currentY, viewport = scrollEl.getBoundingClientRect();
    const allRows = Array.from(scrollEl.querySelectorAll<HTMLElement>(':scope > .pv-group'));
    const firstIndex = allRows.indexOf(rows[0]), lastIndex = allRows.indexOf(rows[rows.length - 1]);
    const first = header(rows[0]).getBoundingClientRect(), last = rows[rows.length - 1].getBoundingClientRect();
    // Empty space at the pane edges is a valid first/last slot. Never cross a pinned boundary.
    const top = firstIndex > 0 ? first.top : viewport.top;
    const bottom = lastIndex < allRows.length - 1 ? allRows[lastIndex + 1].getBoundingClientRect().top : viewport.bottom;
    if (state.currentX < viewport.left || state.currentX > viewport.right || y < Math.max(top, viewport.top) || y >= Math.min(bottom, viewport.bottom)) {
      before = undefined; indicator.hidden = true; return;
    }
    const target = rows.findIndex(row => { const rect = header(row).getBoundingClientRect(); return y < rect.top + rect.height / 2; });
    before = target < 0 ? null : keys[target]; indicator.hidden = false;
    const indicatorTop = target < 0 ? last.bottom : header(rows[target]).getBoundingClientRect().top;
    indicator.style.top = `${indicatorTop - viewport.top + scrollEl.scrollTop}px`;
  };
  const tick = () => {
    if (!state?.active) return;
    const rect = scrollEl.getBoundingClientRect(), y = state.currentY;
    const delta = y < rect.top + 40 ? -Math.min(12, (rect.top + 40 - y) / 3) : y > rect.bottom - 40 ? Math.min(12, (y - rect.bottom + 40) / 3) : 0;
    if (delta) scrollEl.scrollTop += delta;
    update(); frame = win.requestAnimationFrame(tick);
  };
  const down = (event: PointerEvent) => {
    if (event.button !== 0 || event.isPrimary === false || state) return;
    const grip = (event.target as Element).closest<HTMLElement>('.pv-grip');
    const row = grip?.closest<HTMLElement>('.pv-group'), index = row ? rows.indexOf(row) : -1;
    if (!grip || index < 0 || rows.length < 2) return;
    grip.focus({preventScroll: true});
    state = {id: event.pointerId, key: keys[index], grip, x: event.clientX, y: event.clientY, currentY: event.clientY, currentX: event.clientX, active: false};
    onStart?.();
    try { grip.setPointerCapture(event.pointerId); } catch { /* Document listeners also support hosts without capture. */ }
  };
  const move = (event: PointerEvent) => {
    if (!state || state.id !== event.pointerId) return;
    state.currentY = event.clientY; state.currentX = event.clientX;
    if (!state.active && Math.hypot(event.clientX - state.x, event.clientY - state.y) >= 4) {
      state.active = true; scrollEl.classList.add('pv-dragging');
      scrollEl.querySelectorAll<HTMLElement>(':scope > .pv-group').forEach(row => row.classList.toggle('pv-drag-other-group', !rows.includes(row)));
      indicator = scrollEl.createDiv({cls: 'pv-drop-indicator'}); indicator.setAttribute('aria-hidden', 'true');
      frame = win.requestAnimationFrame(tick);
    }
    if (state.active) { event.preventDefault(); update(); }
  };
  const up = (event: PointerEvent) => {
    if (!state || state.id !== event.pointerId) return;
    const {key, active} = state; state.currentY = event.clientY; state.currentX = event.clientX; update(); const target = before;
    clear(false);
    if (!active) { onEnd?.(); return; }
    event.preventDefault();
    // Survive the drop's full render long enough to suppress the compatibility click.
    const suppress = (click: MouseEvent) => { click.preventDefault(); click.stopImmediatePropagation(); remove(); };
    const remove = () => { doc.removeEventListener('click', suppress, true); doc.removeEventListener('pointerdown', remove, true); win.clearTimeout(timer); };
    const timer = win.setTimeout(remove, 500); doc.addEventListener('click', suppress, true); doc.addEventListener('pointerdown', remove, true);
    try { if (target !== undefined) onDrop(key, target); } finally { onEnd?.(); }
  };
  const cancel = (event: PointerEvent) => { if (state?.id === event.pointerId) clear(); };
  const keydown = (event: KeyboardEvent) => { if (state && event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); clear(); } };
  scrollEl.addEventListener('pointerdown', down);
  doc.addEventListener('pointermove', move, {passive: false}); doc.addEventListener('pointerup', up);
  doc.addEventListener('pointercancel', cancel); doc.addEventListener('lostpointercapture', cancel); doc.addEventListener('keydown', keydown, true);
  return () => {
    clear(); scrollEl.removeEventListener('pointerdown', down);
    doc.removeEventListener('pointermove', move); doc.removeEventListener('pointerup', up);
    doc.removeEventListener('pointercancel', cancel); doc.removeEventListener('lostpointercapture', cancel); doc.removeEventListener('keydown', keydown, true);
  };
}
