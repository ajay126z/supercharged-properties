# Upcoming release — inline conversion and folder filters

This feature is in development after 1.4.2; no version or release tag has been assigned.

Convert inline fields such as `author:: AJ` into YAML properties from a property or value menu. On mobile, long-press to open the menu. Choose which notes to include, Move or Keep the source fields, and Skip, Merge into list, or Overwrite existing YAML values. Literal text is the default, with optional numeric/boolean detection and date-compatible ISO text. Repeated fields become lists.

Preview and confirmation are required. Value filters, folder filters, and excluded folders constrain the eligible notes; tree search stays display-only. Conversion uses the shared **Undo last property edit** command and protects later edits. Separate frontmatter/body writes can partially fail; the result reports affected paths and retains undo where safe. YAML formatting may change.

[Full conversion guide](../BULK-EDITING.md#convert-inline-properties-to-yaml)

## Saved folder filters

YAML and Inline views can now include selected folders and descendants. Use **Choose properties to show → + Add folder**, remove individual chips, or clear the folder bar. Folder filters combine with Value filters and narrow the tree, counts, copied links, and edit previews. Global exclusions always win.

Save folder selections with a view, including all-properties folder views. Built-in and older folder-free views clear the current folders. Missing/excluded folders stay as muted chips for you to review; folder renames do not rewrite paths. Search queries remain vault-wide, and tree search remains display-only.

[Folder filter guide](../USER-GUIDE.md#folder-filters)
