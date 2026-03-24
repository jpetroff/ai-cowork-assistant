## 1. Editor Core Setup

- [x] 1.1 Consult Context7 for TipTap v3 `useEditor` API and extension configuration syntax
- [x] 1.2 Wire up `useEditor()` in `Editor.tsx` with all installed extensions (bold, italic, underline, strike, code, highlight, link, subscript, superscript, heading 1–6, paragraph, blockquote, code-block, list, table with `resizable: true`, text-align, text-style, typography, emoji, invisible-characters, unique-id, markdown)
- [x] 1.3 Add `IEditorProps` interface: `content?: string`, `onChange?: (html: string) => void`, `isStreaming?: boolean`, `placeholder?: string`
- [x] 1.4 Bind `editable` option to `!isStreaming` and sync with `useEffect` when prop changes
- [x] 1.5 Wire `content` prop as initial editor content and call `onChange(editor.getHTML())` on every update
- [x] 1.6 Import `editor.css` in `Editor.tsx` (or confirm it is already imported globally)
- [x] 1.7 Wrap `EditorContent` in a `ScrollArea` with appropriate padding so the `68ch` max-width centering works at any panel width

## 2. Top Toolbar — Block Format & Inline Formatting

- [x] 2.1 Create `EditorToolbar` sub-component (co-located in `Editor.tsx`) accepting the `editor` instance
- [x] 2.2 Add block format `DropdownMenu`: options Paragraph, Heading 1–3, Blockquote, Code Block; label shows current block type; each option calls the appropriate TipTap command
- [x] 2.3 Add inline format `Toggle` buttons (using existing `Toggle` component): Bold, Italic, Underline, Strikethrough, Inline Code, Highlight; each reflects `editor.isActive()` state
- [x] 2.4 Add text alignment `Toggle` buttons: Align Left, Center, Right; reflect active alignment state
- [x] 2.5 Add list `Toggle` buttons: Bullet List, Ordered List; reflect active list state
- [x] 2.6 Add separator `<div>` elements between toolbar groups using `border-l h-4` Tailwind classes
- [x] 2.7 Disable all toolbar buttons when `isStreaming` is true

## 3. Link Editing

- [x] 3.1 Add Link toolbar button that opens a controlled `<Popover>` with a URL `<Input>` field, Apply button, and Remove button
- [x] 3.2 Pre-fill the URL input when cursor is on an existing link (`editor.getAttributes('link').href`)
- [x] 3.3 Apply link on confirm: call `editor.commands.setLink({ href })` and close popover
- [x] 3.4 Remove link on Remove button: call `editor.commands.unsetLink()` and close popover
- [x] 3.5 Wire `Cmd+K` / `Ctrl+K` keyboard shortcut to open the link popover
- [x] 3.6 Override `handlePaste` on the editor: if selection is non-empty and clipboard text matches `^https?://`, call `editor.commands.setLink({ href: clipboardText })` and `preventDefault`

## 4. Insert Controls

- [x] 4.1 Add an Insert `DropdownMenu` in the toolbar: options "Table", "Horizontal Rule"
- [x] 4.2 Table option: calls `editor.commands.insertTable({ rows: 3, cols: 3, withHeaderRow: true })`
- [x] 4.3 Horizontal Rule option: calls `editor.commands.setHorizontalRule()`

## 5. Table NodeView

- [x] 5.1 Consult Context7 for TipTap v3 React NodeView API (`ReactNodeViewRenderer`, `NodeViewWrapper`, `NodeViewContent`)
- [x] 5.2 Create `src/components/editor/TableNodeView.tsx` as a React NodeView component wrapping the table with a relative-positioned outer div
- [x] 5.3 Render a column-select strip above the table: one clickable cell per column, clicking calls `editor.commands.selectColumn()` for that column index
- [x] 5.4 Render a row-select strip to the left of each row: one clickable cell per row, clicking calls `editor.commands.selectRow()` for that row index
- [x] 5.5 Render a `+` button centered below the table that calls `editor.commands.addRowAfter()`
- [x] 5.6 Render a `+` button centered to the right of the table that calls `editor.commands.addColumnAfter()`
- [x] 5.7 Register the NodeView on the Table extension via `addNodeView: () => ReactNodeViewRenderer(TableNodeView)`
- [x] 5.8 Add CSS to `editor.css` for `.editor-table-wrapper`, `.editor-col-strip`, `.editor-row-strip`, `.editor-table-add-btn` — subtle muted colors, hover states, no hard-coded color values

## 6. Contextual Table Toolbar

- [x] 6.1 Add a `TableContextBar` sub-component in `Editor.tsx` that only renders when `editor.isActive('table')` is true
- [x] 6.2 Show a separator then the table context buttons at the right end of `EditorToolbar`: "Add Row", "Add Column", "Delete Row", "Delete Column", "Delete Table"
- [x] 6.3 Wire each button to its corresponding TipTap table command
- [x] 6.4 Use a `Tooltip` on each button for discoverability (icon-only buttons)

## 7. EditorPanel Update

- [x] 7.1 Update `EditorPanel.tsx` to pass `content={headRevision?.content ?? ''}`, `onChange={updateContent}`, and `isStreaming={isStreaming}` props to `<Editor />`

## 8. Visual Polish & CSS

- [x] 8.1 Verify toolbar styling matches the app design system (muted background, border-bottom separating toolbar from editor)
- [x] 8.2 Ensure dark mode works for toolbar and NodeView affordances (use CSS custom properties, no hard-coded colors)
- [x] 8.3 Verify `editor.css` streaming state style (`.ProseMirror[contenteditable="false"]`) renders correctly
- [x] 8.4 Run `bunx prettier --write src/components/editor/Editor.tsx src/components/editor/TableNodeView.tsx src/components/editor/EditorPanel.tsx src/styles/editor.css`
- [x] 8.5 Run `bunx tsc --noEmit` and fix any type errors
