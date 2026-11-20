// Obsidian provides this HTMLElement extension in the host; jsdom does not.
if (typeof HTMLElement !== 'undefined') {
  HTMLElement.prototype.createDiv = function(options) { return this.createEl('div', options); };
  HTMLElement.prototype.createSpan = function(options) { return this.createEl('span', options); };
  HTMLElement.prototype.createEl = function(tag: string, options: { cls?: string; text?: string; attr?: Record<string, string> } = {}) {
    const node = this.ownerDocument.createElement(tag);
    node.className = options.cls ?? '';
    node.textContent = options.text ?? '';
    for (const [name, value] of Object.entries(options.attr ?? {})) node.setAttribute(name, value);
    this.appendChild(node);
    return node;
  } as HTMLElement['createEl'];
}
