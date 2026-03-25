## ADDED Requirements

### Requirement: System messages with revision metadata are rendered as artifact revision cards
The system SHALL render an `ArtifactRevisionCard` component (not a `MessageBubble`) for any message with `role: 'system'` and a valid `metadata.revisionId`. All other messages SHALL continue to render as `MessageBubble` components. `buildThread` SHALL accept only the `messages` array (revisions are no longer merged separately).

#### Scenario: System revision message renders as ArtifactRevisionCard
- **WHEN** `MessageList` processes a `ThreadItem` whose message has `role: 'system'` and `metadata.revisionId`
- **THEN** an `ArtifactRevisionCard` is rendered for that item, not a `MessageBubble`

#### Scenario: User and assistant messages render as MessageBubble
- **WHEN** `MessageList` processes a `ThreadItem` with `role: 'user'` or `role: 'assistant'`
- **THEN** a `MessageBubble` is rendered, unchanged from previous behavior

#### Scenario: buildThread no longer requires revisions array
- **WHEN** `buildThread(messages)` is called with only the messages array
- **THEN** it returns a sorted `ThreadItem[]` containing all messages, including system messages, in `created_at` ascending order

#### Scenario: System messages without revisionId metadata are excluded from the thread
- **WHEN** a message has `role: 'system'` but `metadata` is null or has no `revisionId`
- **THEN** it does not appear in the rendered thread
