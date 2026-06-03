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

Submit flow:

```text
ChatInput
  -> chatSessionStore.submitMessage()
  -> backgroundGenerationStore.startMessage()
  -> create user message row
  -> seal/resolve artifact context
  -> create assistant message row with metadata.stream.status = "active"
  -> sidecarStore.sendChatRequest()
```

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
```

Completion:

```text
completion.response
  -> persist final assistant content
  -> persist final generation metadata
  -> set metadata.stream.status = "complete"
  -> clear active job for that conversation
```

Failure:

```text
sidecar error / websocket failure
  -> set metadata.stream.status = "error"
  -> keep partial message/revision content
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

## Debug Checklist

Check these first:

- Active jobs: `useBackgroundGenerationStore.getState().activeJobs`
- Message stream state: inspect `messages.metadata.stream`
- Partial assistant text: inspect `messages.content`
- Partial artifact content: inspect `artifact_revisions.content`
- Sidecar transport errors: `sidecarStore.sendChatRequest()` now rejects instead of returning `null`.

Common symptoms:

- Chat reopens with no visible progress: confirm `messageStore.loadForConversation()` loaded the assistant row and `metadata.stream.status` is `active`.
- Editor does not update during artifact streaming: confirm `targetArtifactId` matches the active artifact and `artifactStore.upsertStreamingAiRevision()` is called.
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

- `backgroundGenerationStore.test.ts`: durable message/revision streaming, multi-chat concurrency, recovery, regenerate.
- `chatSessionStore.test.ts`: route loading and submit delegation.
- `sidecarStore.test.ts`: websocket parsing and rejected failure paths.
