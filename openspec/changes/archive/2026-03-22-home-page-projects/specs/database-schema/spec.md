# Spec: Database Schema (delta)

## MODIFIED Requirements

### Requirement: Projects table stores project records

The system SHALL create a `projects` table with UUID primary key, nullable folder path, and timestamps (Unix ms). The `name` column SHALL NOT have a UNIQUE constraint — duplicate names are permitted. These properties are defined in the single initial migration (v1) in `db.rs`; no incremental migration is required.

#### Scenario: Folder path may be null

- **WHEN** a project is inserted with no folder path
- **THEN** the row is stored successfully with `folder_path` as NULL

#### Scenario: Duplicate names are permitted

- **WHEN** two projects with the same name are inserted
- **THEN** both inserts succeed without error
