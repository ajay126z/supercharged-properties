// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
vi.mock('obsidian', () => ({setIcon: () => {}}));
import { ViewPicker } from '../src/view-picker';
let picker: ViewPicker;
let change: ReturnType<typeof vi.fn>;
const options = () => [...document.querySelectorAll<HTMLButtonElement>('.pv-view-option')];
const key = (value: string) => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', {key:value,bubbles:true,cancelable:true}));
beforeEach(() => {
  document.body.replaceChildren();
  change=vi.fn();picker=new ViewPicker(document.body, change);
  picker.button.getBoundingClientRect=()=>({left:20,right:300,top:40,bottom:70,width:280,height:30} as DOMRect);
  picker.setChoices(Array.from({length:12},(_,i)=>({value:String(i),label:`View ${i+1}`})),'8');
});
afterEach(() => {picker.close(false);vi.unstubAllGlobals();});
it('opens below the bar with every choice inside a bounded scrolling list', () => {
  picker.button.click();const popup=document.querySelector<HTMLElement>('.pv-view-menu')!;
  expect(popup.style.top).toBe('74px');expect(popup.style.maxHeight).toBe('360px');
  expect(options()).toHaveLength(12);
  expect(options()[8].getAttribute('aria-selected')).toBe('true');
  expect(document.activeElement).toBe(options()[0]);
  options()[11].click();expect(change).toHaveBeenCalledWith('11');
  expect(document.querySelector('.pv-view-menu')).toBeNull();
  expect(document.activeElement).toBe(picker.button);
});
it('supports arrows, Home/End, typeahead, and Escape without selecting a view', () => {
  picker.button.focus();key('ArrowDown');key('End');expect(document.activeElement).toBe(options()[11]);
  key('ArrowUp');expect(document.activeElement).toBe(options()[10]);
  key('Home');key('ArrowDown');expect(document.activeElement).toBe(options()[1]);
  key('v');expect(document.activeElement).toBe(options()[0]);
  key('Escape');expect(change).not.toHaveBeenCalled();expect(document.activeElement).toBe(picker.button);
  expect(picker.button.getAttribute('aria-expanded')).toBe('false');
});
it('dismisses on outside interaction and Tab, and cleans up on view close', () => {
  const other=document.body.createEl('button');picker.button.click();
  other.dispatchEvent(new Event('pointerdown',{bubbles:true}));expect(document.querySelector('.pv-view-menu')).toBeNull();
  picker.button.click();key('Tab');expect(document.querySelector('.pv-view-menu')).toBeNull();
  picker.button.click();other.focus();expect(document.querySelector('.pv-view-menu')).toBeNull();
  picker.button.click();picker.close(false);window.dispatchEvent(new Event('resize'));
  expect(document.querySelector('.pv-view-menu')).toBeNull();
});
it('fits a narrow mobile viewport and resizes above the keyboard without flipping upward', () => {
  const viewport=Object.assign(new EventTarget(),{offsetLeft:0,offsetTop:0,width:320,height:260});
  vi.stubGlobal('visualViewport',viewport);
  picker.button.click();const popup=document.querySelector<HTMLElement>('.pv-view-menu')!;
  expect(popup.style.top).toBe('74px');expect(popup.style.maxHeight).toBe('178px');
  viewport.height=180;viewport.dispatchEvent(new Event('resize'));
  expect(popup.style.top).toBe('74px');expect(popup.style.maxHeight).toBe('98px');
  expect(parseFloat(popup.style.left)+parseFloat(popup.style.width)).toBeLessThanOrEqual(312);
});
it('keeps the open list and focus when counts refresh', () => {
  picker.button.click();key('ArrowDown');
  picker.setChoices([{value:'0',label:'First (2)'},{value:'1',label:'Second (3)'}],'1');
  expect(options()).toHaveLength(2);expect(document.activeElement).toBe(options()[1]);
  expect(picker.button.textContent).toBe('Second (3)');
});
