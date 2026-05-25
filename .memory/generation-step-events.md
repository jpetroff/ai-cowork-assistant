# Generation Step Events

This documents how Python sidecar events are now treated during chat response generation and what frontend outputs are supported.

## Current Event Treatment

Chat completion still streams over the sidecar WebSocket endpoint:

- Endpoint: `/completion`
- Frontend stream parser: `src/components/chat/sidecarStore.ts`
- Chat orchestration: `src/components/chat/chatSessionStore.ts`
- Message persistence: `src/components/chat/messageStore.ts`
- Python workflow stream adapter: `src-python/llamaflows/run_workflow.py`

The frontend now captures generation metadata while the assistant response is streaming. Metadata is persisted on the assistant message in the existing `messages.metadata` column as:

```json
{
  "generation": {
    "startedAt": 1710000000000,
    "completedAt": 1710000002500,
    "durationMs": 2500,
    "steps": [
      {
        "id": "step-1",
        "kind": "event",
        "title": "Generating artifact...",
        "payload": {
          "msg": "Generating artifact...",
          "event_name": "ProgressEvent"
        },
        "startedAt": 1710000000000,
        "endedAt": 1710000001200,
        "durationMs": 1200
      }
    ]
  }
}
```

No schema migration is required. Existing messages with empty, missing, or malformed metadata continue rendering normally.

## Supported Sidecar Outputs

### Assistant Text

```json
{ "type": "completion.chunk", "content": "Visible assistant text" }
```

- Appended to the visible assistant message stream.
- Included in the final assistant message content.

### Artifact Text

```json
{
  "type": "completion.chunk",
  "content_type": "text/markdown",
  "content": "# Artifact content"
}
```

- Routed separately from assistant text.
- Used for live artifact preview and final AI artifact revision.
- Not stored inside generation step payload metadata.

### Thinking Chunks

```json
{ "type": "completion.chunk.thinking", "content": "internal notes" }
```

Also supported for compatibility with the requested spelling:

```json
{ "type": "chunk.completion.thinking", "content": "internal notes" }
```

- Displayed as a generation step titled `Thinking`.
- Consecutive thinking chunks append to the same active thinking step.
- Thinking content is saved in `generation.steps[].content`.
- Thinking content is visible from the generation steps drawer.

### Generic Workflow Events

```json
{
  "type": "event",
  "payload": {
    "msg": "Generating artifact...",
    "event_name": "ProgressEvent"
  }
}
```

- Python now adds `event_name` from the event class name before sending generic `event` frames.
- Step title selection:
  - `payload.msg` when present and non-empty.
  - `payload.event_name` when `msg` is unavailable.
  - `Workflow event` as a final fallback.
- Each new generic event closes the previous active step and starts a new one.
- Payloads are preserved except artifact-bearing fields are stripped recursively:
  - `artifact`
  - `artifact_text`

### Completion Response

```json
{ "type": "completion.response", "content": "" }
```

- Closes the active generation step.
- Finalizes `completedAt` and `durationMs`.
- Persists the assistant message with `metadata.generation` when assistant text content exists.

### Error Response

```json
{
  "type": "error",
  "payload": { "message": "failure", "code": "internal_error" }
}
```

- Fails the stream and surfaces the existing sidecar error flow.
- Does not persist generation metadata when no assistant message is created.

## Supported UI Outputs

- While the assistant is streaming, chat shows one live step line with shimmer text instead of the old three animated dots.
- If assistant text is already visible, the current step remains under the streaming message content.
- Clicking the live step opens a bottom sheet with all captured steps and details.
- After completion, assistant messages with generation metadata show `Thought for X sec` or `Thought for X min`.
- Clicking the completed thought summary opens the same bottom sheet with the saved steps.
- The drawer shows each step title, duration, kind, optional thinking content, and sanitized payload JSON.

## Future Enhancements

- Add explicit event categories in Python, such as `progress`, `tool`, `retrieval`, `artifact`, or `validation`, so the frontend can render richer labels and icons without guessing from payload shape.
- Add stable event IDs from the sidecar if workflows need to update an existing step rather than always starting a new one.
- Add structured visibility flags, for example `show_content_to_user`, for models or workflows that emit sensitive thinking data.
- Add a payload size cap or summarization policy for large non-artifact event payloads.
- Add start/end events from Python for long-running workflow phases so durations are authoritative rather than inferred from the next event.
- Add typed TypeScript schemas for generation metadata once multiple workflows produce step events.
- Add a compact step summary to thread search or export, separate from the full drawer payload.
- Add visual grouping for repeated thinking, retrieval, and artifact phases if the workflow becomes multi-stage.
