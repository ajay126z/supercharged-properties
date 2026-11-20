import { applyTooltips } from './tooltips';
// SPDX-License-Identifier: MIT
import { setIcon } from 'obsidian';

export interface ViewChoice { value: string; label: string }

/** A downward-opening picker, bounded by the visible viewport on desktop and mobile. */
export class ViewPicker {
  readonly button: HTMLButtonElement;
  private label: HTMLElement;
  private choices: ViewChoice[] = [];
  private popup: HTMLElement | undefined;
  private active = 0;
  private removeListeners: (() => void) | undefined;
  private typed = '';
  private typedAt = 0;

  constructor(parent: HTMLElement, private change: (value: string) => void, private showTooltips: () => boolean = () => true) {
    this.button = parent.createEl('button', { cls: 'pv-profile-select', attr: { type: 'button', 'aria-label': 'Property view', 'aria-haspopup': 'listbox', 'aria-expanded': 'false' } });
    this.label = this.button.createSpan({ cls: 'pv-profile-label' });
    setIcon(this.button.createSpan({ cls: 'pv-profile-chevron' }), 'chevron-down');
    this.button.addEventListener('click', () => this.popup ? this.close() : this.open());
    this.button.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault(); this.open(event.key === 'ArrowUp');
      }
    });
  }

  setChoices(choices: ViewChoice[], value: string): void {
    this.choices = choices;
    this.button.value = value;
    this.label.textContent = choices.find(choice => choice.value === value)?.label ?? 'Choose a view';
    this.button.title = this.label.textContent;
    applyTooltips(this.button, this.showTooltips());
    if (this.popup) {
      const focused = this.popup.contains(this.button.ownerDocument.activeElement);
      const scroll = this.popup.scrollTop;
      this.renderOptions(); this.position();
      if (focused) this.focusOption(false);
      this.popup.scrollTop = scroll;
    }
  }

  private open(last = false): void {
    if (this.popup || !this.choices.length) return;
    const doc = this.button.ownerDocument;
    const win = doc.defaultView!;
    this.popup = doc.body.createDiv({ cls: 'pv-view-menu', attr: { role: 'listbox', 'aria-label': 'Property views' } });
    this.popup.id = `pv-views-${win.crypto.randomUUID()}`;
    this.button.setAttribute('aria-controls', this.popup.id);
    this.button.setAttribute('aria-expanded', 'true');
    this.active = last ? this.choices.length - 1 : 0;
    this.typed = '';
    this.renderOptions(); this.position(); this.focusOption();
    const outside = (event: Event) => {
      if (event.target instanceof win.Node && !this.popup?.contains(event.target) && !this.button.contains(event.target)) this.close(false);
    };
    const scroll = (event: Event) => { if (event.target !== this.popup) this.position(); };
    doc.addEventListener('pointerdown', outside, true);
    doc.addEventListener('focusin', outside);
    doc.addEventListener('scroll', scroll, true);
    win.addEventListener('resize', this.position);
    win.visualViewport?.addEventListener('resize', this.position);
    win.visualViewport?.addEventListener('scroll', this.position);
    this.popup.addEventListener('keydown', this.keydown);
    this.removeListeners = () => {
      doc.removeEventListener('pointerdown', outside, true);
      doc.removeEventListener('focusin', outside);
      doc.removeEventListener('scroll', scroll, true);
      win.removeEventListener('resize', this.position);
      win.visualViewport?.removeEventListener('resize', this.position);
      win.visualViewport?.removeEventListener('scroll', this.position);
    };
  }

  private renderOptions(): void {
    this.popup!.replaceChildren();
    this.active = Math.min(this.active, this.choices.length - 1);
    for (const [index, choice] of this.choices.entries()) {
      const option = this.popup!.createEl('button', { cls: 'pv-view-option', text: choice.label, attr: { type: 'button', role: 'option', 'aria-selected': String(choice.value === this.button.value), tabindex: '-1' } });
      option.dataset.value = choice.value;
      option.addEventListener('click', () => { this.close(); this.change(choice.value); });
      option.addEventListener('focus', () => { this.active = index; });
    }
    applyTooltips(this.popup!, this.showTooltips());
  }

  private focusOption(scroll = true): void {
    const option = this.popup?.children[this.active] as HTMLElement | undefined;
    option?.focus({ preventScroll: true });
    if (scroll && option && this.popup) {
      if (option.offsetTop < this.popup.scrollTop) this.popup.scrollTop = option.offsetTop;
      else if (option.offsetTop + option.offsetHeight > this.popup.scrollTop + this.popup.clientHeight) this.popup.scrollTop = option.offsetTop + option.offsetHeight - this.popup.clientHeight;
    }
  }

  private keydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); this.close(); return; }
    if (event.key === 'Tab') { this.close(); return; }
    const last = this.choices.length - 1;
    if (event.key === 'ArrowDown') this.active = Math.min(last, this.active + 1);
    else if (event.key === 'ArrowUp') this.active = Math.max(0, this.active - 1);
    else if (event.key === 'Home') this.active = 0;
    else if (event.key === 'End') this.active = last;
    else if (event.key.length === 1 && event.key !== ' ' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = Date.now();
      this.typed = (now - this.typedAt < 700 ? this.typed : '') + event.key.toLocaleLowerCase(); this.typedAt = now;
      const match = this.choices.findIndex(choice => choice.label.toLocaleLowerCase().startsWith(this.typed));
      if (match >= 0) this.active = match;
    } else return;
    event.preventDefault(); this.focusOption();
  };

  private position = (): void => {
    if (!this.popup) return;
    const win = this.button.ownerDocument.defaultView!;
    const viewport = win.visualViewport;
    const left = viewport?.offsetLeft ?? 0, top = viewport?.offsetTop ?? 0;
    const width = viewport?.width ?? win.innerWidth, height = viewport?.height ?? win.innerHeight;
    const rect = this.button.getBoundingClientRect();
    const popupWidth = Math.max(0, Math.min(Math.max(rect.width, 220), width - 16));
    const y = rect.bottom + 4;
    this.popup.style.left = `${Math.max(left + 8, Math.min(rect.left, left + width - popupWidth - 8))}px`;
    this.popup.style.top = `${y}px`;
    this.popup.style.width = `${popupWidth}px`;
    this.popup.style.maxHeight = `${Math.max(0, Math.min(360, top + height - y - 8))}px`;
  };

  close(restoreFocus = true): void {
    if (!this.popup) return;
    this.removeListeners?.(); this.removeListeners = undefined;
    this.popup.remove(); this.popup = undefined;
    this.button.setAttribute('aria-expanded', 'false');
    this.button.removeAttribute('aria-controls');
    if (restoreFocus) this.button.focus({ preventScroll: true });
  }
}
