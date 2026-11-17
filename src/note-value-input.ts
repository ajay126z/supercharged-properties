// SPDX-License-Identifier: MIT
import { noteEditError, parseNoteNumber, textOnlyList, type ListItem, type NoteEditType, type NoteValueEdit } from './note-value-operations';

interface InputOptions { property: string; type: NoteEditType; values: readonly ListItem[] }
interface ReadResult { edit?: NoteValueEdit; error?: string }

export function createNoteValueInput(parent: HTMLElement, options: InputOptions, changed: () => void): {
  read: () => ReadResult;
  setDisabled: (disabled: boolean) => void;
  blur: () => void;
} {
  const controls: Array<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> = [];
  const field = (name: string) => {
    const label = parent.createEl('label', { cls: 'pv-edit-field' });
    label.createSpan({ text: name });
    return label;
  };
  const select = (label: HTMLElement, name: string, choices: Array<[string, string]>) => {
    const element = label.createEl('select');
    element.setAttribute('aria-label', name);
    for (const [value, text] of choices) element.createEl('option', { text }).value = value;
    element.addEventListener('change', changed); controls.push(element); return element;
  };
  const validate = (edit: NoteValueEdit): ReadResult => {
    const error = noteEditError(edit, options.property);
    return error ? { error } : { edit };
  };
  let read: () => ReadResult;
  if (options.type === 'list') {
    const operation = select(field('List operation'), 'List operation', [['add', 'Add values'], ['remove', 'Remove values'], ['delete', 'Remove property']]);
    const choices = parent.createEl('fieldset', { cls: 'pv-list-choices' });
    choices.createEl('legend', { text: 'Existing list values' });
    const selected = new Map<HTMLInputElement, ListItem>();
    for (const value of options.values) {
      const label = choices.createEl('label', { cls: 'pv-list-choice' });
      const checkbox = label.createEl('input'); checkbox.type = 'checkbox';
      const description = `${JSON.stringify(value)} (${typeof value === 'number' ? 'number' : 'text'})`;
      label.createSpan({ text: description }); checkbox.setAttribute('aria-label', `Select list value ${description}`);
      selected.set(checkbox, value); controls.push(checkbox); checkbox.addEventListener('change', changed);
    }
    if (!options.values.length) choices.createEl('p', { text: 'No existing values. Enter values below.' });
    const itemTypeLabel = field('Entered value type');
    itemTypeLabel.hidden = textOnlyList(options.property);
    const itemType = select(itemTypeLabel, 'Entered value type', [['text', 'Text'], ['number', 'Number']]);
    const input = field('Values, one per line').createEl('textarea', { cls: 'pv-edit-input' });
    input.rows = 3; input.setAttribute('aria-label', 'Values, one per line');
    input.placeholder = 'One value per line'; controls.push(input); input.addEventListener('input', changed);
    const hint = parent.createEl('p', { cls: 'pv-edit-hint', text: 'Choose existing items, enter values, or both. Text matching is case-sensitive; numbers and text stay distinct. Add keeps existing items and skips duplicates. Remove deletes all exact matches and keeps an empty list when no items remain.' });
    read = () => {
      const removingProperty = operation.value === 'delete';
      choices.hidden = input.parentElement!.hidden = hint.hidden = removingProperty;
      itemTypeLabel.hidden = removingProperty || textOnlyList(options.property);
      if (removingProperty) return validate({ type: 'list', mode: 'delete' });
      const values = [...selected].filter(([checkbox]) => checkbox.checked).map(([, value]) => value);
      for (const line of input.value.split(/\r?\n/).map(value => value.trim()).filter(Boolean)) {
        if (itemType.value === 'number') {
          const number = parseNoteNumber(line);
          if (number === undefined) return { error: `Invalid number: ${line}` };
          values.push(number);
        } else values.push(line);
      }
      return validate({ type: 'list', mode: operation.value === 'remove' ? 'remove' : 'add', values: [...new Set(values)] });
    };
  } else {
    const type = options.type;
    const choices: Array<[string, string]> = [['', 'Choose a value…']];
    if (type === 'checkbox') choices.push(['true', 'True (checked)'], ['false', 'False (unchecked)']);
    else {
      for (const [index, value] of options.values.entries()) choices.push([`value:${index}`, String(value)]);
      choices.push(['custom', type === 'date' || type === 'datetime' ? 'Choose a date…' : 'Enter new value…']);
    }
    choices.push(['empty', 'Set empty (keep property)'], ['delete', 'Remove property']);
    const destination = select(field('Destination value'), 'Destination value', choices);
    const custom = field(type === 'date' ? 'New date' : type === 'datetime' ? 'New date and time' : 'New value');
    const input = custom.createEl('input', { cls: 'pv-edit-input' });
    input.type = type === 'number' ? 'number' : type === 'date' ? 'date' : type === 'datetime' ? 'datetime-local' : 'text';
    input.setAttribute('aria-label', type === 'date' ? 'New date' : type === 'datetime' ? 'New date and time' : 'New value');
    if (type === 'number') input.step = 'any';
    if (type === 'date' || type === 'datetime') {
      input.min = type === 'date' ? '0001-01-01' : '0001-01-01T00:00';
      input.max = type === 'date' ? '9999-12-31' : '9999-12-31T23:59:59';
      if (type === 'datetime') input.step = '0.001';
    }
    controls.push(input); input.addEventListener('input', changed); input.addEventListener('change', changed);
    read = () => {
      custom.hidden = destination.value !== 'custom';
      if (destination.value === 'delete') return validate({ type, mode: 'delete' });
      let value: string | number | boolean | null;
      if (destination.value === 'empty') value = null;
      else if (type === 'checkbox' && ['true', 'false'].includes(destination.value)) value = destination.value === 'true';
      else if (destination.value === 'custom') {
        if (type === 'number') {
          const number = parseNoteNumber(input.value);
          if (number === undefined) return { error: 'Enter a finite integer or decimal number, or choose Set empty.' };
          value = number;
        } else value = type === 'datetime' ? input.value.trim().replace(/\.0+$/, '') : input.value.trim();
      } else if (destination.value.startsWith('value:')) value = options.values[Number(destination.value.slice(6))];
      else return {};
      return validate({ type, mode: 'set', value });
    };
  }
  return { read, setDisabled: disabled => controls.forEach(control => { control.disabled = disabled; }), blur: () => controls.forEach(control => control.blur()) };
}
