# Background Generation

## Purpose

Chat generation is no longer owned by the open chat page. A singleton background store keeps the sidecar websocket running across route changes and writes generated assistant text/artifact content directly to SQLite as it streams.

Primary file:

- `src/components/chat/backgroundGenerationStore.ts`

Related surfaces:

- `chatSessionStore.ts`: route/page orchestration only; delegates submits.
- `messageStore.ts`: visible chat row patch/upsert hooks.
- `artifactStore.ts`: visible artifact revision patch hook.
- `sidecarStore.ts`: transport-only websocket parser.
- `generationMetadata.ts`: `metadata.generation` and `metadata.stream` shape.

## Stream Lifecycle

Submit flow from an open chat:

```text
ChatInput
  -> chatSessionStore.submitMessage()
  -> backgroundGenerationStore.startMessage()
  -> create user message row
  -> seal/resolve artifact context
  -> create assistant message row with metadata.stream.status = "active"
  -> sidecarStore.sendChatRequest()
```

Submit flow from the project page task input:

```text
NewTaskInput
  -> conversationStore.create(projectId)
  -> backgroundGenerationStore.startMessage({ artifactContext: null })
  -> create user message row
  -> create/select a target artifact for the new conversation
  -> create assistant message row with metadata.stream.status = "active"
  -> sidecarStore.sendChatRequest()
  -> navigate to /projects/:projectId/chats/:conversationId
```

`NewTaskInput` starts durable background generation before navigation. It does not pass `initialMessage` router state, and `ChatColumn` does not replay route state into `messageStore.addUserMessage()`. Passing `artifactContext: null` is intentional: a new project-page task must not seal or send stale editor artifact state from a previously opened chat.

Empty chat flow:

```text
CreateEmptyChatButton
  -> conversationStore.create(projectId)
  -> navigate to /projects/:projectId/chats/:conversationId
```

This creates a conversation only; it does not start generation, create messages, or create artifact revisions.

During streaming:

```text
text chunk
  -> update messages.content
  -> update messages.metadata.generation/stream
  -> messageStore.patchMessage() if conversation is open

artifact chunk
  -> create AI artifact_revision on first chunk
  -> update artifact_revisions.content on later chunks
  -> artifactStore.upsertStreamingAiRevision() if artifact is open
     (mirrors the sealed AI head as loaded but not editable)
```

Completion:

```text
completion.response
  -> persist final assistant content
  -> persist final generation metadata
  -> set metadata.stream.status = "complete"
  -> editor leaves streaming/read-only mode without emitting a TipTap update
  -> clear active job for that conversation
```

Failure:

```text
sidecar error / websocket failure
  -> set metadata.stream.status = "error"
  -> keep partial message/revision content
  -> notify if user is not viewing the failed chat
  -> clear active job
```

Startup recovery:

```text
App mount
  -> recoverInterruptedStreams()
  -> find assistant messages with stream.status = "active"
  -> if no in-memory job exists, mark stream.status = "interrupted"
```

## Metadata Shape

Assistant messages keep durable stream state in `messages.metadata`:

```ts
{
  generation: {
    startedAt,
    completedAt?,
    durationMs?,
    steps: [...]
  },
  stream: {
    status: "active" | "complete" | "interrupted" | "error",
    jobId,
    sourceUserMessageId,
    targetArtifactId,
    artifactRevisionId?,
    startedAt,
    updatedAt,
    completedAt?,
    error?
  }
}
```

`sourceUserMessageId` powers regenerate. `targetArtifactId` and `artifactRevisionId` make it possible to inspect which artifact/revision was affected by a streamed attempt.

## Concurrency Model

The store supports one active job per conversation:

```text
activeJobs: Record<conversationId, BackgroundGenerationJob>
```

Multiple conversations may stream at once. A second submit for the same conversation throws `"This conversation is already generating a response."`

## Status Indicators And Snackbars

In-app status reporting has two layers:

- Project cards and chat rows show `Spinner` beside their three-dot action menu when `activeJobs` contains a job for that project/conversation.
- Job completion and failure use `useNotificationStore` snackbars when the user is not already looking at the affected chat page.

Snackbar rules:

- Successful off-chat completion pushes a `success` notification: `Background job finished` or `Background job finished in <chat title>`.
- Failed off-chat completion pushes an `error` notification: `Background job failed` or `Background job failed in <chat title>`.
- Error notifications include the raw error in `detail`, so timeout text such as `Operation timed out after 45.0 seconds...` is available from the toast details.
- Both success and error snackbars include a `View` action that navigates to `/projects/:projectId/chats/:conversationId`.
- Dismiss still closes the snackbar without navigation.
- Notifications are suppressed when `isViewingChatRoute(projectId, conversationId)` is true because the user can see the result/error in-thread.

Route presence is tracked by `src/lib/routePresence.ts`; `AppShell` updates it from `useLocation()`. This avoids importing the router into `backgroundGenerationStore.ts`.

## Debug Checklist

Check these first:

- Active jobs: `useBackgroundGenerationStore.getState().activeJobs`
- Message stream state: inspect `messages.metadata.stream`
- Partial assistant text: inspect `messages.content`
- Partial artifact content: inspect `artifact_revisions.content`
- Visible editor mirror: inspect `useArtifactStore.getState().loadedRevisionId`, `headRevision`, and `editableRevisionId`
- Snackbar queue: `useNotificationStore.getState().notifications`
- Sidecar transport errors: `sidecarStore.sendChatRequest()` now rejects instead of returning `null`.

Common symptoms:

- Chat reopens with no visible progress: confirm `messageStore.loadForConversation()` loaded the assistant row and `metadata.stream.status` is `active`.
- Editor does not update during artifact streaming: confirm `targetArtifactId` matches the active artifact and `artifactStore.upsertStreamingAiRevision()` is called.
- Duplicate user revision appears after an AI artifact revision: confirm the AI head has `editableRevisionId === null`, and confirm `Editor` uses `editor.setEditable(!isStreaming, false)` so leaving read-only streaming mode does not fire `onUpdate`.
- Stuck active stream after restart: confirm `App.tsx` calls `recoverInterruptedStreams()`.
- Regenerate missing: confirm assistant message metadata has `stream.status` of `interrupted` or `error` and includes `sourceUserMessageId`.

## Tests

Focused checks:

```bash
bunx vitest run src/components/chat/__tests__/backgroundGenerationStore.test.ts
bunx vitest run src/components/chat/__tests__/chatSessionStore.test.ts
bunx vitest run src/components/chat/__tests__/sidecarStore.test.ts
```

Full checks:

```bash
bunx tsc --noEmit
bunx vitest run
```

Test intent:

- `backgroundGenerationStore.test.ts`: durable message/revision streaming, multi-chat concurrency, completion/error snackbars, recovery, regenerate.
- `NewTaskInput.test.tsx`: project-page task submission creates a conversation, starts background generation with `artifactContext: null`, then navigates.
- `CreateEmptyChatButton.test.tsx`: empty chat creation navigates without starting generation.
- `artifactStore.test.ts`: streamed AI revision mirror stays loaded but not editable; AI/sealed revisions do not become in-place editor targets.
- `chatSessionStore.test.ts`: route loading and submit delegation.
- `sidecarStore.test.ts`: websocket parsing and rejected failure paths.
