// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { fitVisibleViewport, usesTouchLayout } from '../src/mobile-layout';
const originalViewport = Object.getOwnPropertyDescriptor(window, 'visualViewport');
afterEach(() => {
  document.body.classList.remove('is-mobile');
  document.body.replaceChildren();
  if (originalViewport) Object.defineProperty(window, 'visualViewport', originalViewport);
  else Reflect.deleteProperty(window, 'visualViewport');
  vi.useRealTimers();
});
it('fits a mobile view to keyboard resize and pan events, restores on dismissal, and cleans up', () => {
  vi.useFakeTimers(); document.body.classList.add('is-mobile');
  const viewport = Object.assign(new EventTarget(), { height: 760, offsetTop: 0, scale: 1 });
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
  const element = document.body.createDiv();
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({ top: 90 } as DOMRect);
  const cleanup = fitVisibleViewport(element);
  vi.advanceTimersByTime(20); expect(element.style.getPropertyValue('--pv-visible-height')).toBe('670px');
  viewport.height = 330; viewport.dispatchEvent(new Event('resize'));
  vi.advanceTimersByTime(20); expect(element.style.getPropertyValue('--pv-visible-height')).toBe('240px');
  viewport.offsetTop = 20; viewport.dispatchEvent(new Event('scroll'));
  vi.advanceTimersByTime(20); expect(element.style.getPropertyValue('--pv-visible-height')).toBe('260px');
  viewport.height = 760; viewport.offsetTop = 0; viewport.dispatchEvent(new Event('resize'));
  vi.advanceTimersByTime(20); expect(element.style.getPropertyValue('--pv-visible-height')).toBe('670px');
  cleanup(); viewport.height = 300; viewport.dispatchEvent(new Event('resize'));
  vi.advanceTimersByTime(20); expect(element.style.getPropertyValue('--pv-visible-height')).toBe('');
});
it('leaves desktop sizing and pinch zoom alone', () => {
  vi.useFakeTimers();
  const viewport = Object.assign(new EventTarget(), { height: 300, offsetTop: 0, scale: 1 });
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
  const element = document.body.createDiv(); const cleanup = fitVisibleViewport(element);
  vi.advanceTimersByTime(20); expect(usesTouchLayout(element)).toBe(false);
  expect(element.style.getPropertyValue('--pv-visible-height')).toBe('');
  document.body.classList.add('is-mobile'); viewport.scale = 2; viewport.dispatchEvent(new Event('resize'));
  vi.advanceTimersByTime(20); expect(element.style.getPropertyValue('--pv-visible-height')).toBe(''); cleanup();
});
it('falls back to the window height without VisualViewport and cancels pending updates', () => {
  vi.useFakeTimers(); document.body.classList.add('is-mobile');
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined });
  const element = document.body.createDiv(); const cleanup = fitVisibleViewport(element);
  vi.advanceTimersByTime(20); expect(element.style.getPropertyValue('--pv-visible-height')).toBe(`${window.innerHeight}px`);
  element.dispatchEvent(new Event('focusin')); cleanup(); vi.advanceTimersByTime(20);
  expect(element.style.getPropertyValue('--pv-visible-height')).toBe('');
});
