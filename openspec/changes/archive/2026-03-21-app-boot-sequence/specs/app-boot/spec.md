## ADDED Requirements

### Requirement: AppPhase enum drives all boot state transitions
The system SHALL define a typed `AppPhase` union (`'booting' | 'setup' | 'loading' | 'ready' | 'error'`) as the single source of truth for application initialization state. All window visibility, route navigation, and loading UI decisions SHALL be derived from this value in `appStore`.

#### Scenario: Phase starts as booting
- **WHEN** the React app mounts for the first time
- **THEN** `appStore.appPhase === 'booting'`

#### Scenario: First-run transitions booting → setup
- **WHEN** `appStore.init()` completes the DB check and finds zero LLM providers
- **THEN** `appStore.appPhase` transitions to `'setup'`

#### Scenario: Normal-run transitions booting → loading
- **WHEN** `appStore.init()` completes the DB check and finds at least one LLM provider
- **THEN** `appStore.appPhase` transitions to `'loading'`

#### Scenario: Loading transitions to ready when all startup steps pass
- **WHEN** all `startupSteps` have `status === 'done'`
- **THEN** `appStore.appPhase` transitions to `'ready'`

#### Scenario: Any startup step failure transitions to error
- **WHEN** any `startupStep` transitions to `status === 'error'`
- **THEN** `appStore.appPhase` transitions to `'error'` and `appStore.bootError` contains the error message

#### Scenario: Setup completion with ready sidecar transitions to ready
- **WHEN** `appStore.onSetupComplete()` is called AND `appStore.sidcarStatus === 'ready'`
- **THEN** `appStore.appPhase` transitions to `'ready'`

#### Scenario: Setup completion with starting sidecar transitions to loading
- **WHEN** `appStore.onSetupComplete()` is called AND `appStore.sidcarStatus !== 'ready'`
- **THEN** `appStore.appPhase` transitions to `'loading'`

---

### Requirement: appStore.init() is the sole boot coordinator
The `appStore.init()` action SHALL be called exactly once from `App.tsx` via `useEffect(fn, [])`. It SHALL perform in order: (1) invoke the Tauri `sidecar_init` command to receive the sidecar URL, (2) begin background health-check polling, (3) query the DB for LLM provider count, (4) set `appPhase` to `'setup'` or `'loading'` based on the result.

#### Scenario: init is called once on mount
- **WHEN** `App` component mounts
- **THEN** `appStore.init()` is called exactly once and never called again during the session

#### Scenario: Sidecar invoke fires before DB check completes
- **WHEN** `appStore.init()` begins
- **THEN** `invoke('sidecar_init')` is called before awaiting the DB query, so sidecar startup and DB check run concurrently

#### Scenario: DB query determines phase
- **WHEN** the DB query returns count = 0
- **THEN** `appPhase` is set to `'setup'` without waiting for the sidecar health check

---

### Requirement: Startup steps model tracks named async boot tasks
The `appStore` SHALL maintain a `startupSteps` array of `StartupStep` objects, each with `id`, `label`, `status` (`'pending' | 'loading' | 'done' | 'error'`), and optional `error` string. On normal boot, this array SHALL contain at minimum a sidecar health-check step. Steps SHALL be updated in place as their async work progresses.

#### Scenario: Sidecar step shows loading while polling
- **WHEN** the sidecar health-check is in progress
- **THEN** `startupSteps` contains a step with `id === 'sidecar'` and `status === 'loading'`

#### Scenario: Sidecar step completes on first 200 response
- **WHEN** `GET {sidcarUrl}/health` returns HTTP 200
- **THEN** the sidecar step transitions to `status === 'done'` and `appStore.sidcarStatus` becomes `'ready'`

#### Scenario: Sidecar step errors after timeout
- **WHEN** 15 seconds elapse without a 200 response from the health endpoint
- **THEN** the sidecar step transitions to `status === 'error'` with an error message, and `appStore.appPhase` becomes `'error'`

#### Scenario: Slow sidecar shows warning message
- **WHEN** 5 seconds elapse without a 200 response
- **THEN** the sidecar step's label updates to indicate the startup is taking longer than expected

---

### Requirement: Health-check polls the sidecar /health endpoint
The system SHALL poll `GET {sidcarUrl}/health` every 500ms after receiving the sidecar URL from `invoke('sidecar_init')`. The poll SHALL stop on the first 200 response (success) or after 15 seconds (timeout/error).

#### Scenario: Poll interval is 500ms
- **WHEN** the health check is running
- **THEN** requests are sent at most every 500ms

#### Scenario: Non-200 response does not stop polling
- **WHEN** a health-check request returns a non-200 status or network error
- **THEN** polling continues until timeout

#### Scenario: Poll stops immediately on success
- **WHEN** a health-check request returns HTTP 200
- **THEN** no further requests are sent

---

### Requirement: Boot error shows in LoadingPage with retry action
When `appStore.appPhase === 'error'`, the `LoadingPage` component SHALL display the `bootError` message and a Retry button. Clicking Retry SHALL call `appStore.retry()`, which resets `appPhase` to `'loading'` and re-runs the failed startup steps.

#### Scenario: Error message is displayed
- **WHEN** `appPhase === 'error'`
- **THEN** `LoadingPage` renders the contents of `bootError` to the user

#### Scenario: Retry resets phase and restarts steps
- **WHEN** the user clicks Retry
- **THEN** `appStore.retry()` is called, `appPhase` returns to `'loading'`, and the failed startup steps are re-attempted

---

### Requirement: First-run detection uses LLM provider count
The system SHALL determine first-run state by querying the `llm_providers` table. If the count is zero, the app is in first-run state. The `app_settings` table SHALL NOT be used as a first-run signal (it is always seeded on migration).

#### Scenario: Empty llm_providers means first run
- **WHEN** `listLlmProviders()` returns an empty array
- **THEN** `appStore.isFirstRun === true` and `appPhase` transitions to `'setup'`

#### Scenario: Non-empty llm_providers means normal run
- **WHEN** `listLlmProviders()` returns one or more providers
- **THEN** `appStore.isFirstRun === false` and `appPhase` transitions to `'loading'`

---

### Requirement: Splash enforces a minimum display duration
The splash window SHALL remain visible for at least 300ms after it opens, even if the DB check completes faster. This prevents a flash-and-gone appearance that would feel like a visual glitch.

#### Scenario: Minimum display time is honored
- **WHEN** DB check completes in under 300ms
- **THEN** the splash remains visible until 300ms have elapsed since mount before the phase transition proceeds
