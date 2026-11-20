// SPDX-License-Identifier: MIT
import { fold } from './index';
import { parseInlineProperties } from './inline-properties';

export interface InlineEdit { property: string; mode: 'rename-property' | 'delete-property' | 'replace-values'; replacement: string; values?: string[] }
interface Field { key: string; value: string; keyStart: number; keyEnd: number; valueStart: number; valueEnd: number; start: number; end: number }
const validKey = (key: string) => !!key.trim() && !/[\r\n[\]():`\\*]/.test(key) && fold(key) !== 'position';

/** Locate editable spans, using the index parser itself to reject code/comments and unsupported contexts. */
function fields(source: string, property: string): Field[] {
  const candidates: Field[] = [];
  let offset = 0;
  const add = (raw: string, at: number, start: number, end: number) => {
    const colon = raw.indexOf('::'); if (colon < 0) return;
    const rawKey = raw.slice(0, colon), trimmed = rawKey.trim();
    const bold = trimmed.startsWith('**') && trimmed.endsWith('**');
    const key = bold ? trimmed.slice(2, -2).trim() : trimmed;
    if (fold(key) !== fold(property) || !validKey(key)) return;
    const keyStart = at + rawKey.indexOf(key);
    const tail = raw.slice(colon + 2), value = tail.trim();
    const valueStart = at + colon + 2 + (value ? tail.indexOf(value) : tail.length);
    candidates.push({key,value,keyStart,keyEnd:keyStart+key.length,valueStart,valueEnd:valueStart+value.length,start,end});
  };
  for (const part of source.matchAll(/[^\r\n]*(?:\r\n|\n|\r|$)/g)) {
    if (!part[0]) continue;
    const line = part[0].replace(/[\r\n]+$/, '');
    const prefix = /^(?:\uFEFF)?\s*(?:>\s*)*(?:(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?)?/.exec(line)![0];
    add(line.slice(prefix.length), offset + prefix.length, offset, offset + part[0].length);
    const stack: Array<{at:number; close:string}> = [];
    for (let i=0;i<line.length;i++) {
      if (line[i]==='\\') {i++;continue;}
      if (line[i]==='[' || line[i]==='(') stack.push({at:i,close:line[i]==='['?']':')'});
      else if (stack.length && line[i]===stack[stack.length-1].close) {
        const open=stack.pop()!;
        add(line.slice(open.at+1,i),offset+open.at+1,offset+open.at,offset+i+1);
      }
    }
    offset+=part[0].length;
  }
  return candidates.filter((field,i) => {
    let probe=`supercharged_probe_${i}`;while(source.includes(probe))probe+='_';
    const changed=source.slice(0,field.keyStart)+probe+source.slice(field.keyEnd);
    const values=parseInlineProperties(changed)[probe];
    return Array.isArray(values) && values.length===1 && values[0]===(field.value || null);
  });
}

export function inlineEditError(edit: InlineEdit): string | undefined {
  if (edit.mode==='rename-property' && !validKey(edit.replacement)) return 'Enter a valid inline property name without brackets, colons, backticks, or line breaks.';
  if (edit.mode==='replace-values' && (!edit.replacement.trim() || /[\r\n]/.test(edit.replacement))) return 'Enter a nonempty value on one line.';
  if(edit.mode==='replace-values' && !edit.values?.length) return 'Select at least one value.';
  return undefined;
}
function normalized(source: string): string {
  const values=new Map<string,string[]>();
  for(const [key,items] of Object.entries(parseInlineProperties(source))) values.set(fold(key),[...(values.get(fold(key))??[]),...(items as Array<string|null>).map(v=>v??'')]);
  return JSON.stringify([...values].map(([key,items])=>[key,items.sort()]).sort());
}
export function transformInline(source: string, edit: InlineEdit): string {
  const error=inlineEditError(edit);if(error)throw new Error(error);
  const parsed=parseInlineProperties(source);
  if(edit.mode==='rename-property' && fold(edit.replacement)!==fold(edit.property) && Object.keys(parsed).some(key=>fold(key)===fold(edit.replacement))) throw new Error('Destination inline property already exists.');
  const selected=new Set(edit.values?.map(fold));
  const matches=fields(source,edit.property).filter(field=>edit.mode!=='replace-values'||selected.has(fold(field.value)));
  const expected: Record<string,Array<string|null>> = Object.create(null) as Record<string,Array<string|null>>;
  let expectedCount=0;
  for(const [key,raw] of Object.entries(parsed)) {
    const values=raw as Array<string|null>;
    if(fold(key)!==fold(edit.property)) {expected[key]=values;continue;}
    if(edit.mode==='delete-property') {expectedCount+=values.length;continue;}
    if(edit.mode==='rename-property') {expectedCount+=values.length;expected[edit.replacement.trim()]=[...(expected[edit.replacement.trim()]??[]),...values];}
    else expected[key]=values.map(value=> {if(!selected.has(fold(value??'')))return value;expectedCount++;return edit.replacement.trim();});
  }
  if(expectedCount!==matches.length)throw new Error('Some matching inline fields use unsupported or ambiguous formatting; note skipped.');
  const replacements=matches.map(field=>edit.mode==='delete-property'?{start:field.start,end:field.end,text:''}:edit.mode==='rename-property'?{start:field.keyStart,end:field.keyEnd,text:edit.replacement.trim()}:{start:field.valueStart,end:field.valueEnd,text:edit.replacement.trim()}).sort((a,b)=>b.start-a.start);
  let output=source,last=source.length;
  for(const item of replacements) {if(item.end>last)throw new Error('Overlapping inline fields; note skipped.');output=output.slice(0,item.start)+item.text+output.slice(item.end);last=item.start;}
  const canonical=(raw:Record<string,Array<string|null>>) => {
    const result=new Map<string,string[]>();for(const [key,items]of Object.entries(raw))result.set(fold(key),[...(result.get(fold(key))??[]),...items.map(v=>v??'')]);
    return JSON.stringify([...result].map(([key,items])=>[key,items.sort()]).sort());
  };
  if(normalized(output)!==canonical(expected))throw new Error('This edit would change inline field syntax or other fields; note skipped.');
  return output;
}

/** Native text search is broader than the inline parser (it may include code examples). */
export function inlineQuery(property: string, value?: string): string {
  const quote=(text:string)=>JSON.stringify(text);
  return `line:(${quote(property)} ${quote('::')}${value===undefined?'':` ${quote(value)}`})`;
}
