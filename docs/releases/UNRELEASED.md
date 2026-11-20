# Upcoming release — inline conversion

This feature is in development after 1.4.2; no version or release tag has been assigned.

Convert inline fields such as `author:: AJ` into YAML properties from a property or value menu. On mobile, long-press to open the menu. Choose which notes to include, Move or Keep the source fields, and Skip, Merge into list, or Overwrite existing YAML values. Literal text is the default, with optional numeric/boolean detection and date-compatible ISO text. Repeated fields become lists.

Preview and confirmation are required. Value filters, excluded folders, and note/path search constrain the eligible notes. Conversion uses the shared **Undo last property edit** command and protects later edits. Separate frontmatter/body writes can partially fail; the result reports affected paths and retains undo where safe. YAML formatting may change.

[Full conversion guide](../BULK-EDITING.md#convert-inline-properties-to-yaml)
