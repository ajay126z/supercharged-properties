// SPDX-License-Identifier: MIT

/** Desktop context menus and touch long-press, with scroll cancellation and click suppression. */
export function attachNoteMenu(element: HTMLElement, open: (point: { x: number; y: number }) => void): () => void {
  const doc = element.ownerDocument;
  const win = doc.defaultView;
  if (!win) return () => {};
  let timer: number | undefined;
  let start: { x: number; y: number; id: number } | undefined;
  let suppressed = false;
  let opened = false;
  let moved = false;
  const cancel = () => {
    win.clearTimeout(timer); timer = undefined;
    doc.removeEventListener('scroll', scroll, true);
  };
  const scroll = () => { moved = true; suppressed = true; cancel(); };
  const down = (event: PointerEvent) => {
    cancel();
    if (event.isPrimary === false) { moved = true; return; }
    suppressed = opened = moved = false;
    start = undefined;
    if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
    start = { x: event.clientX, y: event.clientY, id: event.pointerId };
    doc.addEventListener('scroll', scroll, true);
    timer = win.setTimeout(() => {
      timer = undefined; suppressed = opened = true;
      open({ x: event.clientX, y: event.clientY });
    }, 500);
  };
  const move = (event: PointerEvent) => {
    if (start?.id === event.pointerId && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) {
      moved = true; suppressed = true; cancel();
    }
  };
  const up = () => { cancel(); start = undefined; };
  const abort = (event: PointerEvent) => {
    // Touch can leave after pointerup but before click. Only cancel an active press.
    if (!start || start.id !== event.pointerId) return;
    moved = true; suppressed = true; up();
  };
  const context = (event: MouseEvent) => {
    event.preventDefault(); cancel();
    if (opened || moved) return;
    suppressed = true;
    // Native touch contextmenu may precede the timer. Never show both menus.
    opened = !!start;
    open({ x: event.clientX, y: event.clientY });
  };
  const click = (event: MouseEvent) => {
    if (suppressed) { event.preventDefault(); event.stopImmediatePropagation(); }
  };
  const key = (event: KeyboardEvent) => {
    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
      event.preventDefault(); cancel();
      const rect = element.getBoundingClientRect();
      open({ x: rect.left, y: rect.bottom });
    } else if (event.key === 'Enter' || event.key === ' ') suppressed = false;
  };
  element.addEventListener('pointerdown', down);
  element.addEventListener('pointermove', move);
  element.addEventListener('pointerup', up);
  element.addEventListener('pointercancel', abort);
  element.addEventListener('pointerleave', abort);
  element.addEventListener('contextmenu', context);
  element.addEventListener('click', click, true);
  element.addEventListener('keydown', key);
  return () => {
    cancel();
    element.removeEventListener('pointerdown', down);
    element.removeEventListener('pointermove', move);
    element.removeEventListener('pointerup', up);
    element.removeEventListener('pointercancel', abort);
    element.removeEventListener('pointerleave', abort);
    element.removeEventListener('contextmenu', context);
    element.removeEventListener('click', click, true);
    element.removeEventListener('keydown', key);
  };
}
