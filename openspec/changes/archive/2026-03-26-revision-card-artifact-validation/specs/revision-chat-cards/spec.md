## MODIFIED Requirements

### Requirement: Every sealed revision has a corresponding system message in the chat thread
The system SHALL create a `role: 'system'` message in the `messages` table whenever an artifact revision is sealed (either by user send or AI response). This system message SHALL be the revision's `message_id` anchor. The content SHALL be `"<author> created artifact revision"` where `<author>` is `"user"` or `"ai"`. The `metadata` column SHALL contain a JSON object `{ "artifactId": "<id>", "revisionId": "<id>", "author": "<author>" }`.

#### Scenario: User sends with changed content — system message created
- **WHEN** the user sends a message and the artifact content has changed since the last seal
- **THEN** a `role: 'system'` message is inserted into the `messages` table with `metadata.revisionId` pointing to the newly sealed revision, `metadata.artifactId` set to the artifact's ID, and the revision's `message_id` is set to this system message's id

#### Scenario: User sends without changes — no system message created
- **WHEN** the user sends a message and the artifact content has NOT changed since the last seal
- **THEN** no new system message is created and no new revision is created

#### Scenario: AI responds with artifact content — AI system message created
- **WHEN** the AI response finalizes with `artifact_content`
- **THEN** a `role: 'system'` message is inserted with `metadata.author: 'ai'`, `metadata.artifactId` set to the artifact's ID, and `metadata.revisionId` pointing to the new AI revision

#### Scenario: AI responds without artifact content — no system message created
- **WHEN** the AI response finalizes without `artifact_content`
- **THEN** no system message is created

---

### Requirement: System message appears in the chat thread as an artifact revision card
The system SHALL render a compact two-line card in the chat thread for every `role: 'system'` message that has a `metadata.revisionId`. The card SHALL use `getArtifactRevisionMeta(meta.artifactId, { revisionId: meta.revisionId })` to resolve display data. The card SHALL display:
- Line 1: the artifact title resolved via `getArtifactRevisionMeta`
- Line 2: author label ("user" or "AI") and formatted timestamp

#### Scenario: User revision card rendered for currently loaded artifact
- **WHEN** `MessageList` renders a `role: 'system'` message with `metadata.author: 'user'` and `metadata.artifactId` matching the loaded artifact
- **THEN** an `ArtifactRevisionCard` is shown with the correct artifact title and a "user" author label

#### Scenario: AI revision card rendered for currently loaded artifact
- **WHEN** `MessageList` renders a `role: 'system'` message with `metadata.author: 'ai'` and `metadata.artifactId` matching the loaded artifact
- **THEN** an `ArtifactRevisionCard` is shown with the correct artifact title and an "AI" author label

#### Scenario: System message without revisionId metadata is not rendered as a card
- **WHEN** a `role: 'system'` message has no `metadata` or no `metadata.revisionId`
- **THEN** it is not rendered in the thread (filtered out)

#### Scenario: Card for a revision whose artifact is not currently loaded returns null
- **WHEN** `getArtifactRevisionMeta` returns `null` (e.g. `meta.artifactId` is absent or does not match the loaded artifact)
- **THEN** the `ArtifactRevisionCard` renders nothing (`null`)

---

### Requirement: Artifact revision card has a Load button to restore the revision into the editor
The `ArtifactRevisionCard` SHALL include a Load button that calls `requestRevisionLoad(revisionId)`. The button SHALL display "Loaded" and be disabled when the revision is currently loaded in the editor.

#### Scenario: Load button restores revision into editor
- **WHEN** the user clicks Load on a revision card
- **THEN** `requestRevisionLoad(metadata.revisionId)` is called and the editor renders that revision's content without changing HEAD
