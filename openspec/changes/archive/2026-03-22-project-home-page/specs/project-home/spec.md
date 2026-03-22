## ADDED Requirements

### Requirement: Project home page renders a two-column layout
The system SHALL render the project home page at `/projects/:projectId` with a max-width-constrained two-column layout: a flexible-width left column (task input + conversation list) and a fixed 320px right sidebar (artifact card, folder card, files card, AI config card). The entire layout SHALL be horizontally centered with a maximum width of `max-w-5xl` to prevent edge-to-edge stretching on wide displays.

#### Scenario: Layout renders when project data is loaded

- **WHEN** the user navigates to `/projects/:projectId` and the route loader completes
- **THEN** the page renders with a project header, left column, and right sidebar visible

#### Scenario: Layout is constrained on wide displays

- **WHEN** the viewport is wider than 1024px
- **THEN** the content area does not exceed `max-w-5xl` and is horizontally centered

---

### Requirement: Project home page has a lightweight header with inline rename
The system SHALL render a header at the top of the project home page containing: a "← Projects" back link that navigates to `/`, the active project name as a clickable heading, and (when in edit mode) an inline text input with ✓ (apply) and × (discard) icon buttons.

#### Scenario: Back link navigates to project list

- **WHEN** the user clicks "← Projects"
- **THEN** the router navigates to `/`

#### Scenario: Clicking project name enters rename edit mode

- **WHEN** the user clicks the project name heading
- **THEN** the heading is replaced by an inline text input pre-filled with the current project name, with ✓ and × buttons visible

#### Scenario: Pressing Enter applies the rename

- **WHEN** the user is in rename edit mode and presses Enter
- **THEN** `projectStore.rename(id, newName)` is called and the heading reverts to display mode showing the new name

#### Scenario: Pressing Escape discards the rename

- **WHEN** the user is in rename edit mode and presses Escape
- **THEN** the input is dismissed without calling rename, and the heading shows the original project name

#### Scenario: Clicking ✓ applies the rename

- **WHEN** the user is in rename edit mode and clicks the ✓ button
- **THEN** `projectStore.rename(id, newName)` is called and display mode is restored

#### Scenario: Clicking × discards the rename

- **WHEN** the user is in rename edit mode and clicks the × button
- **THEN** the input is dismissed without calling rename

---

### Requirement: New task textarea creates a conversation and navigates to it
The system SHALL render an auto-growing textarea on the project home page with placeholder text "What would you like to work on?". Submitting the input SHALL create a new conversation with the entered text as an initial message context and navigate the user to `/projects/:projectId/chats/:chatId`. The Send button SHALL be positioned inside the textarea box (bottom-right) and SHALL be disabled when the textarea is empty.

#### Scenario: Textarea grows with content up to maximum height

- **WHEN** the user types multiple lines of text
- **THEN** the textarea grows to accommodate up to approximately 5 lines, then becomes scrollable

#### Scenario: Cmd+Enter or Ctrl+Enter submits

- **WHEN** the user presses Cmd+Enter (macOS) or Ctrl+Enter (Windows/Linux) with non-empty input
- **THEN** a new conversation is created and the user is navigated to the chat page

#### Scenario: Enter key inserts a newline, does not submit

- **WHEN** the user presses Enter (without modifier key)
- **THEN** a newline is inserted into the textarea

#### Scenario: Send button is disabled when textarea is empty

- **WHEN** the textarea contains only whitespace or is empty
- **THEN** the Send button is disabled and clicking it has no effect

#### Scenario: Submit creates conversation and navigates

- **WHEN** the user submits with non-empty text
- **THEN** `conversationStore.create(projectId)` is called, and the router navigates to `/projects/:projectId/chats/:chatId`

---

### Requirement: Conversation list shows chats with hover-reveal actions
The system SHALL render a list of conversations for the active project, ordered by `updated_at` descending. Each row SHALL display the conversation title (or "Untitled" if null) and a relative timestamp (e.g., "2 hours ago"). A `...` action menu SHALL be revealed on row hover, containing Rename and Delete actions.

#### Scenario: Conversation list renders in reverse chronological order

- **WHEN** the project has conversations
- **THEN** they are listed with the most recently updated first

#### Scenario: Null title renders as "Untitled"

- **WHEN** a conversation has no title
- **THEN** the row displays "Untitled" in place of the title

#### Scenario: Action menu is hidden until row is hovered

- **WHEN** the user is not hovering a conversation row
- **THEN** the `...` menu trigger is not visible

#### Scenario: Action menu appears on hover

- **WHEN** the user hovers a conversation row
- **THEN** the `...` menu trigger becomes visible

#### Scenario: Rename action triggers inline title edit

- **WHEN** the user clicks Rename from the row action menu
- **THEN** the title text is replaced by an inline input; submitting calls `conversationStore.rename(id, newTitle)` and the menu closes

#### Scenario: Delete action triggers confirmation dialog

- **WHEN** the user clicks Delete from the row action menu
- **THEN** an AlertDialog appears asking for confirmation

#### Scenario: Confirming delete removes the conversation

- **WHEN** the user confirms deletion
- **THEN** `conversationStore.delete(id)` is called and the row is removed from the list

#### Scenario: Clicking a conversation row navigates to the chat

- **WHEN** the user clicks anywhere on a conversation row (not the action menu)
- **THEN** the router navigates to `/projects/:projectId/chats/:chatId`

---

### Requirement: Empty state shown when project has no conversations
The system SHALL display an empty state in the conversation list area when the project has no conversations. The empty state SHALL contain a brief instructional message directing the user to the task input above.

#### Scenario: Empty state renders when conversation list is empty

- **WHEN** the project has no conversations
- **THEN** an empty state component is displayed with instructional text (e.g., "Start a task above to create your first chat")

---

### Requirement: Artifacts card shows project artifact summary
The system SHALL render an artifacts card in the right sidebar showing: the total count of artifacts for the project, the 3 most recently updated artifact titles, and a "Show all" button. Clicking "Show all" SHALL open a Sheet (slide-over panel) listing all project artifacts.

#### Scenario: Artifact count is shown

- **WHEN** the project has artifacts across any of its conversations
- **THEN** the card header shows the correct total count

#### Scenario: Three most recent artifacts are listed

- **WHEN** the project has more than 3 artifacts
- **THEN** only the 3 most recently updated are shown in the card preview

#### Scenario: "Show all" opens a Sheet

- **WHEN** the user clicks "Show all"
- **THEN** a Sheet panel slides in showing all project artifacts in reverse chronological order

#### Scenario: Empty state when no artifacts exist

- **WHEN** the project has no artifacts
- **THEN** the card shows a message indicating no documents have been created yet

---

### Requirement: Folder card allows attaching or changing the project folder
The system SHALL render a folder card showing the current project folder path (if set) or a call-to-action to attach one. Clicking the attach/change button SHALL open the OS folder picker dialog and update `project.folder_path` on selection.

#### Scenario: Attached folder path is displayed

- **WHEN** the project has a `folder_path` set
- **THEN** the card displays the path and a "Change folder" button

#### Scenario: No folder shows attach CTA

- **WHEN** the project has no `folder_path`
- **THEN** the card shows an "Attach folder" button as the primary action

#### Scenario: Selecting a folder updates the project

- **WHEN** the user selects a folder via the OS dialog
- **THEN** `projectStore.update(id, { folder_path })` is called and the card reflects the new path

---

### Requirement: Files card is a stub with upload UI only
The system SHALL render a files card in the right sidebar with an "Upload file" button and an empty state message. The button SHALL be present and visually functional but SHALL NOT trigger any file handling logic. This card is a stub reserved for future implementation.

#### Scenario: Upload button is visible but non-functional

- **WHEN** the files card is rendered
- **THEN** an "Upload file" button is visible; clicking it has no effect beyond rendering the button

#### Scenario: Empty state is shown

- **WHEN** the files card is rendered
- **THEN** a message such as "No files uploaded yet" is displayed below the button
