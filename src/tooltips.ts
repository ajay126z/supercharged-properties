// SPDX-License-Identifier: MIT
/** Hide only this plugin's hover tooltips; retain accessible labels and note previews. */
export function applyTooltips(root: HTMLElement, enabled: boolean): void {
  const selector = '[title], [data-pv-tooltip-title], [aria-label], [data-tooltip-classes]';
  const elements = Array.from(root.querySelectorAll<HTMLElement>(selector));
  if (root.matches(selector)) elements.push(root);
  for (const element of elements) {
    if (!enabled) {
      if (element.hasAttribute('title')) {
        element.dataset.pvTooltipTitle = element.getAttribute('title')!;
        element.removeAttribute('title');
      }
    } else if (element.dataset.pvTooltipTitle !== undefined) {
      if (!element.hasAttribute('title')) element.title = element.dataset.pvTooltipTitle;
      delete element.dataset.pvTooltipTitle;
    }
    // Obsidian builds hover tooltips from aria-label. Scope its tooltip class,
    // rather than removing labels needed by assistive technology.
    const classes = new Set((element.getAttribute('data-tooltip-classes') ?? '').split(/\s+/).filter(Boolean));
    if (!enabled && element.hasAttribute('aria-label')) classes.add('pv-tooltip-disabled');
    else classes.delete('pv-tooltip-disabled');
    if (classes.size) element.setAttribute('data-tooltip-classes', [...classes].join(' '));
    else element.removeAttribute('data-tooltip-classes');
  }
}
