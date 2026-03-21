## ADDED Requirements

### Requirement: appStore exposes setupDefaults for wizard pre-population
The `appStore` SHALL include a `setupDefaults` field of type `{ name: string; avatarPath: string | null } | null`. When `isFirstRun === true`, `init()` SHALL populate this field by invoking the Rust commands `get_os_username` and `get_os_avatar_path` before setting `appPhase` to `'setup'`. On normal runs, `setupDefaults` remains `null`.

#### Scenario: setupDefaults populated on first run
- **WHEN** `init()` determines `isFirstRun === true`
- **THEN** `appStore.setupDefaults.name` is a non-empty string from `invoke('get_os_username')` and `appStore.setupDefaults.avatarPath` is either a valid path string or null from `invoke('get_os_avatar_path')`

#### Scenario: setupDefaults is null on normal run
- **WHEN** `init()` determines `isFirstRun === false`
- **THEN** `appStore.setupDefaults` remains null

#### Scenario: OS command failure does not block setup phase
- **WHEN** `invoke('get_os_username')` throws or returns empty
- **THEN** `appStore.setupDefaults` is set with `name = ''` and `avatarPath = null`, and `appPhase` still transitions to `'setup'`

---

### Requirement: Rust command get_os_username returns the OS login name
The Tauri backend SHALL expose a command `get_os_username` that returns the current OS user's login name as a `String`. It SHALL read from environment variables in order: `USER`, `USERNAME`, `LOGNAME`. If none are set, it SHALL return an empty string.

#### Scenario: Returns USER env var on Unix
- **WHEN** `get_os_username` is invoked and the `USER` env var is set
- **THEN** the command returns the value of `USER`

#### Scenario: Returns USERNAME env var on Windows
- **WHEN** `get_os_username` is invoked and `USER` is not set but `USERNAME` is
- **THEN** the command returns the value of `USERNAME`

#### Scenario: Returns empty string when no env var is available
- **WHEN** `get_os_username` is invoked and none of USER, USERNAME, LOGNAME are set
- **THEN** the command returns an empty string without erroring

---

### Requirement: Rust command get_os_avatar_path returns a path or null
The Tauri backend SHALL expose a command `get_os_avatar_path` that returns `Option<String>`. On macOS, it SHALL scan `~/Library/Application Support/com.apple.AccountPicture.storage/` for a JPEG or PNG file named after the current user and return its absolute path if found. On all other platforms, it SHALL return `None`.

#### Scenario: Returns path on macOS when avatar file exists
- **WHEN** `get_os_avatar_path` is invoked on macOS and a matching JPEG/PNG file is found
- **THEN** the command returns the absolute path to that file as a String

#### Scenario: Returns null on macOS when no avatar file found
- **WHEN** `get_os_avatar_path` is invoked on macOS but no matching file is found
- **THEN** the command returns null (None serialized as null in JSON)

#### Scenario: Returns null on non-macOS platforms
- **WHEN** `get_os_avatar_path` is invoked on Windows or Linux
- **THEN** the command returns null

---

### Requirement: Rust command clear_app_data is available in debug builds only
The Tauri backend SHALL expose a command `clear_app_data` compiled only under `#[cfg(debug_assertions)]`. It SHALL resolve the application data directory using `tauri::path::app_data_dir()`, delete all files and subdirectories within it, and then call `std::process::exit(0)`.

#### Scenario: clear_app_data deletes app data dir contents
- **WHEN** `clear_app_data` is invoked in a debug build
- **THEN** the application data directory and all its contents are deleted before process exit

#### Scenario: clear_app_data is not available in production builds
- **WHEN** the app is built in release mode
- **THEN** no `clear_app_data` command is registered and invoking it returns an error
