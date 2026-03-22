# Spec: Project AI Config

## Requirements

### Requirement: Per-project AI configuration is persisted in app_settings
The system SHALL store per-project AI configuration as a JSON value in the `app_settings` table using the key pattern `project:{projectId}:ai_config`. The JSON value SHALL have the shape `{ provider_id: string | null, model: string | null, embedding_model: string | null }`. When no value exists for a project, the system SHALL treat the config as `{ provider_id: null, model: null, embedding_model: null }`.

#### Scenario: Config is written on selection change

- **WHEN** the user selects a provider, model, or embedding model in the AI config card
- **THEN** the updated config is serialized to JSON and written to `app_settings` under the key `project:{projectId}:ai_config`

#### Scenario: Missing key defaults to null fields

- **WHEN** no `app_settings` row exists for `project:{projectId}:ai_config`
- **THEN** the store returns `{ provider_id: null, model: null, embedding_model: null }` without error

#### Scenario: Corrupted JSON defaults gracefully

- **WHEN** the stored value is not valid JSON
- **THEN** the store returns the null-field default and overwrites the corrupted value on next save

---

### Requirement: AI config card renders provider, model, and embedding model selects
The system SHALL render an AI config card in the project home right sidebar with three Select components: LLM Provider, LLM Model, and Embedding Model. When no providers are configured, all selects SHALL be disabled and a "Configure in Settings →" button SHALL be shown as a call-to-action.

#### Scenario: Selects are disabled when no providers are configured

- **WHEN** `llmProviderStore.providers` is empty
- **THEN** all three selects are disabled and the "Configure in Settings →" button is visible

#### Scenario: Provider select shows all configured providers

- **WHEN** `llmProviderStore.providers` has entries
- **THEN** the provider select lists all provider names as options

#### Scenario: Model select populates after provider selection

- **WHEN** the user selects a provider
- **THEN** `llmProviderStore.fetchModels(providerId)` is called and the model select is populated with the returned model list

#### Scenario: Embedding model select is a free-text stub

- **WHEN** the AI config card is rendered
- **THEN** the embedding model select is present; its options are empty or stubbed and it accepts any string value from the user (implementation deferred)

#### Scenario: Current config values are pre-selected

- **WHEN** the project has a saved AI config
- **THEN** the provider, model, and embedding model selects show the saved values as their current selection

---

### Requirement: LLM provider store loads and caches provider and model data
The system SHALL maintain a `llmProviderStore` that loads all LLM providers from the `llm_providers` table and caches model lists fetched from each provider's `/models` endpoint. Model lists SHALL be cached per session (not persisted to DB) and refreshed only on explicit `fetchModels(providerId)` call.

#### Scenario: loadAll populates the providers list

- **WHEN** `llmProviderStore.loadAll()` is called
- **THEN** the store's `providers` array is populated from the `llm_providers` table

#### Scenario: fetchModels caches the result

- **WHEN** `llmProviderStore.fetchModels(providerId)` completes successfully
- **THEN** the model list is stored in `store.modelsByProvider[providerId]` and subsequent calls return the cached result without a network request

#### Scenario: fetchModels failure is non-fatal

- **WHEN** the provider endpoint is unreachable during `fetchModels`
- **THEN** the store records an empty model list for that provider and no error notification is shown (the select will be empty but not broken)
