import {expect,it} from 'vitest';
import {transformInline,inlineQuery} from '../src/inline-edit';
const replace={property:'status',mode:'replace-values' as const,replacement:'active',values:['todo','doing']};
it('replaces selected values across line, bracket, parenthesis and nested list fields',()=>{
 const before='---\nstatus: todo\n---\nstatus:: todo\nText [status:: doing] and (status:: done).\n- Parent\n\t- **status**:: todo\n\tstatus:: doing\n';
 expect(transformInline(before,replace)).toBe('---\nstatus: todo\n---\nstatus:: active\nText [status:: active] and (status:: done).\n- Parent\n\t- **status**:: active\n\tstatus:: active\n');
});
it('preserves links, CRLF, BOM, formatting, code and comments',()=>{
 const before='\uFEFF---\r\nstatus: todo\r\n---\r\n```\r\nstatus:: todo\r\n```\r\n%% status:: todo %%\r\n`[status:: todo]`\r\n[status:: [[Note (draft)|Alias]]]\r\n';
 expect(transformInline(before,{...replace,values:['[[Note (draft)|Alias]]'],replacement:'[[New|Name]]'})).toBe(before.replace('[status:: [[Note (draft)|Alias]]]', '[status:: [[New|Name]]]'));
});
it('renames fields and deletes complete inline fields while preserving surrounding prose and YAML',()=>{
 const source='---\nstatus: todo\n---\nstatus:: todo\nText [status:: doing] and (owner:: AJ).\n';
 expect(transformInline(source,{property:'status',mode:'rename-property',replacement:'state'})).toBe(source.replace('status::','state::').replace('[status::','[state::'));
 expect(transformInline(source,{property:'status',mode:'delete-property',replacement:''})).toBe('---\nstatus: todo\n---\nText  and (owner:: AJ).\n');
});
it('rejects collisions, multiline edits and values that escape their field wrapper',()=>{
 expect(()=>transformInline('status:: todo\nstate:: done',{property:'status',mode:'rename-property',replacement:'state'})).toThrow('already exists');
 expect(()=>transformInline('[status:: todo]',{...replace,replacement:'bad] text'})).toThrow('syntax');
 expect(()=>transformInline('status:: todo',{...replace,replacement:'a\nb'})).toThrow('one line');
 expect(()=>transformInline('status:: `code`',{property:'status',mode:'delete-property',replacement:''})).toThrow('unsupported');
});
it('handles empty fields, repeated values and prototype-like names safely',()=>{
 expect(transformInline('status::\n[status:: ]',{...replace,values:['']})).toBe('status::active\n[status:: active]');
 expect(transformInline('__proto__:: todo',{...replace,property:'__proto__'})).toBe('__proto__:: active');
 expect(transformInline('status:: todo\nstatus:: todo',replace)).toBe('status:: active\nstatus:: active');
});
it('quotes native inline text queries including quotes and backslashes',()=>{
 expect(inlineQuery('status','doing')).toBe('line:("status" "::" "doing")');
 expect(inlineQuery('a"b')).toBe('line:("a\\"b" "::")');
});
