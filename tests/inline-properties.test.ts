import { expect, it } from 'vitest';
import { parseInlineProperties } from '../src/inline-properties';
import { PropertyIndex } from '../src/index';
it('parses line, bracket and parenthesis fields, repeated values and wikilinks', () => {
  const result = parseInlineProperties('author:: AJ\nA [topic:: design] and (rating:: 4).\nauthor:: AJ\n[related:: [[Note (draft)|Name]]]\nstatus::\n- [x] [done:: true]\n> **owner**:: Lee');
  expect({...result}).toEqual({author:['AJ','AJ'],topic:['design'],rating:['4'],related:['[[Note (draft)|Name]]'],status:[null],done:['true'],owner:['Lee']});
  const index = new PropertyIndex();index.update('A.md',result);
  expect([...index.properties.get('author')!.values.values()][0].paths.size).toBe(1);
});
it('ignores frontmatter, fenced and indented code, comments, inline code and escaped fields', () => {
  const text = '---\nauthor:: YAML\n---\n```js\nauthor:: code\n```\n~~~\n[x:: y]\n~~~\n    hidden:: code\n`[no:: code]`\n<!-- [no:: comment] -->\n%%\nno:: comment\n%%\n\\[no:: escaped]\nreal:: yes';
  expect({...parseInlineProperties(text)}).toEqual({real:['yes']});
});
it('keeps comma-separated values and dates as literal text, with no expression evaluation', () => {
  expect({...parseInlineProperties('topics:: design, art\ndue:: 2026-11-19\nexpr:: = 1 + 1')}).toEqual({topics:['design, art'],due:['2026-11-19'],expr:['= 1 + 1']});
});
it('handles CRLF, prototype-like keys, and an unclosed fence', () => {
 expect({...parseInlineProperties('\uFEFF---\r\nx: 1\r\n---\r\n__proto__:: safe\r\n```\r\nignored:: yes')}).toEqual(JSON.parse('{"__proto__":["safe"]}'));
});


it('reads nested list fields and continuation links with tabs and spaces', () => {
  const source = '- Back matter\n\t- created:: 2026-01-01\n\t- dates:: 2026-01-02\n- [x] Export notes\n\tLogseqLink:: logseq://graph/Example?page=Notes\n  related:: [[Notes|My notes]]\n  - [owner:: AJ]\n    (status:: active)';
  expect({...parseInlineProperties(source)}).toEqual({
    created: ['2026-01-01'], dates: ['2026-01-02'],
    LogseqLink: ['logseq://graph/Example?page=Notes'], related: ['[[Notes|My notes]]'],
    owner: ['AJ'], status: ['active']
  });
});
it('reads numbered lists and loose nested lists, and resets on leaving a list', () => {
  expect({...parseInlineProperties('10. Parent\n    - child:: yes\n\n      next:: yes\nOutside\n\tignored:: code\nreal:: yes')}).toEqual({child:['yes'],next:['yes'],real:['yes']});
});
it('ignores indented and fenced code inside lists', () => {
  const source = '- Parent\n\n      ignored:: indented code\n  real:: yes\n  - ```text\n    hidden:: fenced code\n    ```\n  - ~~~\n    hidden:: fenced code\n    ~~~\n  final:: yes\nOutside\n\n    hidden:: code';
  expect({...parseInlineProperties(source)}).toEqual({real:['yes'],final:['yes']});
});
it('does not invent fields from inline-code documentation or empty names', () => {
  expect({...parseInlineProperties('- Use `highlight:: text` in notes.\n- `[key:: value]` is an example.\n\t::Links::\nreal:: yes')}).toEqual({real:['yes']});
});
