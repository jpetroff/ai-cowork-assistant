## Context

The chat page (`/projects/:projectId/chats/:chatId`) is the core workspace. The existing `ChatLayout` is a three-column skeleton using stub hooks (`useMessageStore`, `useArtifactStore` from `stubs.ts`) that always return `status: 'loading'`. The `ProjectEditor` component is already fully implemented (TipTap 3.x, 13+ extensions, markdown toggle, table toolbar) but disconnected from any data. DB repositories for messages and artifacts already exist. The `conversationStore` is complete. The route loader for the chat page currently only calls `setActive()`.

## Goals / Non-Goals

**Goals:**
- Two-column layout: resizable chat column (left) + editor panel (right, flex-1)
- Fully working TipTap editor connected to the active artifact (read, edit, auto-save)
- Google Docs-style artifact title (inline editable, above the editor)
- Column width persisted to `AppSetting` via existing key-value store
- User messages created in SQLite and displayed — full message list
- `initialMessage` from router state sent as first user message on mount
- Every new conversation auto-creates an empty artifact
- Streaming-ready editor: `isStreaming` locks editor during AI writes
- Clearly marked STUB zones for LLM, tool calls, HITL, file linking

**Non-Goals:**
- LLM integration / WebSocket sidecar (stubs only)
- Artifact version history UI
- File-link-to-disk (FR-EDT-010)
- External change detection (FR-EDT-011)
- Editor text selection → AI context (FR-CHT-005)
- Conversation search or filtering

## Decisions

### D1: Two-column layout, not three

**Decision:** Merge the conversations sidebar into the project page navigation. The chat page is a two-panel layout: `ChatColumn` (resizable) + `EditorSection` (flex-1). Conversation switching happens by navigating back to `/projects/:projectId`.

**Rationale:** The spec emphasizes editor primacy — users should love the editor. A permanent conversations sidebar consumes horizontal space that belongs to the canvas. Three columns at 1200px leave ~400px for the editor, which is too cramped. The existing `ConversationRow` component with rename/delete is reachable from the project page.

**Alternative considered:** Keep the conversations sidebar as a collapsible panel. Rejected for MVP — adds state management complexity (open/closed, persistence) without clear user need.

---

### D2: Drag-to-resize with AppSetting persistence

**Decision:** A thin `DragHandle` component sits between the two columns. On `mousedown` it attaches `mousemove`/`mouseup` listeners to `document`, updates local state live, and persists the final width to `AppSetting` key `chat_column_width` on `mouseup`. Default 320px, min 240px, max 560px.

**Rationale:** `AppSetting` (key-value table) already exists and is the correct store for UI preferences. This is a global setting (same width across all projects/conversations).

**Implementation note:** Width is read once on `ChatLayout` mount via `settings.get('chat_column_width')`, defaulting to 320. Write happens only on drag end to avoid DB thrash.

---

### D3: messageStore as a standalone Zustand store

**Decision:** Create `src/stores/messageStore.ts`. It owns: `messages[]`, `conversationId`, `status`, `isStreaming`, `streamingContent`. Actions: `loadForConversation`, `addUserMessage`, `beginStreaming`, `appendChunk`, `finalizeStreaming`, `clear`.

**Rationale:** Messages are conversation-scoped. Keeping them separate from `conversationStore` maintains single-responsibility and makes it easy to swap in WebSocket streaming later without touching conversation list logic.

---

### D4: artifactStore owns active artifact content + auto-save

**Decision:** Create `src/stores/artifactStore.ts`. It owns: `artifacts[]`, `activeArtifactId`, `activeArtifact`, `isDirty`, `isSaving`, `lastSavedAt`. The `updateContent(content)` action marks dirty and triggers a 1-second debounced `saveNow()`. Auto-save uses a module-level `setTimeout` ref (not `useEffect`) so it survives re-renders.

**Rationale:** The editor's `onChange` fires on every keystroke. Saving to SQLite on every keystroke would cause DB contention and UI jank. 1s debounce matches the spec (BR-EDT-001: auto-save shall not block or freeze editor UI).

**Streaming interaction:** When `isStreaming` is true, `updateContent()` calls from the AI path bypass the debounce and write directly via `appendChunk`. User-initiated `updateContent` during streaming is blocked (editor is read-only).

---

### D5: Artifact title as separate `Artifact.title` field, rendered above editor

**Decision:** `ArtifactTitleBar` renders above `ProjectEditor`. It shows `artifact.title ?? 'Untitled'` in a large, muted font. Click → `<input>` with same size/font. Blur or Enter → `artifactStore.rename(title)` → `updateArtifact({ title })`.

**Rationale:** Title is document metadata, not document content. Storing it as the first H1 in TipTap content would cause serialization issues (markdown ↔ TipTap round-trips can corrupt headings). Google Docs separates title from content for the same reason.

---

### D6: Initial artifact created in conversationStore.create()

**Decision:** `conversationStore.create(projectId)` calls `createArtifact({ conversation_id, version: 1, content: '' })` immediately after `createConversation()`. `artifactStore.loadForConversation()` also creates one if the artifacts array is empty (safety net for direct URL navigation or edge cases).

**Rationale:** FR-CHT-004 mandates an empty artifact on every new conversation. Doing it in `create()` ensures it's always there. The safety net handles the case where a user navigates directly to a chat URL with an empty artifacts table.

---

### D7: initialMessage handled in ChatColumn via useLocation

**Decision:** `ChatColumn` reads `location.state?.initialMessage` via `useLocation()`. On mount (effect with `conversationId` dep), if `initialMessage` is present, it calls `messageStore.addUserMessage(initialMessage)` and clears the router state to prevent replay on re-render.

**Rationale:** The route loader already runs before the component mounts, so messages are loaded. The initial message is the first addition to that loaded (empty) list. Clearing state prevents the message from being sent again on HMR or strict mode double-mount.

---

### D8: Chat route loader loads all required data

**Decision:** Update the `projects/:projectId/chats/:chatId` loader to:
1. Ensure project is active (guard for direct navigation)
2. Load conversations for the project if not already loaded for this `projectId`
3. Call `conversationStore.setActive(chatId)`
4. Load messages for the conversation
5. Load artifacts for the conversation

**Rationale:** React Router v7 loaders run before render. Components should read from store, not trigger their own loads via `useEffect`. This matches the pattern established by the project route loader.

## Risks / Trade-offs

**[Streaming content updates cause layout jank]** → When `isStreaming`, the editor is locked but `value` still updates. TipTap's `setContent()` on every chunk could be expensive. Mitigation: buffer chunks and update at a fixed interval (100ms) rather than on every token — add `streamingBuffer` with `setInterval` flush. Mark as STUB in code, optimize if needed.

**[Auto-save race condition]** → User edits, debounce fires, user edits again before DB write completes. The second write could arrive before the first. Mitigation: `artifactStore.saveNow()` checks `isSaving` flag and re-queues if already in flight.

**[Direct URL navigation misses project context]** → If a user pastes `/projects/X/chats/Y` directly, `projectStore` has no active project. The loader guard handles this, but `projectStore.setActive()` (which is synchronous) may not trigger all side effects. Mitigation: loader explicitly calls `setActive` + checks `conversationStore.activeProjectId` before loading conversations.

**[Column width on window resize]** → A fixed pixel width looks bad on small screens. The 240px minimum and 560px maximum don't clamp to window size. Mitigation: clamp on mount and on window resize event in `ChatLayout`. Add `min-w-0` to `EditorSection` to prevent overflow.

## Open Questions

- Should `ChatColumnHeader` show a "New conversation" button? Currently new conversations are created from the project page. Adding one here would require creating a conversation and navigating (or staying on the same page with a new ID). Deferred — start without it.
- Should `Cmd+S` trigger `saveNow()` explicitly? The `ProjectEditor` doesn't intercept keyboard events at the page level. Worth adding as a keyboard shortcut in `EditorSection`. Marked as STUB for now.
