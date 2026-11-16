// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { fitModalViewport } from '../src/modal-layout';
const originalViewport = Object.getOwnPropertyDescriptor(window, 'visualViewport');
let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.(); dispose = undefined;
  document.body.classList.remove('is-mobile');
  document.body.replaceChildren();
  if (originalViewport) Object.defineProperty(window, 'visualViewport', originalViewport);
  else Reflect.deleteProperty(window, 'visualViewport');
  vi.useRealTimers();
});
it('uses the whole visible viewport without depending on centered modal geometry, and restores after keyboard dismissal', () => {
  vi.useFakeTimers(); document.body.classList.add('is-mobile');
  const viewport = Object.assign(new EventTarget(), { height: 844, offsetTop: 0, scale: 1 });
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
  const container = document.body.createDiv();
  const measure = vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({ top: 600 } as DOMRect);
  dispose = fitModalViewport(container);
  expect(container.classList.contains('pv-touch-modal')).toBe(true);
  expect(container.style.getPropertyValue('--pv-dialog-height')).toBe('844px');
  viewport.height = 280; viewport.offsetTop = 20; viewport.dispatchEvent(new Event('resize'));
  vi.advanceTimersByTime(20);
  expect(container.style.getPropertyValue('--pv-dialog-height')).toBe('280px');
  expect(container.style.getPropertyValue('--pv-dialog-top')).toBe('20px');
  viewport.height = 844; viewport.offsetTop = 0; viewport.dispatchEvent(new Event('scroll'));
  vi.advanceTimersByTime(20);
  expect(container.style.getPropertyValue('--pv-dialog-height')).toBe('844px');
  expect(measure).not.toHaveBeenCalled();
});
it('keeps desktop sizing intact, handles window resize fallback, and cleans up pending work', () => {
  vi.useFakeTimers();
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined });
  const container = document.body.createDiv(); dispose = fitModalViewport(container);
  expect(container.classList.contains('pv-touch-modal')).toBe(false);
  document.body.classList.add('is-mobile'); window.dispatchEvent(new Event('resize'));
  vi.advanceTimersByTime(20);
  expect(container.style.getPropertyValue('--pv-dialog-height')).toBe(`${window.innerHeight}px`);
  window.dispatchEvent(new Event('resize')); dispose(); vi.advanceTimersByTime(20);
  expect(container.classList.contains('pv-touch-modal')).toBe(false);
  expect(container.style.getPropertyValue('--pv-dialog-height')).toBe('');
});
it('does not resize the dialog while pinch zoom is active', () => {
  vi.useFakeTimers(); document.body.classList.add('is-mobile');
  const viewport = Object.assign(new EventTarget(), { height: 844, offsetTop: 0, scale: 1 });
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
  const container = document.body.createDiv(); dispose = fitModalViewport(container);
  viewport.scale = 2; viewport.height = 422; viewport.dispatchEvent(new Event('resize')); vi.advanceTimersByTime(20);
  expect(container.style.getPropertyValue('--pv-dialog-height')).toBe('844px');
});
