## Why

The `artifact-editor` spec calls for a TipTap-powered rich text editor, but `Editor.tsx` is currently a stub with no editing functionality. Users cannot write or format document content until a real editor is wired up with its toolbar, table support, and link editing.

## What Changes

- Replace the `Editor.tsx` stub with a fully functional TipTap v3 editor component
- Add a fixed top toolbar covering all text/block formatting, list, table, and link commands
- Add a contextual table sub-toolbar visible only when the cursor is inside a table
- Add a custom Table NodeView rendering row/column selection affordances and `+` insert buttons
- Add link editing with Slack-style paste-to-link UX and a URL popover
- Update `EditorPanel.tsx` to pass `content`, `onChange`, and `isStreaming` props to `Editor`
- Extend `src/styles/editor.css` with styles for the table NodeView affordances and link active state

## Capabilities

### New Capabilities

- `rich-text-editor`: Full TipTap rich text editor with toolbar, formatting, table editing, and link management

### Modified Capabilities

- `artifact-editor`: Editor component is no longer a stub — now accepts `content`, `onChange`, and `isStreaming` props as the interface between the store and the editing surface

## Impact

- **`src/components/editor/Editor.tsx`** — complete replacement
- **`src/components/editor/EditorPanel.tsx`** — minor: pass props down to `<Editor />`
- **`src/styles/editor.css`** — additive: table NodeView affordance styles, link active-link highlight
- **No new dependencies** — all required TipTap extensions are already installed
