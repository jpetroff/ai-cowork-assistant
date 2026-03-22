## 1. Stores: messageStore

- [x] 1.1 Create `src/stores/messageStore.ts` with state shape: `messages`, `conversationId`, `status`, `isStreaming`, `streamingContent`, `streamingMessageId`
- [x] 1.2 Implement `loadForConversation(id)` — calls `listMessages(id)` from DB repository, sets `status`
- [x] 1.3 Implement `addUserMessage(content)` — determines next `sequence_order`, calls `createMessage()`, appends to `messages`
- [x] 1.4 Implement `clear()` — resets messages, conversationId, streaming state to initial
- [x] 1.5 Implement streaming stubs: `beginStreaming()`, `appendChunk(chunk)`, `finalizeStreaming(id, content)` — no-op bodies with TODO comments pointing to sidecar integration

## 2. Stores: artifactStore

- [x] 2.1 Create `src/stores/artifactStore.ts` with state shape: `artifacts`, `activeArtifactId`, `activeArtifact`, `conversationId`, `status`, `isDirty`, `isSaving`, `lastSavedAt`
- [x] 2.2 Implement `loadForConversation(id)` — calls `listArtifacts(id)`, activates highest-version artifact, creates initial artifact if none found
- [x] 2.3 Implement `updateContent(content)` — sets `isDirty`, schedules debounced `saveNow()` (1s), updates `activeArtifact.content` optimistically in store
- [x] 2.4 Implement `saveNow()` — guards against concurrent saves with `isSaving` flag, calls `updateArtifact({ content })`, clears `isDirty`, sets `lastSavedAt`
- [x] 2.5 Implement `rename(title)` — calls `updateArtifact({ title })`, updates `activeArtifact.title` in store
- [x] 2.6 Add stub actions with TODO comments: `linkToFile(path)`, `unlinkFile()`, `checkExternalChanges()`, `reloadFromDisk()` (FR-EDT-010, FR-EDT-011)
- [x] 2.7 Add stub state fields with TODO comments: `linkedFilePath`, `externalFileModified`

## 3. Update conversationStore.create()

- [x] 3.1 In `conversationStore.create(projectId)`, after `createConversation()` succeeds, call `createArtifact({ conversation_id, version: 1, content: '', title: null })` from the artifacts repository
- [x] 3.2 Handle artifact creation failure gracefully (log warning, do not block conversation creation)

## 4. Update chat route loader

- [x] 4.1 In `router.tsx`, update the `projects/:projectId/chats/:chatId` loader to call `projectStore.setActive(projectId)` if no active project
- [x] 4.2 Load conversations for the project if `conversationStore.activeProjectId !== projectId`
- [x] 4.3 Call `conversationStore.setActive(chatId)`, then `messageStore.loadForConversation(chatId)` and `artifactStore.loadForConversation(chatId)` in parallel

## 5. Layout: ChatLayout refactor

- [x] 5.1 Rewrite `ChatLayout` to a two-column flex layout: `ChatColumn` (width from store/setting) + `EditorSection` (flex-1) with a `DragHandle` between them
- [x] 5.2 On mount, read `chat_column_width` from `AppSetting` (import from `src/lib/db/settings.ts`) and initialize column width state; default to 320
- [x] 5.3 Implement `DragHandle` component — thin vertical strip with `cursor-col-resize`, attaches `mousemove`/`mouseup` to `document` on `mousedown`, clamps width between 240–560px
- [x] 5.4 On drag end (`mouseup`), write final width to `AppSetting` key `chat_column_width`
- [x] 5.5 Add `min-w-0` and overflow guards to `EditorSection` to prevent layout blowout on resize

## 6. ChatColumn: header and navigation

- [x] 6.1 Create `src/components/chat/ChatColumn.tsx` as the left panel container (`flex-col h-full`)
- [x] 6.2 Create `src/components/chat/ChatColumnHeader.tsx` — shows back link to `/projects/:projectId` and the active conversation title (from `conversationStore`)
- [x] 6.3 Add a `⋮` dropdown to `ChatColumnHeader` with Rename and Delete actions (reuse store actions from `conversationStore`; show `AlertDialog` for delete, inline input for rename)

## 7. ChatColumn: message list

- [x] 7.1 Rewrite `src/components/chat/MessageList.tsx` to read from real `messageStore` (remove `stubs.ts` import)
- [x] 7.2 Create `src/components/chat/MessageBubble.tsx` — renders user messages (right-aligned, background) and assistant messages (left-aligned, prose-formatted) based on `message.role`
- [x] 7.3 Add auto-scroll: `useEffect` watching `messages.length` and `streamingContent` scrolls the list container ref to bottom
- [x] 7.4 Add `MessageListEmpty` state — shown when `messages.length === 0` and `status === 'ready'`
- [x] 7.5 Add `StreamingBubble` component (shown when `isStreaming === true`) with animated indicator and `streamingContent` display
- [x] 7.6 Add stub zone comment in `MessageList` for `ToolCallIndicator` (tool execution steps) — `{/* STUB: tool-call-indicator — render AI tool call steps here (FR-AI-007) */}`
- [x] 7.7 Add stub zone comment in `MessageList` for `HitlApprovalCard` (human-in-the-loop) — `{/* STUB: hitl-approval — render approval card for AI-proposed actions here (FR-AI-004, BR-AI-005) */}`

## 8. ChatColumn: chat input

- [x] 8.1 Create `src/components/chat/ChatInput.tsx` — textarea with Send button, Cmd/Ctrl+Enter shortcut, disabled while `isStreaming`
- [x] 8.2 On submit, call `messageStore.addUserMessage(content)`, clear the textarea
- [x] 8.3 Handle `location.state.initialMessage` in `ChatColumn` — on mount, if present, call `messageStore.addUserMessage(initialMessage)` and clear router state
- [x] 8.4 Add stub zone comment above textarea for `SelectionContext` badge — `{/* STUB: selection-context — show editor selection badge here (FR-CHT-005) */}`

## 9. EditorSection: artifact title bar

- [x] 9.1 Create `src/components/editor/ArtifactTitleBar.tsx` — large title text (click-to-edit), `SaveStatus` indicator, stub zones
- [x] 9.2 Implement inline title editing: click → `<input>`, blur/Enter → `artifactStore.rename(title)`, empty → save `null` (show "Untitled" placeholder)
- [x] 9.3 Implement `SaveStatus`: show "Saving…" when `isDirty || isSaving`, show "Saved" (with fade) when clean and `lastSavedAt` is set
- [x] 9.4 Add stub zone comment for `ArtifactVersionBadge` — `{/* STUB: artifact-version — show version badge/selector here (e.g. "v3 of 5") */}`
- [x] 9.5 Add stub zone comment for `LinkToFileButton` — `{/* STUB: link-to-file — file sync button here (FR-EDT-010) */}`

## 10. EditorSection: wire ProjectEditor

- [x] 10.1 Rewrite `src/components/editor/EditorPanel.tsx` to read `activeArtifact` from real `artifactStore` (remove `stubs.ts` import)
- [x] 10.2 Pass `value={activeArtifact.content}` and `onChange={artifactStore.updateContent}` to `ProjectEditor`
- [x] 10.3 Read `isStreaming` from `messageStore` and pass to `ProjectEditor`
- [x] 10.4 Show `EditorSkeleton` while `artifactStore.status === 'loading'`
- [x] 10.5 Ensure `ProjectEditor`'s `ScrollArea` uses full available height (remove or adjust `max-h-[calc(100vh-12rem)]` cap so editor fills the panel)

## 11. Wire stubs.ts removal

- [x] 11.1 Remove `useMessageStore` and `useArtifactStore` exports from `src/stores/stubs.ts` (or delete the file if empty)
- [x] 11.2 Update all imports referencing the stub hooks to point to the real stores
- [x] 11.3 Run `bunx tsc --noEmit` and fix any type errors
