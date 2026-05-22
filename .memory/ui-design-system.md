# UI Design System

This project uses shadcn-style components on top of Base UI primitives, with
Tailwind v4 as the styling layer. UI should feel like a comfortable desktop
work app: readable, calm, and efficient, but not as tight as the original
compact defaults.

## Core Principles

- Prefer `src/components/ui/*` primitives before writing raw controls.
- Use Tailwind semantic tokens from `src/index.css`; avoid hard-coded sizes,
  radii, colors, and one-off typography values.
- Keep repeated UI surfaces at `rounded-card` or lower. Cards should remain
  8px radius max.
- Default controls should be comfortable. Dense/editor toolbar controls may use
  the compact `xs` token, but should still be tokenized.
- Do not use hard-coded colors in feature components. Use color tokens such as
  `bg-card`, `text-muted-foreground`, `border-input`, `ring-foreground/10`.
- Keep feature components small and functional. Move reusable appearance into
  `components/ui` instead of repeating long class strings.

## Token System

The canonical tokens live in `src/index.css`.

Control heights:

- `h-control-xs`: 1.75rem, used for compact editor toolbar controls.
- `h-control-sm`: 2rem, used for secondary compact buttons.
- `h-control-md`: 2.25rem, default comfortable control height.
- `h-control-lg`: 2.5rem, large controls and tab/toolbar containers.

Control padding:

- `px-control-x-sm`, `px-control-x-md`, `px-control-x-lg`
- `py-control-y-sm`, `py-control-y-md`

Surface spacing:

- `p-surface-panel`: general panel padding.
- `p-surface-card`, `p-surface-card-lg`: card and card-like surface padding.
- `px-page-x`, `py-page-y`: page-level padding.
- `gap-section-gap`: page section rhythm.

Radius:

- `rounded-control`: buttons, inputs, selects, menu items, small chips.
- `rounded-card`: cards and card-like blocks.
- `rounded-popover`: popovers, menus, dialogs.
- `rounded-pill`: pills, badges, switches.

Icon sizes:

- `size-icon-sm`: small toolbar/menu/card icons.
- `size-icon-md`: default button/control icons.
- `size-icon-lg`: large control icons.

## Typography

Typography has two layers:

1. Tailwind theme text variables: `text-ui-xs`, `text-ui-sm`, `text-ui-md`,
   `text-ui-lg`, `text-title-sm`, `text-title-md`, `text-title-lg`,
   `text-editor-body`.
2. Utility aliases: `type-ui-xs`, `type-ui-sm`, `type-ui-md`, `type-ui-lg`,
   `type-title-sm`, `type-title-md`, `type-title-lg`.

Use the `type-*` aliases in component class strings. They avoid
`tailwind-merge` conflicts with color utilities such as `text-muted-foreground`
or `text-primary-foreground`.

Common mapping:

- Labels, helper text, timestamps: `type-ui-xs` or `type-ui-sm`.
- Normal UI text and menu items: `type-ui-md`.
- Prompt/input text that should feel more open: `type-ui-lg`.
- Card titles and compact headers: `type-title-sm`.
- Artifact/editor title: `type-title-md`.

Letter spacing should stay `0` for app UI and editor prose. Avoid new
`tracking-*` classes unless there is a clear design reason.

## Primitive Patterns

`Button` sizes:

- `default`: 36px comfortable button.
- `sm`: 32px compact button.
- `lg`: 40px larger action.
- `xs`: 28px toolbar/very compact button.
- `icon`, `icon-sm`, `icon-lg`, `icon-xs`: square versions aligned to the same
  token scale.

Forms:

- `Input`, `Textarea`, `SelectTrigger`, `NativeSelect`, and `InputGroup`
  should use `rounded-control`, `h-control-md`, `type-ui-md`, and tokenized
  padding by default.
- Use `Label` instead of raw `label` so typography stays consistent.
- Raw `input` or `textarea` is only acceptable for deeply custom editor/content
  behavior; keep those tied back to `type-*` and spacing tokens.

Cards:

- Use `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`.
- Default card text is `type-ui-md`; card titles are `type-title-sm`.
- `size="sm"` is still available for compact sidebar cards, but it now uses
  tokenized padding and spacing.

Menus and popovers:

- Menu rows should be at least `min-h-control-sm`.
- Menu content should use `rounded-popover`, `type-ui-sm`, and tokenized
  padding.
- Shortcut text should use `type-ui-xs`, not arbitrary `text-[...]` values.

Editor chrome:

- Toolbar controls intentionally stay compact with `h-control-xs` and
  `type-ui-xs`.
- Toolbar icon buttons still use familiar icon-only controls, but sizes,
  separators, and gaps should be tokenized.
- The document body in `src/styles/editor.css` maps to app variables:
  foreground, muted foreground, border, muted, primary, and
  `--ui-text-editor-body`.

## Feature Screen Patterns

Project page:

- Page container uses `max-w-6xl`, `px-page-x`, `py-page-y`.
- Main column and sidebar use `gap-section-gap` or `gap-surface-card`.
- Sidebar width currently uses `w-86` for a more stable card measure.

Prompt and chat input:

- Prompt input is intentionally larger: `type-ui-lg`, `min-h-28`, tokenized
  card padding.
- Chat input uses standard `Textarea` and `Button` primitives with
  `p-surface-card` and `gap-3`.

Chat messages:

- Message bubbles use `rounded-card`, `px-surface-card`, `py-control-y-md`,
  and `type-ui-md`.

Editor:

- Artifact title bar uses `type-title-md`.
- Artifact/revision dropdown triggers use `h-control-xs`, `type-ui-xs`, and
  `rounded-control`.
- The toolbar should remain horizontally scannable; prefer compact tokenized
  controls over full-size form controls there.

## Development Checklist

When adding or changing UI:

1. Check whether a `components/ui` primitive already exists.
2. Use `type-*`, `h-control-*`, `px/py-control-*`, `rounded-*`, and
   `surface/page` tokens before adding arbitrary Tailwind values.
3. If a pattern repeats across features, move it into a primitive or small
   wrapper component.
4. Run:

```bash
bunx prettier --write <touched files>
bunx tsc --noEmit
bunx vitest run
```

5. For visible UI changes, inspect the running Tauri app with Tauri MCP:
   project page, chat/editor view, dropdowns/selects/dialogs, and both
   compact editor controls and comfortable form controls.
