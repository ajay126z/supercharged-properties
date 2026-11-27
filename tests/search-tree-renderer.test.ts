// @vitest-environment jsdom
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {SearchTreeRenderer} from '../src/search-tree-renderer';
let notify: IntersectionObserverCallback;
let frames: Map<number, FrameRequestCallback>;
let renderer: SearchTreeRenderer;
let root: HTMLElement;
let disconnect: ReturnType<typeof vi.fn>;
beforeEach(() => {
  root = document.createElement('div'); document.body.append(root);
  frames = new Map(); let id = 0;
  disconnect = vi.fn();
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: IntersectionObserverCallback) { notify = callback; }
    observe() {} unobserve() {} disconnect = disconnect;
  });
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frames.set(++id, callback); return id; });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => { frames.delete(id); });
  renderer = new SearchTreeRenderer(root);
});
afterEach(() => { renderer.reset(); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.replaceChildren(); });
function branch() { const element = document.createElement('div'); root.append(element); return element; }
function visible(...elements: HTMLElement[]) { notify(elements.map(target => ({target, isIntersecting: true})) as IntersectionObserverEntry[], {} as IntersectionObserver); }
function frame() { const pending = [...frames.values()]; frames.clear(); for (const run of pending) run(0); }
it('renders only intersecting branches, in document order, on the next frame', () => {
  const a = branch(), b = branch(), c = branch(), calls: string[] = [];
  renderer.add(a, 100, () => calls.push('a')); renderer.add(b, 100, () => calls.push('b')); renderer.add(c, 100, () => calls.push('c'));
  expect(calls).toEqual([]); expect(a.style.minHeight).toBe('100px');
  visible(b, a); expect(calls).toEqual([]); frame();
  expect(calls).toEqual(['a', 'b']); expect(a.hasAttribute('aria-busy')).toBe(false);
  expect(c.getAttribute('aria-busy')).toBe('true');
  visible(c); frame(); expect(calls).toEqual(['a','b','c']);
});
it('cancels queued and late observer callbacks when the query changes or the view closes', () => {
  const a = branch(), run = vi.fn(); renderer.add(a, 100, run); const oldNotify = notify;
  visible(a); renderer.reset(); frame();
  oldNotify([{target:a,isIntersecting:true}] as IntersectionObserverEntry[], {} as IntersectionObserver); frame();
  expect(run).not.toHaveBeenCalled(); expect(disconnect).toHaveBeenCalled();
});
it('yields between branches when a frame reaches its time budget', () => {
  const a = branch(), b = branch(), run = vi.fn(); let time = 0;
  vi.spyOn(window.performance, 'now').mockImplementation(() => time);
  renderer.add(a, 100, () => { run('a'); time += 7; }); renderer.add(b, 100, () => run('b'));
  visible(a, b); frame(); expect(run.mock.calls).toEqual([['a']]);
  frame(); expect(run.mock.calls).toEqual([['a'], ['b']]);
});
it('flushes nested branches for complete keyboard navigation and range selection', () => {
  const a = branch(), b = branch(), run = vi.fn();
  renderer.add(a, 100, () => { const child = document.createElement('div'); a.append(child); renderer.add(child, 40, () => run('child')); });
  renderer.add(b, 100, () => run('other')); renderer.flush(a);
  expect(run.mock.calls).toEqual([['child']]); expect(a.querySelector('[aria-busy]')).toBeNull();
  visible(a); frame(); expect(run).toHaveBeenCalledTimes(1);
});
it('renders eagerly without an observer or for a focused branch', () => {
  const run = vi.fn(); renderer.add(branch(), 100, run, true);
  vi.stubGlobal('IntersectionObserver', undefined); renderer.add(branch(), 100, run);
  expect(run).toHaveBeenCalledTimes(2);
});
