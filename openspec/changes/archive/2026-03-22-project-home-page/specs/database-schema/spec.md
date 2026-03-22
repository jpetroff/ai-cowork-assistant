## ADDED Requirements

### Requirement: Artifact repository supports project-scoped queries
The system SHALL provide a `listArtifactsByProject(projectId, limit?)` function in the artifacts repository that retrieves artifacts belonging to any conversation within the given project. The query SHALL JOIN `artifacts` through `conversations` on `project_id`, ordering results by `artifacts.updated_at` DESC. An optional `limit` parameter restricts the result count.

#### Scenario: Returns artifacts across all conversations in a project

- **WHEN** `listArtifactsByProject(projectId)` is called for a project with conversations that each have artifacts
- **THEN** all artifacts from all conversations in that project are returned, ordered by `updated_at` DESC

#### Scenario: Limit parameter restricts result count

- **WHEN** `listArtifactsByProject(projectId, 3)` is called for a project with more than 3 artifacts
- **THEN** exactly 3 artifacts are returned (the 3 most recently updated)

#### Scenario: Returns empty array for project with no artifacts

- **WHEN** `listArtifactsByProject(projectId)` is called for a project with no artifacts
- **THEN** an empty array is returned without error
