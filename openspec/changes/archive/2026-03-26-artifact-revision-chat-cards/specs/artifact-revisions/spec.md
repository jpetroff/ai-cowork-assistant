## MODIFIED Requirements

### Requirement: Sending a message seals the HEAD revision with a system message anchor
The system SHALL associate the HEAD revision with a dedicated `role: 'system'` message (not the user message) when the user submits a message with artifact context attached. The `sysMsgCreator` callback is injected into `sealForSend` and is only invoked in paths that create or seal a revision. The reuse paths (`_reuseLastSealed`, `_reuseCurrentHead`) SHALL NOT invoke the callback.

#### Scenario: Unsent HEAD with changed content — sealed with system message
- **WHEN** the user sends a message with artifact AND `HEAD.message_id == null` AND content has changed
- **THEN** a `role: 'system'` message is created, `HEAD.message_id` is set to that system message's id, no new revision is created

#### Scenario: Already-sealed HEAD with changed content — new revision sealed with system message
- **WHEN** the user sends a message with artifact AND `HEAD.message_id != null` AND content has changed
- **THEN** a new `author='user'` revision is created with the current content and `message_id` set to a new system message id; it becomes HEAD

#### Scenario: Reuse paths do not create system messages
- **WHEN** the user sends a message and the seal path resolves to `_reuseLastSealed` or `_reuseCurrentHead`
- **THEN** no system message is created and no `sysMsgCreator` callback is invoked

#### Scenario: Send without artifact — no revision change
- **WHEN** the user sends a message and explicitly excludes the artifact from context
- **THEN** no revision is created or modified and no system message is created

---

### Requirement: AI responses create a new revision anchored to an AI system message
The system SHALL create a new `author='ai'` revision for every AI response that produces artifact content. The revision's `message_id` SHALL be set to a `role: 'system'` message created via the `sysMsgCreator` callback passed to `applyAiRevision`. The AI system message SHALL be created after the assistant message is finalized (via `handleAiArtifactResponse` in sidecarStore).

#### Scenario: AI creates content — revision linked to AI system message
- **WHEN** the AI response finalizes with `artifact_content`
- **THEN** a new `author='ai'` revision is inserted with `message_id` pointing to a new `role: 'system'` message (not the assistant message id)

#### Scenario: `message_id` on all sealed revisions is always a system message
- **WHEN** any sealed revision (`message_id IS NOT NULL`) is queried
- **THEN** the referenced message has `role: 'system'`
