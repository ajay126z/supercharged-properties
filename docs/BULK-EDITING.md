# Bulk value editing

Bulk edits let you standardize a property's values across notes. They are explicit write actions; ordinary browsing remains read-only. The original four value operations were introduced in 1.1.0; **Delete value…** was added after 1.2.1. This guide describes the 1.2.0 and later behavior, including folder exclusions, shared undo with property-name renaming, and text-property-only Split eligibility.

[Back to the user guide](USER-GUIDE.md)

In 1.2.0, value edits share one undo slot with [property-name renames](PROPERTY-RENAMING.md). The command is **Undo last property edit**; in 1.1.0 it is named **Undo last value edit**.

## Preview and confirm every batch

1. Expand a property in Supercharged Properties.
2. Right-click the value you want to change, or focus its label and press Shift+F10 / the Context Menu key.
3. Choose an edit action and supply its replacement or delimiter if needed.
4. Review the affected-note count and scroll through the complete list of paths and before/after values.
5. Click **Apply to N notes** to confirm, or **Cancel** to leave notes unchanged. For deletion, the button reads **Delete from N notes**.

Preview values use JSON-style notation: `"false"` is text, `false` is a boolean, and `["a","b"]` is a list. Quotes and brackets in the preview are value notation, not a promise of the exact YAML formatting that will be written.

Apply is disabled when the input is invalid, the preview is updating, or no notes would change. Closing or cancelling the dialog before Apply does not write notes. Once Apply starts, closing the dialog does not cancel the running batch.

**Scope:** each action covers the indexed notes for the selected value in included folders, narrowed by any active [folder filter](USER-GUIDE.md#folder-filters). Folder filters also constrain property rename/delete, selected-note edits, and inline edits. With an active [Value filter](USER-GUIDE.md#value-filter), only matching notes in that subset are included, and merge targets come from values in the subset. Without a Value filter, the action covers matching notes inside the selected folders, or across included vault folders if no folder filter is set. Excluded folders are omitted from previews and checked again before writes. Search, saved views, and collapsed branches do not restrict the edit to visible notes. Ordinary YAML bulk edits have no per-note inclusion checkbox; inline-to-YAML conversion below does. Inspect the full preview before confirming.

Before writing each note, the plugin compares the current property value with the previewed value. If it changed, the note is skipped. Other property changes do not block the edit. The completion notice reports updated, skipped, and failed notes; failures also identify the affected paths.

## Rename a value

Use Rename to replace the selected value with a value you type, including a new value that is not yet used.

1. Open the menu for `status` → `in-progress`.
2. Choose **Rename value…**.
3. Enter `active` in **New value**.
4. Review the preview and apply.

Before:

```yaml
status: in-progress
```

After:

```yaml
status: active
```

Rename also replaces matching entries inside lists and nested lists. If a changed list contains equal entries after replacement, duplicates are removed while retaining the first occurrence. This can also remove pre-existing equal duplicates elsewhere in that changed list.

A replacement must contain non-whitespace text. For a text source, the replacement remains text: entering `4` does not turn it into a number. For numeric sources, a valid finite numeric replacement remains numeric; otherwise it becomes text. For boolean sources, `true` or `false` remains boolean, ignoring capitalization; other replacements become text. Always check the preview's type notation.

## Merge values

Merge replaces one source value with another existing value of the same stored type under the same property.

1. Open the source value's menu and choose **Merge value…**.
2. Select the target in **Merge into**.
3. Review and apply.

For example, merging `doing` into `active` changes:

```yaml
status: [doing, active]
```

into:

```yaml
status: [active]
```

Merge appears only when another value of the same type exists. It operates on one source value per batch, not a multi-select group.

### Combine two values under a new name

To combine `in-progress` and `doing` into `active`:

1. Rename `in-progress` to `active` and apply.
2. After the tree refreshes, merge `doing` into `active` and apply.

These are **two batches**. After the second succeeds, one-step undo covers only the second batch. If `active` already exists, merge each source into it separately.

## Convert text to a wikilink

1. Open a text value such as `author` → `Ada Lovelace`.
2. Choose **Convert to wikilink…**.
3. Review and apply.

Before:

```yaml
author: Ada Lovelace
```

After, shown as a YAML-safe example:

```yaml
author: "[[Ada Lovelace]]"
```

The action wraps each matching string's trimmed text in `[[…]]`, including matching list entries. It preserves that string's capitalization. It does not create a target note, resolve a particular folder, or edit links in note bodies.

Existing complete wikilinks do not offer this action. Strings containing brackets or line breaks are skipped. Numeric, boolean, and empty rows do not offer wikilink conversion. Unlike Rename and Merge, this operation does not deduplicate list entries.

## Split text into a YAML list

In 1.2.0, **Split into list…** appears only for plain text values under properties configured as **Text** (including the default text type for unconfigured properties). It is hidden for List, Number, Checkbox, Date, Date & Time, tags, aliases, and cssclasses properties. The built-in `tags`, `aliases`, and `cssclasses` names remain ineligible even if their type is overridden to Text.

| Property type or special name | Split into list |
| --- | --- |
| Text, including the default for an unconfigured property | Available on text-value rows that are not complete wikilinks. |
| List | Not available. |
| Number | Not available. |
| Checkbox | Not available. |
| Date | Not available. |
| Date & Time | Not available. |
| tags | Not available. |
| aliases | Not available. |
| cssclasses | Not available. |

A text-looking value under a Date or List property does not make that property eligible. Refresh the property index after changing a property type in Obsidian. Non-text values and complete wikilink rows do not offer Split, even under a Text property. A Text property containing a list is not converted again: only scalar text in matching notes can change.

1. Confirm the property is configured as **Text**, then open a text value such as `topics` → `research, writing, editing`.
2. Choose **Split into list…**.
3. Enter the literal separator in **Delimiter**; the default is a comma.
4. Review and apply.

Before:

```yaml
topics: research, writing, editing
```

After:

```yaml
topics:
  - research
  - writing
  - editing
```

Split applies only when the property's entire stored value is a scalar string matching the selected row. It does not split strings already inside a list. The delimiter is literal and case-sensitive, not a regular expression; multi-character separators are allowed. Each part is trimmed and empty parts are discarded. At least two nonempty parts must remain for a change to occur.

Parts remain text, even if they look numeric or boolean. Repeated parts are retained. This action does not change the vault's configured property type; review that separately in Obsidian if needed.

## Delete a value

Use Delete value to remove one matching value from a property. Deleting a scalar removes the entire property key from that note. Deleting an entry inside a list removes every matching entry, including entries in nested lists; nested lists that become empty are pruned.

1. Open the menu for `status` → `obsolete`.
2. Choose **Delete value…**.
3. Review the preview and click **Delete from N notes**.

Before:

```yaml
status: obsolete
```

After, the note no longer has a `status` key. For a list:

```yaml
status: [active, obsolete]
```

becomes:

```yaml
status: [active]
```

If no values remain after deleting list entries, the property key is removed. Empty `(empty)` rows and nested object values do not offer deletion. Deleting a property name, rather than a value, is covered in the [property-renaming guide](PROPERTY-RENAMING.md#delete-a-property).

When deletion would remove the whole property key, notes with multiple spellings of the same property name (such as `status` and `Status`) are omitted from the preview. If this ambiguity appears after preview, the note is skipped on Apply.

Delete is destructive but shares the same preview, conflict checks, and undo as the other value actions. Undo restores the previous scalar or list structure; it does not restore YAML formatting or comments.

## How matching works

- Actions stay within the selected property; changing an author does not change the same text in another property.
- Property names and text values match the tree's grouping: surrounding whitespace is ignored, text is Unicode-normalized, and capitalization is ignored.
- Numbers, booleans, and text are distinct. A text `"false"` row does not match boolean `false`.
- Empty values and objects do not offer these edit actions.
- Rename, Merge, Delete, and wikilink conversion can affect matching scalar entries within nested lists. Split handles only a scalar property.
- If one note contains multiple keys that normalize to the same name, such as both `Status` and `status`, a value edit considers the first matching key. Review such notes individually rather than assuming both keys will change. Deleting the property name skips an ambiguous note instead.

A preview may therefore contain fewer notes than the tree row's count: some notes may already have the desired value, be ineligible for that operation, or no longer be available.

## Undo the last batch

Open the command palette and run **Supercharged Properties: Undo last property edit**. One invocation attempts to restore the previous property value in every successfully edited note from the last batch. Undo runs immediately; there is no second preview dialog.

Undo restores a note only if its edited property still equals the value written by the batch. Later changes to that property are skipped; changes to other properties are preserved. A skipped or failed undo entry remains available for retry, and the notice reports restored, skipped, and failed counts. Retrying does not force an overwrite of a conflicting value. When undo restores a deleted property key, it does so only while no key with the same folded name exists; a recreated key is left untouched and the entry stays available for retry.

The undo command is available only when an undo batch exists and no edit is running. After all entries are restored, it is no longer available. There is no redo action.

## Troubleshooting and limits

| Situation | Meaning and next step |
| --- | --- |
| No notes will change | Check the replacement or delimiter and the operation's eligibility rules. For Split, confirm the source is scalar text and yields at least two parts. For Delete, confirm the row is not an empty or object value. |
| Delete value is missing | Empty `(empty)` rows and nested object values do not offer deletion. Delete a property name from its property row instead. |
| A property disappeared after deleting its last value | Deleting the entire value removes the property key from that note. That is expected; undo restores it while the key remains free. |
| Split is missing | Check the property-type table above. Refresh the index after changing the configured type. The restriction affects Split, not the other value actions. |
| Merge is missing | No other value of the same stored type exists under the property. Rename can create a target value first. |
| Notes were skipped on Apply | Their property changed after preview or their folder was excluded. Reopen the action to generate a fresh preview. |
| Some writes failed | Successful writes remain applied and undoable. Inspect the path-specific notices and resolve the reported issue before retrying. The batch is not all-or-nothing. |
| Undo skipped a note | The edited property no longer matches the batch's result. Inspect the note; undo will not overwrite that later value. For a deleted key, remove or rename any recreated key with the same folded name before retrying. |
| Undo reports a missing note | It stores paths. A renamed, moved, or deleted note cannot be restored through its old path. |
| Undo disappeared after another edit | A new batch with at least one successful write replaces the previous undo batch. A batch with no successful writes does not replace it. |
| Undo disappeared after reload | Undo is held in memory and is cleared when the plugin is disabled, reloaded, or Obsidian restarts. |
| YAML layout or comments changed | Obsidian's frontmatter writer may reformat YAML. Undo restores property values, not original formatting, comments, or quoting. |

The value actions in this guide change frontmatter property values. They do not change property names, note bodies, or configured property types. Undo is a temporary recovery convenience, not a persistent history or a replacement for vault backups.

## Excluded folders

Version 1.2.0 respects **Settings → Supercharged Properties → Excluded folders** for previews and new writes. Search and saved views do not limit a batch, but folder exclusions do. Notes newly excluded after a preview are skipped at apply time. Undo remains available for earlier edits even if their folders are subsequently excluded.

## Change selected notes instead

To assign one destination to specific notes, right-click a note on desktop or long-press on mobile and choose **Change property…** (the menu uses the actual property name). **Select notes…** supports several notes within the same property. Selected-note editing supports typed Text, Number, Checkbox, Date, and Date & time assignments, plus List add/remove operations. Scalar edits support explicit empty values. **Remove property** deletes the entire key and value from selected notes for every supported type, including lists. With **Remove values**, removing the last list item keeps the key with `[]`; choose **Remove property** to delete the key instead. Note selection does not limit the property/value-row bulk actions described above. See [changing selected notes](NOTE-VALUE-EDITING.md).


## Convert inline properties to YAML

In **Inline Properties** or a saved inline view, right-click a property or value (long-press on mobile) and choose **Convert to YAML property…**. This makes inline fields available in the YAML tree, Obsidian Properties, and Bases.

1. Review **eligible notes** and deselect notes you want to leave unchanged. A property row includes notes with that property; a value row includes notes with that value. All occurrences of the property in each selected note are converted, including its other values.
2. Choose **Move** (default) to remove the inline fields, or **Keep** to copy them and leave the body unchanged.
3. Leave detection off to preserve literal text, including numbers with leading zeros and `[[Wikilinks]]`. **Detect numbers, checkboxes, and dates** converts finite numeric text and `true`/`false`; ISO dates remain date-compatible text without timezone conversion. It does not change the vault-wide property type; use Obsidian Properties to choose the display type if needed.
4. Choose what happens when the exact YAML key already exists: **Skip** (default), **Merge into list**, or **Overwrite**. Merge retains existing scalar/list values and adds distinct converted values. Overwrite replaces the existing value.
5. Click **Preview changes**. Review each note's old/new YAML value and the exact body fragments to remove. The preview shows at most 50 changed notes and 50 skip reasons, with excerpts limited to 4,000 characters; the total count includes the entire batch.
6. Click **Confirm conversion**. Changing any option or note selection requires a new preview.

The same key spelling is retained. Repeated inline fields become a YAML list, even if their values repeat. Empty inline values become empty text. Differently cased or Unicode-equivalent YAML keys, ambiguous inline keys, malformed frontmatter, and `position`, `tags`, `aliases`, and `cssclasses` are skipped with a reason. Merge skips objects and nested YAML values. Code, comments, and indented code within list continuations are ignored by the inline parser. Unsupported or ambiguous field formatting skips the note rather than removing surrounding prose.

**Scope:** conversion honors the active Value filter, excluded folders, and folder filters. Tree search and saved-view property selection do not add a note restriction. These conversion rules differ from ordinary bulk edits: conversion lets you deselect individual notes. Notes outside that selection are untouched by apply and undo.

Notes changed after preview are skipped. Frontmatter and body writes use separate Obsidian APIs, with checks between them. If a concurrent edit prevents body removal, the plugin preserves the body and attempts to revert its YAML assignment. A failed body write can leave the YAML copy and original inline fields together; the result identifies affected paths, and the successful YAML write retains an undo snapshot. Review any reported failure before retrying.

Use **Supercharged Properties: Undo last property edit** to restore the most recent conversion, including its removed body text. Conversion shares the session-scoped undo slot with YAML edits; a new successful conversion or YAML batch replaces it, and reload clears it. Undo skips notes changed afterward, missing notes, and currently excluded folders. The plugin keeps the original note text for restoration, but YAML serialization can change comments and quoting during conversion; do not rely on formatting being preserved exactly. This is separate from **Undo last inline property edit**, used for ordinary inline rename/delete actions. All these writes share a busy guard so batches cannot overlap.

Inline Search still uses text queries, not YAML property queries. After a Move, converted fields disappear from the inline index and appear in the YAML index; after Keep, they appear in both. Existing inline rename, delete, replace, pin, and hide actions remain available.

Folder filters are saved with views; Value filters stay temporary. The combined scope is the intersection of both, after global exclusions. Preview and undo affect only notes in the captured batch, leaving notes outside the selected folders untouched. **Open in Search** and **Copy search query** remain vault-wide.
