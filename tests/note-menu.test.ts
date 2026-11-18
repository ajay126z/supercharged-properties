// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { attachNoteMenu } from '../src/note-menu';
let button: HTMLButtonElement, open: ReturnType<typeof vi.fn>, click: ReturnType<typeof vi.fn>, dispose: () => void;
function pointer(type: string, x = 20, y = 30) {
  button.dispatchEvent(Object.assign(new Event(type), { pointerType: 'touch', pointerId: 1, isPrimary: true, clientX: x, clientY: y }));
}
beforeEach(() => {
  vi.useFakeTimers(); button = document.createElement('button'); document.body.append(button);
  open = vi.fn(); click = vi.fn(); dispose = attachNoteMenu(button, open); button.addEventListener('click', click);
});
afterEach(() => { dispose(); document.body.replaceChildren(); vi.useRealTimers(); });
it('opens once on long press and suppresses the native duplicate and subsequent click', () => {
  pointer('pointerdown'); vi.advanceTimersByTime(500);
  expect(open).toHaveBeenCalledExactlyOnceWith({ x: 20, y: 30 });
  button.dispatchEvent(new MouseEvent('contextmenu', { cancelable: true }));
  pointer('pointerup'); button.click();
  expect(open).toHaveBeenCalledTimes(1); expect(click).not.toHaveBeenCalled();
  pointer('pointerdown'); pointer('pointerup'); button.click();
  expect(click).toHaveBeenCalledOnce();
});
it.each(['move', 'scroll', 'cancel', 'leave'])('cancels long press on %s', action => {
  pointer('pointerdown');
  if (action === 'move') pointer('pointermove', 100, 100);
  else if (action === 'scroll') document.dispatchEvent(new Event('scroll'));
  else pointer(action === 'cancel' ? 'pointercancel' : 'pointerleave');
  vi.advanceTimersByTime(600);
  button.dispatchEvent(new MouseEvent('contextmenu'));
  expect(open).not.toHaveBeenCalled();
});
it('preserves short tap and supports desktop and keyboard menus', () => {
  pointer('pointerdown'); vi.advanceTimersByTime(100); pointer('pointerup'); button.click();
  expect(click).toHaveBeenCalledOnce(); expect(open).not.toHaveBeenCalled();
  button.dispatchEvent(new MouseEvent('contextmenu', { clientX: 3, clientY: 4 }));
  expect(open).toHaveBeenLastCalledWith({ x: 3, y: 4 });
  button.dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', shiftKey: true }));
  expect(open).toHaveBeenCalledTimes(2);
});
it('cleans up a pending press when the row is re-rendered or closed', () => {
  pointer('pointerdown'); dispose(); vi.advanceTimersByTime(600);
  expect(open).not.toHaveBeenCalled();
});
it('handles a native touch menu firing before the timer', () => {
  pointer('pointerdown'); vi.advanceTimersByTime(250);
  button.dispatchEvent(new MouseEvent('contextmenu', { clientX: 20, clientY: 30 }));
  vi.advanceTimersByTime(500); pointer('pointerup'); button.click();
  expect(open).toHaveBeenCalledOnce(); expect(click).not.toHaveBeenCalled();
});

it('allows the click when touch pointerleave follows pointerup', () => {
  pointer('pointerdown'); vi.advanceTimersByTime(100);
  pointer('pointerup'); pointer('pointerleave'); button.click();
  expect(click).toHaveBeenCalledOnce(); expect(open).not.toHaveBeenCalled();
});
it('still suppresses a long-press click when pointerleave follows pointerup', () => {
  pointer('pointerdown'); vi.advanceTimersByTime(500);
  pointer('pointerup'); pointer('pointerleave'); button.click();
  expect(open).toHaveBeenCalledOnce(); expect(click).not.toHaveBeenCalled();
});
it('still suppresses a scrolling gesture but allows the next tap', () => {
  pointer('pointerdown'); pointer('pointermove', 80, 90);
  pointer('pointerup'); pointer('pointerleave'); button.click();
  expect(click).not.toHaveBeenCalled();
  pointer('pointerdown'); pointer('pointerup'); pointer('pointerleave'); button.click();
  expect(click).toHaveBeenCalledOnce();
});
