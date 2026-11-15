// Obsidian provides this HTMLElement extension in the host; jsdom does not.
if (typeof HTMLElement !== 'undefined') {
  HTMLElement.prototype.createDiv = function(options) { return this.createEl('div', options); };
  HTMLElement.prototype.createSpan = function(options) { return this.createEl('span', options); };
  HTMLElement.prototype.createEl = function(tag: string, options: { cls?: string; text?: string } = {}) {
    const node = this.ownerDocument.createElement(tag);
    node.className = options.cls ?? '';
    node.textContent = options.text ?? '';
    this.appendChild(node);
    return node;
  } as HTMLElement['createEl'];
}
