## ADDED Requirements

### Requirement: SetupWizard renders three sequential steps
The `SetupWizard` component SHALL render a three-step wizard: (1) Profile, (2) LLM Provider, (3) Done. A step indicator SHALL show the current step and completed steps. The user SHALL only be able to advance forward; there is no back navigation once a step is submitted.

#### Scenario: Wizard opens on step 1
- **WHEN** `SetupPage` mounts and `appStore.appPhase === 'setup'`
- **THEN** Step 1 (Profile) is the active step and steps 2 and 3 are shown as upcoming

#### Scenario: Completing step 1 advances to step 2
- **WHEN** the user submits the Profile step (name is non-empty)
- **THEN** the wizard advances to Step 2 (LLM Provider)

#### Scenario: Completing step 2 advances to step 3
- **WHEN** the user submits the LLM Provider step with valid provider data
- **THEN** the wizard advances to Step 3 (Done) and calls `appStore.onSetupComplete()`

#### Scenario: Step 3 shows transition feedback
- **WHEN** the wizard reaches Step 3
- **THEN** a completion message is displayed and the UI indicates the app is continuing to load

---

### Requirement: Profile step pre-populates name from OS
Step 1 of the wizard SHALL pre-populate the name input with `appStore.setupDefaults.name` if it is available. The user MAY edit the name before continuing.

#### Scenario: Name input is pre-filled
- **WHEN** `appStore.setupDefaults.name` is a non-empty string
- **THEN** the name input in Step 1 is pre-filled with that value on mount

#### Scenario: Empty OS name shows placeholder only
- **WHEN** `appStore.setupDefaults` is null or name is empty
- **THEN** the name input is empty with a placeholder (e.g., "Your name")

#### Scenario: Name is required to continue
- **WHEN** the user attempts to submit Step 1 with an empty name input
- **THEN** an inline validation error is shown and the step does not advance

---

### Requirement: Profile step shows OS avatar or initials fallback
Step 1 SHALL display an avatar preview. If `appStore.setupDefaults.avatarPath` is non-null and the file is readable, it SHALL render the image. Otherwise, it SHALL render the user's initials derived from the name input.

#### Scenario: Avatar image shown when path available
- **WHEN** `appStore.setupDefaults.avatarPath` is a valid file path
- **THEN** an `<img>` using the `asset://` Tauri protocol renders the avatar in the profile step

#### Scenario: Initials shown when avatar unavailable
- **WHEN** `appStore.setupDefaults.avatarPath` is null
- **THEN** a circle with the first letter(s) of the entered name is shown instead

---

### Requirement: Profile step persists user_profile to app_settings
When the user submits Step 1, the wizard SHALL call a store action that writes `{ name, avatarPath }` as JSON to `app_settings` under key `user_profile` via the SQLite DB before advancing.

#### Scenario: user_profile is saved on step 1 submit
- **WHEN** the user submits Step 1 with a valid name
- **THEN** `app_settings` contains a row with `key = 'user_profile'` and `value = JSON.stringify({ name, avatarPath })`

---

### Requirement: LLM Provider step has provider type selector, URL, and API key inputs
Step 2 SHALL provide:
- A provider type selector with at minimum `ollama`, `openai`, and `custom` options
- A base URL text input (required)
- An optional API key text input (hidden for `ollama`, shown for `openai` and `custom`)
- A "Test Connection" button that sends `GET {baseUrl}/models` with the API key header if provided
- A "Continue" button that becomes enabled when the base URL is non-empty

#### Scenario: Ollama hides the API key field
- **WHEN** the user selects `ollama` as the provider type
- **THEN** the API key input is not rendered

#### Scenario: OpenAI and custom show the API key field
- **WHEN** the user selects `openai` or `custom` as the provider type
- **THEN** the API key input is rendered and accepts text

#### Scenario: Test Connection shows success on 200
- **WHEN** the user clicks "Test Connection" and `GET {baseUrl}/models` returns HTTP 200
- **THEN** a success indicator is shown next to the button

#### Scenario: Test Connection shows error on non-200 or network failure
- **WHEN** the user clicks "Test Connection" and the request fails or returns non-200
- **THEN** an inline error message is shown with the failure reason

#### Scenario: Continue is enabled without testing
- **WHEN** the base URL input is non-empty
- **THEN** the "Continue" button is enabled regardless of whether Test Connection was clicked

---

### Requirement: LLM Provider step persists provider to llm_providers table
When the user submits Step 2, the wizard SHALL insert a new row into `llm_providers` with the entered values. The provider SHALL be set as `is_default = true` (it is the first and only provider at this point).

#### Scenario: Provider row created on step 2 submit
- **WHEN** the user submits Step 2 with a non-empty base URL
- **THEN** `llm_providers` contains exactly one row with `base_url` matching the entered value and `is_default = true`

---

### Requirement: Dev-mode reset button clears all app data
In development builds (`__TAURI_DEV__` / `debug_assertions`), `SetupPage` SHALL render a "Reset App Data" button in the footer. Clicking it SHALL invoke the Rust command `clear_app_data`, which deletes the application data directory and exits the process.

#### Scenario: Reset button is visible in dev builds only
- **WHEN** the app is running in development mode
- **THEN** a "Reset App Data" button is visible in the setup wizard footer

#### Scenario: Reset button is absent in production builds
- **WHEN** the app is running as a production build
- **THEN** no "Reset App Data" button is present in the setup UI

#### Scenario: Reset button deletes app data and exits
- **WHEN** the user clicks "Reset App Data" and confirms the action
- **THEN** `invoke('clear_app_data')` is called, the application data directory is deleted, and the process exits (dev watcher restarts the app clean)
