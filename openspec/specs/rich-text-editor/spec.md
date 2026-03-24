# Spec: Rich Text Editor

## Requirements

### Requirement: Editor renders with TipTap and all installed extensions active
The system SHALL initialize a TipTap editor using `useEditor()` with every installed extension configured: bold, italic, underline, strike, code, highlight, link, subscript, superscript, heading (levels 1–6), paragraph, blockquote, code-block, bullet list, ordered list, table (with column resize), text-align, text-style, typography, emoji, invisible-characters, unique-id, and markdown input rules.

#### Scenario: Editor mounts with content
- **WHEN** `Editor` receives a non-empty `content` prop
- **THEN** the TipTap editor renders that HTML content in the editable surface

#### Scenario: Editor mounts empty
- **WHEN** `Editor` receives no `content` prop
- **THEN** the TipTap editor renders an empty document with the placeholder "Start writing…"

---

### Requirement: Toolbar provides all text formatting controls
The system SHALL render a fixed top toolbar above the editor with the following controls grouped by separator:
- Block format dropdown (Paragraph, H1, H2, H3, Blockquote, Code Block) showing the current block type
- Inline format toggles: Bold, Italic, Underline, Strikethrough, Inline Code, Highlight
- Text alignment toggles: Left, Center, Right
- List toggles: Bullet List, Ordered List
- Insert section: Link button, Horizontal Rule button

Each toggle SHALL reflect the active state of the formatting at the current cursor position.

#### Scenario: Bold toggle reflects cursor state
- **WHEN** the cursor is inside bold text
- **THEN** the Bold toolbar button appears active (pressed state)

#### Scenario: Block format dropdown shows current type
- **WHEN** the cursor is inside an H2 heading
- **THEN** the block format dropdown label shows "Heading 2"

#### Scenario: Applying a format from the toolbar
- **WHEN** the user selects text and clicks Bold in the toolbar
- **THEN** the selected text becomes bold and the Bold button shows as active

---

### Requirement: Streaming state disables editor editing
The system SHALL set the TipTap editor's `editable` option to `false` when the `isStreaming` prop is `true`, preventing user input while AI content is being written.

#### Scenario: Editor is read-only when streaming
- **WHEN** `isStreaming={true}` is passed to `Editor`
- **THEN** the TipTap editor is non-editable and the toolbar buttons are visually disabled

#### Scenario: Editor becomes editable after streaming ends
- **WHEN** `isStreaming` changes from `true` to `false`
- **THEN** the TipTap editor becomes editable and toolbar buttons are interactive

---

### Requirement: Link editing supports toolbar button, keyboard shortcut, and paste-to-link
The system SHALL support three link creation flows:
1. Toolbar link button opens a URL popover where the user can type or paste a URL and apply/remove the link
2. `Cmd+K` (macOS) / `Ctrl+K` (Windows/Linux) opens the same URL popover
3. When the user has a non-empty text selection and pastes a valid URL from the clipboard, the URL is applied as a link to the selected text instead of replacing the selection

The popover SHALL show the current link URL when the cursor is on an existing link, and SHALL include a Remove button to clear the link.

#### Scenario: Toolbar link button on selected text
- **WHEN** the user selects text and clicks the Link toolbar button
- **THEN** a URL popover opens with an empty input field

#### Scenario: Applying a link from the popover
- **WHEN** the user types a URL in the link popover and confirms
- **THEN** the selected text becomes a hyperlink with the entered URL

#### Scenario: Paste URL onto selection
- **WHEN** the user has text selected and pastes a valid URL (starting with `http://` or `https://`)
- **THEN** the selected text becomes a hyperlink with the pasted URL and the selection is not replaced

#### Scenario: Removing a link
- **WHEN** the cursor is on an existing link and the user opens the link popover
- **THEN** the popover shows the current URL pre-filled and a Remove button is visible; clicking Remove clears the link mark

#### Scenario: Cmd+K shortcut
- **WHEN** the user presses `Cmd+K` with text selected
- **THEN** the link popover opens

---

### Requirement: Table insertion and contextual editing toolbar
The system SHALL allow users to insert a table via an Insert dropdown in the toolbar. When the cursor is inside a table, a contextual table sub-toolbar SHALL appear at the right end of the main toolbar with controls to add/delete rows and columns and delete the entire table.

#### Scenario: Insert table from toolbar
- **WHEN** the user opens the Insert dropdown and selects "Table"
- **THEN** a 3×3 table is inserted at the current cursor position

#### Scenario: Contextual table toolbar appears
- **WHEN** the cursor moves inside a table cell
- **THEN** the table sub-toolbar appears in the main toolbar with row/column controls

#### Scenario: Contextual table toolbar disappears
- **WHEN** the cursor moves outside the table
- **THEN** the table sub-toolbar is no longer visible

#### Scenario: Add row from contextual toolbar
- **WHEN** the user clicks "Add Row" in the table toolbar
- **THEN** a new row is inserted after the current row

#### Scenario: Delete table from contextual toolbar
- **WHEN** the user clicks "Delete Table" in the table toolbar
- **THEN** the entire table is removed from the document

---

### Requirement: Table NodeView with row/column selection affordances and insert buttons
The system SHALL render each table through a custom React NodeView that provides:
- A column-select strip above the table header row, divided into one cell per column; clicking a cell selects the entire column
- A row-select strip to the left of each row; clicking a cell selects the entire row
- A `+` button centered below the table that inserts a new row after the last row
- A `+` button centered to the right of the table that inserts a new column after the last column
- Column resize drag handles (provided by the Table extension's `resizable: true` option)

#### Scenario: Column selection via strip click
- **WHEN** the user clicks the column-select strip above column 2
- **THEN** all cells in column 2 are selected (highlighted with the selection style from `editor.css`)

#### Scenario: Row selection via strip click
- **WHEN** the user clicks the row-select strip to the left of row 3
- **THEN** all cells in row 3 are selected

#### Scenario: Add row via NodeView button
- **WHEN** the user clicks the `+` button at the bottom of the table
- **THEN** a new row is appended to the end of the table

#### Scenario: Add column via NodeView button
- **WHEN** the user clicks the `+` button at the right of the table
- **THEN** a new column is appended to the right of the table

#### Scenario: Column resize via drag handle
- **WHEN** the user drags the resize handle on a column border
- **THEN** the column width is adjusted and the change is reflected in the document
