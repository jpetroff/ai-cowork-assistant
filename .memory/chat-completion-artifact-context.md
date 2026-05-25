# Chat Completion Artifact Context

This documents the artifact-related payload contract for the Python sidecar chat completion websocket endpoint.

## Endpoint

- Websocket path: `/completion`
- URL construction: convert sidecar HTTP base URL to WebSocket and append `/completion`
  - `http://127.0.0.1:9720` -> `ws://127.0.0.1:9720/completion`
  - `https://host` -> `wss://host/completion`
- Frontend sender: `src/components/chat/sidecarStore.ts`
- Send orchestration: `src/components/chat/chatSessionStore.ts`
- Python request schema: `src-python/schemas.py` `ChatCompletionRequest`
- Generated TypeScript counterpart: `src/lib/api-types.ts`
- Workflow: `src-python/llamaflows/default/main.py` `SimpleQueryWorkflow`

The request body uses snake_case keys in the frontend payload. `schemas.py` also accepts existing camelCase aliases for some optional fields (`chatHistory`, `fileUploads`, `workingFolder`, `knowledgeHubs`), but current frontend chat completion sends snake_case.

## Request Shape

Minimum payload:

```json
{
  "message": "User message",
  "chat_history": [],
  "artifact": null
}
```

Full supported shape:

```json
{
  "message": "User message",
  "chat_history": [
    { "role": "user", "content": "Earlier user message" },
    { "role": "assistant", "content": "Earlier assistant response" }
  ],
  "artifact": {
    "artifact_id": "artifact uuid",
    "revision_id": "revision uuid or null",
    "content": "artifact revision content"
  },
  "observability": null,
  "file_uploads": null,
  "working_folder": null,
  "knowledge_hubs": null
}
```

## Artifact Field

`artifact` is optional in the Python schema and defaults to `None`, but the frontend should send it explicitly:

- `artifact: null` means no artifact is attached as context.
- `artifact: { ... }` means the response should generate or update content for that artifact.

`ChatCompletionArtifactContext`:

```json
{
  "artifact_id": "required artifact id",
  "revision_id": "optional revision id; may be null or omitted",
  "content": "required string; may be empty"
}
```

Important distinction:

- `artifact: null` means "no attached artifact".
- `artifact.content: ""` with an `artifact_id` means "an artifact is attached, but it has no content yet".

## Typical Cases

### No Artifact Attached

Use when the user removed artifact context or the workflow should create a brand-new artifact target.

```json
{
  "message": "Write a project brief",
  "chat_history": [],
  "artifact": null
}
```

Frontend behavior:

- `chatSessionStore` creates/navigates to a new artifact before streaming when the result needs an artifact target.
- The request still sends `artifact: null`.
- When the assistant returns artifact content, `applyAiRevision()` writes it to the newly created artifact ID.

Python behavior:

- `_format_artifact_context(None)` tells the model no artifact is attached and a new artifact should be generated.

### Existing Artifact With Revision

Use when the current or selected artifact has a persisted current/latest revision.

```json
{
  "message": "Rewrite this in a more formal tone",
  "chat_history": [],
  "artifact": {
    "artifact_id": "art-1",
    "revision_id": "rev-1",
    "content": "# Existing artifact\n\nCurrent content..."
  }
}
```

Frontend behavior:

- Active artifact: `sealForSend(userMessageId)` returns the revision context.
- Selected non-active artifact: `getArtifactContextForSend(artifactId, userMessageId)` returns the revision context and `requestArtifactLoad(artifactId)` navigates the editor before streaming.
- Returned artifact content is applied to the same `artifact_id`.

Python behavior:

- The prompt receives artifact ID, revision ID, and content.

### Empty Artifact

Use when an artifact is attached but the editor content is empty.

```json
{
  "message": "Draft a limerick",
  "chat_history": [],
  "artifact": {
    "artifact_id": "art-empty",
    "revision_id": null,
    "content": ""
  }
}
```

This is not the same as `artifact: null`. It means the response must generate content for the specified artifact ID.

Frontend behavior:

- `sealForSend()` and `getArtifactContextForSend()` return `{ artifactId, revisionId: null, content: "" }` when the artifact exists but has no revisions.
- The request sends `revision_id: null`, not an empty string.
- When the assistant returns artifact content, `applyAiRevision()` creates the first AI revision for that exact artifact.

Python behavior:

- `revision_id` is `Optional[str] = None`, so explicit `null` and an omitted `revision_id` are both valid.
- `_format_artifact_context()` treats `revision_id is None and content == ""` as an attached empty artifact and tells the model to generate content for it.

### Artifact With No Revisions Yet

This is the storage-state version of the empty artifact case.

Database state:

- `artifacts.current_revision_id` is `NULL`.
- `artifact_revisions` has no rows for the artifact.

Outgoing request:

```json
{
  "message": "Fill this document",
  "chat_history": [],
  "artifact": {
    "artifact_id": "art-revisionless",
    "revision_id": null,
    "content": ""
  }
}
```

Expected result:

- The sidecar response should include generated artifact content.
- The frontend must apply that content to `art-revisionless`, not create a different artifact.
- `applyAiRevision(content, assistantMessageId, "art-revisionless")` creates the first revision and updates artifact head.

## Response Handling

The sidecar sends JSON text frames. Both artifact and chat text stream as `completion.chunk`; artifact chunks carry `content_type`.

`DefaultResponse` frame shape:

```ts
{
  type: string
  content?: string | number | null
  content_type?: string | null
  payload?: unknown
}
```

Artifact chunk:

```json
{
  "type": "completion.chunk",
  "content_type": "text/markdown",
  "content": "# Artifact title\n"
}
```

Chat/followup chunk:

```json
{
  "type": "completion.chunk",
  "content": "Created the draft and matched the requested tone."
}
```

Thinking chunk:

```json
{
  "type": "completion.chunk.thinking",
  "content": "internal model thinking delta"
}
```

Done frame:

```json
{
  "type": "completion.response",
  "content": ""
}
```

Frontend routing:

- `content_type` present -> append to artifact accumulator and stream to editor preview.
- `content_type` absent -> append to chat message accumulator.
- On `completion.response`, finalize the assistant message, then persist one AI artifact revision if artifact content was accumulated.
- `completion.response.content`, if non-empty, is treated as final untyped chat content.

Current implemented artifact content type:

```json
"text/markdown"
```

## Safety Notes

- Do not use an empty string as a sentinel for a missing revision. Use `null` or omit `revision_id`.
- Do not use inline artifact delimiters like `|artifact|>` / `<|artifact|`; route by `content_type`.
- Keep `schemas.py` and `src/lib/api-types.ts` in sync by regenerating the TypeScript types after schema changes.
- `sidecarStore.ts` should use the generated `ChatCompletionRequest` type rather than defining a parallel request interface.
- Large artifact content is currently sent inline over the websocket. This is acceptable for normal document-sized artifacts, but very large artifacts will duplicate memory across JSON serialization, websocket transfer, Pydantic validation, prompt construction, and LLM context.
- The Python sidecar cannot call Tauri frontend plugin APIs directly. Fetch-by-ID from Python would require a separate Rust/HTTP bridge or direct SQLite access, so inline content is the current practical path.
