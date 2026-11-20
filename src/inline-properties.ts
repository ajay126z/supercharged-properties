// SPDX-License-Identifier: MIT

/** A deliberately small, read-only subset of Dataview-style inline field syntax. */
export function parseInlineProperties(source: string): Record<string, unknown> {
  const fields: Record<string, Array<string | null>> = Object.create(null) as Record<string, Array<string | null>>;
  const lines = source.replace(/^\uFEFF/, '').split(/\r?\n/);
  let frontmatter = lines[0]?.trim() === '---';
  let fence: { char: string; length: number; indent: number } | undefined;
  const listIndents: number[] = [];
  const prose: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (frontmatter) {
      if (i > 0 && /^(---|\.\.\.)\s*$/.test(line)) frontmatter = false;
      continue;
    }
    // Expand indentation tabs to Markdown's four-column stops, leaving values intact.
    const unquoted = line.replace(/^(?: {0,3}> ?)+/, '').replace(/^[ \t]+/, whitespace => {
      let columns = 0;
      for (const char of whitespace) columns += char === '\t' ? 4 - columns % 4 : 1;
      return ' '.repeat(columns);
    });
    if (fence) {
      const closing = /^ {0,3}(`{3,}|~{3,})\s*$/.exec(unquoted.slice(fence.indent));
      if (closing && closing[1][0] === fence.char && closing[1].length >= fence.length) fence = undefined;
      continue;
    }
    if (!unquoted.trim()) { prose.push(''); continue; }
    const indent = unquoted.length - unquoted.trimStart().length;
    while (listIndents.length && indent < listIndents[listIndents.length - 1]) listIndents.pop();
    const containerIndent = listIndents[listIndents.length - 1] ?? 0;
    // Four extra columns mean code; indentation belonging to a list does not.
    if (indent - containerIndent >= 4) continue;
    let content = unquoted.slice(containerIndent);
    let contentIndent = containerIndent;
    const list = /^ {0,3}(?:[-*+]|\d+[.)]) +/.exec(content);
    if (list) {
      contentIndent += list[0].length;
      listIndents.push(contentIndent);
      content = content.slice(list[0].length).replace(/^\[[ xX]\] /, '');
    }
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(content);
    if (marker) { fence = { char: marker[1][0], length: marker[1].length, indent: contentIndent }; continue; }
    prose.push(content);
  }
  const text = prose.join('\n')
    .replace(/<!--[\s\S]*?(?:-->|$)|%%[\s\S]*?(?:%%|$)/g, match => match.replace(/[^\n]/g, ' '))
    .replace(/(`+)([\s\S]*?)\1(?!`)/g, match => match.replace(/[^\n]/g, ' '));
  const add = (raw: string): boolean => {
    const colon = raw.indexOf('::');
    if (colon < 0) return false;
    const key = raw.slice(0, colon).trim().replace(/^\*\*(.*?)\*\*$/, '$1').trim();
    if (!key || /[[\]():`\\]/.test(key) || key === 'position') return false;
    const value = raw.slice(colon + 2).trim();
    (fields[key] ??= []).push(value || null);
    return true;
  };
  for (const line of text.split('\n')) {
    const plain = line.replace(/^\s*(?:[-*+] |\d+[.)] )(?:\[[ xX]\] )?/, '').trim();
    // Full-line fields consume the rest of the line (including links and parentheses).
    if (add(plain)) continue;
    const stack: Array<{ at: number; close: string }> = [];
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '\\') { i++; continue; }
      if (line[i] === '[' || line[i] === '(') stack.push({ at: i, close: line[i] === '[' ? ']' : ')' });
      else if (stack.length && line[i] === stack[stack.length - 1].close) {
        const start = stack.pop()!;
        add(line.slice(start.at + 1, i));
      }
    }
  }
  return fields;
}
