## ADDED Requirements

### Requirement: Project store supports updating the folder path
The system SHALL expose an `update(id, data)` action in `projectStore` that persists partial project field updates to SQLite and reflects them in the store's `projects` array. This is used by the folder card to set `folder_path`.

#### Scenario: Folder path update persists and updates store

- **WHEN** `projectStore.update(id, { folder_path })` is called
- **THEN** the `projects` table row is updated in SQLite and `store.projects` reflects the new `folder_path` for that project

#### Scenario: DB failure on update shows error notification

- **WHEN** the DB update fails
- **THEN** the store is not modified and an error notification is pushed to `notificationStore`
