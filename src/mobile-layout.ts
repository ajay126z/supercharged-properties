// SPDX-License-Identifier: MIT

export function usesTouchLayout(element: HTMLElement): boolean {
  return element.ownerDocument.body.classList.contains('is-mobile')
    || !!element.ownerDocument.defaultView?.matchMedia?.('(pointer: coarse)').matches;
}

/** Bound the view to the visible viewport when the on-screen keyboard overlays the layout viewport. */
export function fitVisibleViewport(element: HTMLElement): () => void {
  const win = element.ownerDocument.defaultView;
  if (!win) return () => {};
  let frame: number | undefined;
  const viewport = win.visualViewport;
  const update = () => {
    frame = undefined;
    if (!usesTouchLayout(element) || (viewport && viewport.scale !== 1)) {
      element.style.removeProperty('--pv-visible-height');
      return;
    }
    const bottom = viewport ? viewport.offsetTop + viewport.height : win.innerHeight;
    const height = Math.max(0, Math.floor(bottom - element.getBoundingClientRect().top));
    element.style.setProperty('--pv-visible-height', `${height}px`);
  };
  const schedule = () => {
    if (frame !== undefined) win.cancelAnimationFrame(frame);
    frame = win.requestAnimationFrame(update);
  };
  win.addEventListener('resize', schedule);
  viewport?.addEventListener('resize', schedule);
  viewport?.addEventListener('scroll', schedule);
  element.addEventListener('focusin', schedule);
  element.addEventListener('focusout', schedule);
  // Pane changes can move the view without resizing the window.
  const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(schedule);
  if (element.parentElement) observer?.observe(element.parentElement);
  schedule();
  return () => {
    if (frame !== undefined) win.cancelAnimationFrame(frame);
    win.removeEventListener('resize', schedule);
    viewport?.removeEventListener('resize', schedule);
    viewport?.removeEventListener('scroll', schedule);
    element.removeEventListener('focusin', schedule);
    element.removeEventListener('focusout', schedule);
    observer?.disconnect();
    element.style.removeProperty('--pv-visible-height');
  };
}
