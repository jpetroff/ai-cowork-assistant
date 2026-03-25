# Spec: Artifact Revision System

## Requirements

### Requirement: Each artifact has a HEAD revision that holds the current content
The system SHALL maintain a `current_revision_id` pointer on every artifact that references the most recent `artifact_revisions` row. The editor SHALL always load content from the HEAD revision.

#### Scenario: HEAD revision content loads in editor
- **WHEN** the user navigates to a conversation and an artifact is active
- **THEN** the editor renders the content of the revision identified by `artifact.current_revision_id`

#### Scenario: No HEAD revision triggers first revision creation
- **WHEN** an artifact has no revisions (newly created, `current_revision_id` is null)
- **THEN** an empty `author='user'` revision is created, `current_revision_id` is set, and the editor renders blank

---

### Requirement: In-place editing is gated on HEAD author and send status
The system SHALL allow auto-save to update the HEAD revision in-place ONLY when `HEAD.author == 'user'` AND `HEAD.message_id == null`. If either condition is false when the user begins editing, a new `author='user'` revision SHALL be created (copying HEAD content) before the first save.

#### Scenario: User edits unsent user-authored HEAD — in-place save
- **WHEN** `HEAD.author == 'user'` AND `HEAD.message_id == null` AND the user changes content
- **THEN** `updateRevisionContent(HEAD.id, newContent)` is called and no new revision is created

#### Scenario: User edits AI-authored HEAD — copy-on-write
- **WHEN** `HEAD.author == 'ai'` AND the user begins editing
- **THEN** a new revision is created with `author='user'`, `message_id=null`, `content=HEAD.content`, it becomes the new HEAD, and subsequent auto-saves update that new revision

#### Scenario: User edits a sent HEAD — copy-on-write
- **WHEN** `HEAD.message_id != null` AND the user begins editing
- **THEN** a new revision is created with `author='user'`, `message_id=null`, `content=HEAD.content`, it becomes the new HEAD

---

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

---

### Requirement: Users can load any historical revision into the editor
The system SHALL allow users to select any revision from the revision history picker. Loading a non-HEAD revision SHALL NOT immediately create a new revision — the copy-on-write gate applies when the user first attempts to edit.

#### Scenario: User loads a historical revision — editor shows that content
- **WHEN** the user selects a revision from the history picker
- **THEN** the editor renders that revision's content; `current_revision_id` is NOT changed

#### Scenario: User edits a loaded non-HEAD revision — copy-on-write
- **WHEN** the user has loaded a non-HEAD revision and begins editing
- **THEN** the in-place gate fails (this is not HEAD), a new `author='user'` revision is created with that revision's content as the starting point, and it becomes the new HEAD

---

### Requirement: Revisions with a message ID are displayed in the chat thread
The system SHALL render revision cards inline in the conversation thread for all revisions where `message_id IS NOT NULL`. Revisions with `message_id = null` (drafts) SHALL NOT appear in the thread.

#### Scenario: AI revision card appears after AI message
- **WHEN** the chat thread renders and a revision with `message_id = AI_MSG` exists
- **THEN** a `DocumentCard` is rendered immediately after the linked AI message showing the document title and a "load" affordance

#### Scenario: User-send revision card appears after user message
- **WHEN** the chat thread renders and a revision with `message_id = USER_MSG` exists
- **THEN** a `DocumentCard` is rendered immediately after the linked user message

#### Scenario: Draft revision is not shown in thread
- **WHEN** a revision has `message_id = null`
- **THEN** no card appears in the chat thread for that revision
