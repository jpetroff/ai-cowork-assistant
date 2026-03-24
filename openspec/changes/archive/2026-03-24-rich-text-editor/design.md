## Context

`Editor.tsx` is currently a stub (`<div>{/* EDITOR STUB */}</div>`). The rest of the editor layout is in place: `EditorSection` → `ArtifactTitleBar` + `EditorPanel` → `Editor`. `EditorPanel` already has access to `headRevision` content and `updateContent` from `artifactStore`, and the `isStreaming` flag from `messageStore`, but passes nothing to `Editor` yet.

All required TipTap v3 extensions are already installed. `src/styles/editor.css` has comprehensive ProseMirror content styles (warm editorial palette, dark mode, all block types, table cell selection, column resize handle). The design system uses shadcn/Base UI components with Tailwind; the existing `Toggle` component is a good fit for toolbar buttons.

## Goals / Non-Goals

**Goals:**
- Wire up a fully functional TipTap editor with all installed extensions active
- Fixed top toolbar: block format, inline formatting, text alignment, lists, insert (table, HR, link)
- Contextual table sub-toolbar (visible only when cursor is inside a table)
- Custom Table NodeView with row/column click-to-select strips and `+` insert buttons at edges
- Link editing: toolbar button + `Cmd+K`, URL popover, Slack-style paste-to-link
- Streaming read-only state via `editable` prop
- Prop interface: `content?`, `onChange?`, `isStreaming?` — ready to be wired to the store later

**Non-Goals:**
- Store wiring or auto-save (done separately)
- Slash command menu
- Row/column drag-to-reorder
- Image, file, or embed support
- AI-specific toolbar actions

## Decisions

### 1. Single-file component with co-located sub-components

**Decision:** All editor sub-components (`EditorToolbar`, `TableContextBar`, `LinkPopover`, `TableNodeView`) live in `Editor.tsx` or a sibling `TableNodeView.tsx` — not in a separate `components/editor/toolbar/` directory.

**Rationale:** The editor and its toolbar are tightly coupled via the `editor` instance. Keeping them co-located avoids prop-drilling the `editor` object through an abstraction boundary that provides no reuse value at this stage. Sub-components that grow complex (TableNodeView) get their own sibling file.

**Alternative considered:** Separate files for each toolbar group. Rejected — premature splitting of a single cohesive feature surface.

---

### 2. Top toolbar only (no bubble menu)

**Decision:** Single fixed toolbar above the editor. No floating bubble menu on selection.

**Rationale:** User explicitly requested this. Simpler state management, no z-index or positioning complexity, and consistent discoverability.

---

### 3. Table affordances via React NodeView

**Decision:** Render the TipTap table via a custom React NodeView (`TableNodeView.tsx`) that wraps the table with:
- A thin column-header strip above the first row (one cell per column) — clicking selects entire column
- A thin row-select strip to the left of each row — clicking selects entire row
- A `+` button at the bottom-center to add a row
- A `+` button at the right-center to add a column
- Column resize via TipTap's built-in `resizable: true` option on the Table extension

**Rationale:** TipTap's NodeView API lets React components replace how a ProseMirror node is rendered in the DOM without interfering with the editor's content model. This is the cleanest path for injecting interactive affordances around a table without hacking into ProseMirror decorations.

**Alternative considered:** ProseMirror `Decoration.widget` to inject DOM nodes at table boundaries. Rejected — more complex, no React, harder to maintain.

**Alternative considered:** CSS-only column header clicks via `:before` pseudoelements. Rejected — cannot attach JS click handlers.

---

### 4. Link UX: paste-to-link override + popover

**Decision:**
- Override `handlePaste` on the editor: if selection is non-empty and clipboard text is a valid URL, call `editor.commands.setLink({ href })` instead of replacing content.
- Link toolbar button and `Cmd+K` open a small controlled `<Popover>` (shadcn) with a URL input field and Remove/Apply actions.
- Active link in toolbar is highlighted via `editor.isActive('link')`.

**Rationale:** This mirrors Slack's muscle-memory UX that users already know. The popover approach (vs inline editing) is simpler and avoids needing a custom ProseMirror plugin for an inline input.

---

### 5. Toolbar block format as a dropdown

**Decision:** Block format (Paragraph, H1–H3, Blockquote, Code Block) is a `<DropdownMenu>` showing the current block type as a label. Other options (H4–H6, HR) are accessible via Insert.

**Rationale:** Displaying all heading levels as individual toggle buttons would crowd the toolbar. A single dropdown with a visible current-state label is more scannable. H4–H6 are rarely used directly and can be accessed via markdown shortcuts (`####`).

---

### 6. CSS additions are additive

**Decision:** The existing `editor.css` is not restructured. New rules for the table NodeView affordances (`.editor-table-wrapper`, `.editor-col-select-strip`, `.editor-row-select-strip`, `.editor-table-add-btn`) are appended at the end of the file.

**Rationale:** The file is already well-organized and complete for ProseMirror content styles. Table NodeView styles are a distinct concern and adding them at the end keeps them locatable.

---

### 7. Editor content format: HTML

**Decision:** `onChange` emits `editor.getHTML()`. The `content` prop accepts an HTML string.

**Rationale:** TipTap's internal model is ProseMirror JSON, but HTML is the most interoperable format for storing document content and is what the downstream store/DB layer will likely persist. The `@tiptap/markdown` extension is loaded (enabling markdown input rules) but output is HTML.

## Risks / Trade-offs

- **NodeView complexity** → The Table NodeView must imperatively call TipTap commands (`addRowAfter`, `addColumnAfter`, `selectRow`, `selectColumn`) which requires the `editor` instance to be passed down. Mitigation: pass `editor` as a prop to the NodeView via TipTap's `addNodeView` factory closure.

- **Column select strip alignment** → Column-strip cells must stay aligned with actual table column widths, including after column resize. Mitigation: the strip renders inside the NodeView wrapper as a `display: grid` row matching the table's actual column count; CSS `grid-template-columns` is set to `auto` per column, which follows the table's natural widths.

- **TipTap v3 API surface** → TipTap v3 has minor API differences from v2 (unified `@tiptap/extension-list` replaces separate BulletList/OrderedList/ListItem). Must consult Context7 docs during implementation to confirm exact command names.

- **`EditorPanel` coupling** → `EditorPanel` currently calls `<Editor />` with no props. After this change it will pass `content`, `onChange`, `isStreaming`. This is a minimal, backward-compatible change but must be coordinated (a future store-wiring task will complete the data flow).

## Open Questions

- None blocking implementation. Store wiring (`content` initial value, `onChange` → `updateContent`) is deferred to the next change.
