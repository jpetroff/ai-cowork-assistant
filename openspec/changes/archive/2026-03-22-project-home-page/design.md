## Context

The app currently has a skeleton `ProjectPage` that renders only loading placeholders. The project home at `/projects/:projectId` is the primary post-navigation destination — it must let users start tasks (new conversations), review prior chats, and configure the project environment (folder, AI settings).

The codebase already has: a working `projectStore`, conversation and artifact repositories, `llm_providers` table, `app_settings` key-value table, and a full suite of shadcn/ui components. State management follows a strict Zustand-only pattern: no `useEffect` for data fetching in components — all side effects run in store actions or route loaders.

## Goals / Non-Goals

**Goals:**
- Fully functional project home page with two-column layout (left: task input + chat list; right: sidebar cards)
- `conversationStore` — create, list, rename, delete, with per-id operation state guards
- `llmProviderStore` — load providers and their model lists (cached per session)
- Per-project AI config stored in `app_settings` as `project:{id}:ai_config` JSON
- Flexible artifact queries: add `listArtifactsByProject(projectId)` via JOIN
- Inline project rename in the page header
- Stub `FilesCard` (UI only)

**Non-Goals:**
- FilesCard backend (upload, storage, indexing) — reserved for a future change
- Full `AppHeader` / persistent top navigation — deferred
- Settings page implementation — the AI config card links to it but the route is not built here
- ChromaDB re-indexing trigger from the folder card — deferred
- Conversation message preview in the chat list row

## Decisions

### D1: Column layout — `flex-1` left + fixed `w-80` right

**Decision**: Left column takes all remaining width (`flex-1`), right column is fixed at `w-80` (320px). The whole layout is constrained by `max-w-5xl mx-auto` with horizontal padding.

**Rationale**: The right sidebar contains compact info cards (artifact list, folder path, AI config) that don't benefit from stretching on wide screens. A fixed sidebar width mirrors common tool UIs (Linear, Notion). `max-w-5xl` (~1024px) prevents the left column from becoming uncomfortably wide on ultrawide displays.

**Alternative considered**: `grid-cols-[2fr_1fr]` — rejected because it makes the right column grow unnecessarily on wide screens.

---

### D2: New task textarea — auto-grow with Cmd/Ctrl+Enter to send

**Decision**: Use a `<textarea>` that auto-grows from 1 to ~5 rows via CSS (`field-sizing: content` or a JS resize observer fallback). `Enter` inserts a newline; `Cmd+Enter` / `Ctrl+Enter` submits. A Send button is positioned inside the input box (bottom-right corner), disabled when empty.

**Rationale**: This matches established AI chat input conventions (Claude.ai, ChatGPT, Cursor). Single-line inputs feel jarring for a task description that may be multi-sentence. The keyboard shortcut follows the same convention as most AI products.

**Alternatives considered**:
- Single-line `<input>` — too constrained for multi-sentence task descriptions
- Bubble-style composer (full bottom bar) — too heavy for a home page entry point, better suited for the chat view itself

---

### D3: Conversation store — mirrors `projectStore` pattern exactly

**Decision**: `conversationStore` follows the identical Zustand pattern as `projectStore`: per-id `operationStates`, DB-first writes, error notifications pushed to `notificationStore`.

**Rationale**: Consistency reduces cognitive overhead. The pattern is already established and tested. Route loader calls `conversationStore.getState().loadForProject(projectId)`.

---

### D4: Per-project AI config — `app_settings` JSON key

**Decision**: Store per-project AI config as a single JSON value in `app_settings` with key `project:{projectId}:ai_config`. Shape: `{ provider_id: string | null, model: string | null, embedding_model: string | null }`.

**Rationale**: `app_settings` is the existing escape hatch for flexible key-value configuration. Adding columns to `projects` would require a migration; a JSON blob in `app_settings` works cleanly with clean-state assumption. A dedicated `projectSettingsStore` (thin wrapper) keeps concerns separated without adding a new table.

**Alternative considered**: New `project_settings` table — rejected as over-engineering for 3 fields; migration-free approach preferred.

---

### D5: LLM provider + model loading — `llmProviderStore`

**Decision**: New `llmProviderStore` with `loadAll()` (reads from `llm_providers` table) and `fetchModels(providerId)` (calls provider `/models` endpoint, caches result in store). The AI config card calls `loadAll()` on mount via the project route loader; `fetchModels` is called lazily when the provider select changes.

**Rationale**: Provider list is global config (not per-project). Keeping it in its own store allows re-use in a future settings panel. Model lists are fetched live (spec FR-LLM-007) and cached per-session.

**Alternative considered**: Embedding in `projectSettingsStore` — rejected because provider loading is global, not project-scoped.

---

### D6: Inline rename in project header

**Decision**: The project name in the header is a toggle between a display `<h1>` and an inline `<input>`. Clicking the name switches to edit mode; `Enter` or the ✓ button applies; `Esc` or × discards. This calls the existing `projectStore.rename()` action.

**Rationale**: Inline rename is common in project/doc tools (Notion, Linear) and avoids an extra modal. The existing `RenameProjectForm` modal remains on the project list card; the header gets the inline pattern which suits the "you're already inside this project" context.

---

### D7: Artifacts card — project-scoped query

**Decision**: Add `listArtifactsByProject(projectId, limit?)` to the artifacts repository using a JOIN:
```sql
SELECT a.* FROM artifacts a
JOIN conversations c ON a.conversation_id = c.id
WHERE c.project_id = $1
ORDER BY a.updated_at DESC
LIMIT $2
```
The card fetches `limit=3` for the preview and `null` (no limit) for the modal.

**Rationale**: The artifacts table has no direct `project_id` column; joining through conversations is the correct normalized query. Keeping it in the repository layer keeps components agnostic of SQL.

---

### D8: "Show all" artifacts — Sheet (slide-over), not modal dialog

**Decision**: Use a shadcn `Sheet` (side panel) rather than a centered `AlertDialog` or `Dialog` for the full artifact list.

**Rationale**: Artifact lists can be long; a sheet provides scroll-friendly vertical space without obscuring the full page. It also follows the pattern of similar "see all" surfaces in productivity tools. The existing `sheet.tsx` component is already available.

---

### D9: Hover-reveal chat row actions

**Decision**: The `...` dropdown on each conversation row is hidden by default and revealed on row hover via CSS (`group-hover:opacity-100`). The dropdown contains Rename (triggers inline title edit on the row) and Delete (triggers an `AlertDialog` confirmation).

**Rationale**: Hover-reveal reduces visual noise in long chat lists. This is appropriate for a desktop app where hover is reliable. The pattern matches common chat/document list UIs.

## Risks / Trade-offs

- **Model fetch latency**: Calling `/models` per provider at project load could slow entry if providers are unreachable. → Mitigation: fire `fetchModels` calls in background; show skeleton selects until resolved; never block render.
- **app_settings JSON drift**: If the AI config shape changes in a future version, existing stored JSON will need a migration or graceful parse fallback. → Mitigation: always parse with a safe default (`{ provider_id: null, model: null, embedding_model: null }`) and re-save on any change.
- **No embedding model in llm_providers schema**: The `embedding_model` field in the AI config is a free-text string — it won't be validated against a real model list until a dedicated embedding provider concept is added. → Accepted for now; field is a stub for future implementation per spec FR-AI-006.

## Open Questions

- Should the conversation list show a count badge (e.g., "12 chats") or just render all rows with scroll? — Recommend scrollable list with no count badge for MVP; list is naturally bounded.
- Should the folder card trigger ChromaDB re-indexing when a folder is attached or changed? — Deferred; folder card writes `project.folder_path` only; indexing is a future step.
