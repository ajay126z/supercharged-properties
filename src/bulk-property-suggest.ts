// SPDX-License-Identifier: MIT
import { AbstractInputSuggest, setIcon, type App } from 'obsidian';
import { fold } from './index';
import { matchChoices, typeLabels, typeIcons, type PropertyChoice } from './property-catalog';
export class BulkNameSuggest extends AbstractInputSuggest<PropertyChoice> {
    constructor(app: App, input: HTMLInputElement, private choices: () => PropertyChoice[], private used: () => Set<string>, private select: (choice: PropertyChoice) => void) { super(app, input); this.limit = 50; }
    getSuggestions(query: string): PropertyChoice[] { return matchChoices(this.choices(), query, this.used()); }
    renderSuggestion(choice: PropertyChoice, el: HTMLElement): void {
        el.classList.add('pv-bulk-suggestion');
        setIcon(el.createSpan(), typeIcons[choice.type]);
        el.createEl('strong', { text: choice.key });
        el.createEl('small', { text: choice.disabledReason ?? (choice.inScope ? `${typeLabels[choice.type]} · ${choice.inScope} ${choice.inScope === 1 ? 'note' : 'notes'}` : 'Not in these notes') });
        el.setAttribute('aria-disabled', String(!!choice.disabledReason));
    }
    selectSuggestion(choice: PropertyChoice, event?: MouseEvent | KeyboardEvent): void { event?.preventDefault(); event?.stopPropagation(); if (choice.disabledReason)
        return; this.close(); this.select(choice); }
}
export function replaceListToken(raw: string, start: number, end: number, value: string, delimiter: string): {
    text: string;
    cursor: number;
} {
    const previous = start === 0 ? -1 : raw.lastIndexOf(delimiter, start - 1);
    const tokenStart = previous < 0 ? 0 : previous + delimiter.length;
    const next = raw.indexOf(delimiter, end), right = next < 0 ? raw.length : next;
    const prefix = raw.slice(0, tokenStart) + (tokenStart ? ' ' : '');
    const text = prefix + value + raw.slice(right);
    return { text, cursor: prefix.length + value.length };
}
export class BulkValueSuggest extends AbstractInputSuggest<string> {
    opened = false;
    open(): void { super.open(); this.opened = true; }
    close(): void { super.close(); this.opened = false; }
    constructor(app: App, private input: HTMLInputElement, private values: () => string[], private delimiter: () => string | undefined, private changed: () => void) { super(app, input); this.limit = 20; }
    getSuggestions(query: string): string[] { const delimiter = this.delimiter(); const position = this.input.selectionStart ?? query.length; const previous = delimiter && position > 0 ? query.lastIndexOf(delimiter, position - 1) : -1; const token = delimiter ? query.slice(previous < 0 ? 0 : previous + delimiter.length, query.indexOf(delimiter, position) < 0 ? undefined : query.indexOf(delimiter, position)) : query; return this.values().filter(value => fold(value).includes(fold(token))).slice(0, 20); }
    renderSuggestion(value: string, el: HTMLElement): void { el.textContent = value; }
    selectSuggestion(value: string, event?: MouseEvent | KeyboardEvent): void {
        event?.preventDefault(); event?.stopPropagation();
        const delimiter = this.delimiter();
        if (delimiter) {
            const result = replaceListToken(this.input.value, this.input.selectionStart ?? this.input.value.length, this.input.selectionEnd ?? this.input.value.length, value, delimiter);
            this.input.value = result.text;
            this.input.setSelectionRange(result.cursor, result.cursor);
        }
        else
            this.input.value = value;
        this.changed();
        this.close();
    }
}
