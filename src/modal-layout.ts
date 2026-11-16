// SPDX-License-Identifier: MIT
import { usesTouchLayout } from './mobile-layout';

/** Fit the modal's outer container, independently of its centered content's position. */
export function fitModalViewport(container: HTMLElement): () => void {
  const win = container.ownerDocument.defaultView;
  if (!win) return () => {};
  const viewport = win.visualViewport;
  let frame: number | undefined;
  const clear = () => {
    container.classList.remove('pv-touch-modal');
    container.style.removeProperty('--pv-dialog-height');
    container.style.removeProperty('--pv-dialog-top');
  };
  const update = () => {
    frame = undefined;
    if (!usesTouchLayout(container)) { clear(); return; }
    // Keep the last unzoomed layout while the user pinch-zooms.
    if (viewport && viewport.scale !== 1) return;
    container.classList.add('pv-touch-modal');
    container.style.setProperty('--pv-dialog-height', `${Math.max(0, Math.floor(viewport?.height ?? win.innerHeight))}px`);
    container.style.setProperty('--pv-dialog-top', `${Math.max(0, Math.floor(viewport?.offsetTop ?? 0))}px`);
  };
  const schedule = () => {
    if (frame !== undefined) win.cancelAnimationFrame(frame);
    frame = win.requestAnimationFrame(update);
  };
  win.addEventListener('resize', schedule);
  viewport?.addEventListener('resize', schedule);
  viewport?.addEventListener('scroll', schedule);
  update();
  return () => {
    if (frame !== undefined) win.cancelAnimationFrame(frame);
    win.removeEventListener('resize', schedule);
    viewport?.removeEventListener('resize', schedule);
    viewport?.removeEventListener('scroll', schedule);
    clear();
  };
}
