# Dependency Upgrade Maintenance

This note explains how to keep the project foundation up to date:

- Frontend: Bun, Vite, React, TypeScript, Tailwind, shadcn/Base UI packages.
- Desktop shell: Tauri v2, Rust crates, Tauri plugins.
- Python sidecar: FastAPI, LlamaIndex, and supporting Python packages.

The goal is to upgrade deliberately, keep builds reproducible, catch known
vulnerabilities early, and avoid rare "giant upgrade" sessions that are hard to
debug.

## Manifests and Lock Files

Dependency management has two layers:

1. A manifest describes what versions are allowed.
2. A lock file records the exact versions that were actually resolved.

In this project:

| Area | Manifest | Lock file | Current state |
| --- | --- | --- | --- |
| Frontend | `package.json` | `bun.lock` | In place |
| Rust/Tauri | `src-tauri/Cargo.toml` | `src-tauri/Cargo.lock` | In place |
| Python sidecar | Future `src-python/pyproject.toml` | Future `src-python/uv.lock` | Not in place yet |
| Python sidecar today | `src-python/requirements.txt` | None | Unpinned / less reproducible |

Think of the manifest as the project's "allowed range" and the lock file as the
project's "known working receipt".

For example, `package.json` can say that `vite` is allowed within a range. The
`bun.lock` file then pins the exact `vite` version, plus the exact versions of
Vite's transitive dependencies.

That means:

- `bun install` installs the exact dependency set from `bun.lock`.
- `bun install` does not automatically upgrade every dependency to the newest
  available version.
- Upgrading means intentionally changing the manifest and/or lock file.
- After every upgrade, run checks and tests before trusting the new dependency
  set.

The same idea applies to Rust:

- `Cargo.toml` describes dependency requirements.
- `Cargo.lock` pins the exact resolved crate versions.
- `cargo check --locked` verifies the project builds without changing the lock
  file.
- `cargo update` intentionally updates `Cargo.lock`.

The recommended future Python setup should follow the same pattern:

- `pyproject.toml` describes Python dependencies.
- `uv.lock` pins exact resolved versions.
- `uv sync --locked` installs exactly what is already locked.
- `uv lock --upgrade` intentionally upgrades the lock file.

## Current Findings

These findings came from a non-mutating dependency investigation of the current
repo.

- Frontend dependencies are managed by `package.json` and `bun.lock`.
- Rust/Tauri dependencies are managed by `src-tauri/Cargo.toml` and
  `src-tauri/Cargo.lock`.
- Python currently uses `src-python/requirements.txt`.
- There is no Python `pyproject.toml` or `uv.lock` yet.
- `src-python/requirements.txt` contains broad, mostly unpinned requirements,
  so Python installs can resolve different package versions over time.
- `bun outdated` showed newer versions for `vite`, `@vitejs/plugin-react`,
  `typescript`, and `@types/node`.
- `bun audit` reported JavaScript advisories, including advisories affecting
  the current Vite 7.3.1 dependency set.
- `cargo audit` is not installed locally.
- A local Python audit with `uvx pip-audit` did not complete successfully, so
  Python vulnerability scanning should be made reproducible in CI after the
  Python sidecar has a lock file.

## Frontend: Bun, Vite, React, TypeScript

### Install the Current Locked Dependencies

Use this when you want to reproduce the dependency set that is already committed:

```bash
bun install
```

This reads `package.json` and `bun.lock`. If `bun.lock` is already up to date,
it installs those exact versions. It does not mean "upgrade everything".

### Check What Is Outdated

Use this to see which packages have newer versions available:

```bash
bun outdated
```

The output usually has three important columns:

- `Current`: the version installed through the lock file.
- `Update`: the newest version that fits the current `package.json` range.
- `Latest`: the newest published version, even if it is outside the current
  range.

If `Update` and `Latest` differ, the latest version is probably a larger upgrade
that may need a migration guide.

### Upgrade Compatible Versions

Use this for normal patch/minor updates that fit the existing version ranges:

```bash
bun update
```

This updates `bun.lock`. It may not change `package.json` if the existing ranges
already allow the newer versions.

### Upgrade One Package

Use this when you want to limit the change to one package:

```bash
bun update vite
```

This is useful when fixing a vulnerability or testing one dependency at a time.

### Upgrade Beyond the Current Version Range

Use this for larger upgrades, such as Vite 7 to Vite 8:

```bash
bun update --latest vite @vitejs/plugin-react
```

This can change both `package.json` and `bun.lock`. Treat this as a planned
upgrade, not a routine maintenance command.

Before doing a Vite major upgrade, read the Vite migration guide. Before doing a
React major upgrade, read the React upgrade guide and use official codemods when
they apply.

### Audit JavaScript Dependencies

Use this to check installed packages for known npm advisories:

```bash
bun audit
```

For CI, start with high-severity failures:

```bash
bun audit --audit-level=high
```

Security findings should be reviewed before routine upgrade work. If an advisory
affects a dev server dependency like Vite, still take it seriously because local
development servers can expose files or machine data if misconfigured or
reachable from the wrong network.

## Rust and Tauri

Tauri v2 has dependencies on both sides of the app:

- JavaScript packages such as `@tauri-apps/api` and Tauri plugin packages.
- Rust crates such as `tauri`, `tauri-build`, and `tauri-plugin-*`.

Tauri's official guidance is to keep related JavaScript packages and Rust crates
synchronized. This matters more for Tauri than for ordinary frontend-only
packages because the frontend API talks to Rust plugin code.

### Check the Rust Build Without Changing the Lock File

Run this from the repo root:

```bash
cargo check --manifest-path src-tauri/Cargo.toml --locked
```

The `--locked` flag is important. It tells Cargo:

- Use the exact dependency versions from `Cargo.lock`.
- Fail if Cargo would need to change the lock file.

This is the right behavior for CI because CI should verify the committed
dependency set, not silently create a new one.

### Update the Rust Lock File

When you intentionally want to update Rust dependencies, run:

```bash
cd src-tauri
cargo update
```

This updates `src-tauri/Cargo.lock` to newer compatible crate versions allowed
by `Cargo.toml`.

### Update One Rust Package

To keep the change smaller, target one package:

```bash
cd src-tauri
cargo update -p tauri
```

This performs a conservative update for `tauri`. Cargo may also update
transitive dependencies when required.

### Tauri-Specific Upgrade Rule

For Tauri upgrades, do not update only one side.

When updating Tauri itself or Tauri plugins, check both:

- `package.json`
- `src-tauri/Cargo.toml`

Examples of package pairs that need attention:

- `@tauri-apps/api` and the Rust `tauri` crate.
- `@tauri-apps/cli` and Tauri Rust crates.
- `@tauri-apps/plugin-fs` and `tauri-plugin-fs`.
- `@tauri-apps/plugin-http` and `tauri-plugin-http`.
- `@tauri-apps/plugin-sql` and `tauri-plugin-sql`.

After a Tauri upgrade, also review security settings:

- `src-tauri/tauri.conf.json`
- `src-tauri/capabilities/*.json`

This project currently has `csp: null` and broad filesystem permissions. Those
settings are not dependency versions, but they are part of the same maintenance
surface because dependency upgrades can introduce new plugin permissions or new
security recommendations.

### Rust Vulnerability Checks

The local machine currently does not have `cargo audit` installed. CI should add
one of these checks:

```bash
cargo audit
```

or:

```bash
cargo deny check advisories
```

Both tools scan the Rust dependency graph for known advisories. `cargo-deny` can
also enforce license, source, and duplicate-version policies if the project wants
that later.

## Python Sidecar and uv

The current Python workflow is:

```bash
cd src-python
uv pip install -r requirements.txt
```

This installs packages listed in `requirements.txt`. However, most entries in
that file are not pinned to exact versions. That means the same command can
resolve different versions on different days.

For example, a line like this:

```text
fastapi
```

means "install some acceptable current FastAPI version." It does not record the
exact version that worked last time.

A line like this is more constrained:

```text
pydantic>=2
```

It requires Pydantic 2 or newer, but still allows many possible versions.

### Recommended Future Python Flow

The recommended future setup is to move Python dependency definitions to:

```text
src-python/pyproject.toml
```

Then use uv to create and maintain:

```text
src-python/uv.lock
```

Once that exists, a normal install should be:

```bash
cd src-python
uv sync
```

In CI, prefer:

```bash
cd src-python
uv sync --locked
```

The `--locked` flag means "do not update the lock file here." CI should fail if
the lock file is stale.

### Upgrade All Python Dependencies in the Future

After `pyproject.toml` and `uv.lock` exist:

```bash
cd src-python
uv lock --upgrade
uv sync
```

This updates the lock file and then syncs the local environment to it.

### Upgrade One Python Dependency in the Future

Use this for smaller safer changes:

```bash
cd src-python
uv lock --upgrade-package fastapi
uv sync
```

Use the actual package name you want to update.

### Python Vulnerability Checks

Current requirements-file scan:

```bash
uvx pip-audit -r src-python/requirements.txt
```

Future lock-file scan after Python locking is in place:

```bash
uvx pip-audit --locked src-python
```

Another option is OSV Scanner against `uv.lock`. The important part is that the
scanner should audit the exact dependency set the project installs.

## What Renovate Is

Renovate is an automated dependency update assistant.

It checks package registries on a schedule. For this project, that means places
like:

- npm registry for Bun/frontend dependencies.
- crates.io for Rust dependencies.
- PyPI for Python dependencies.

When Renovate finds updates, it opens pull requests. Those pull requests usually
change dependency manifests and lock files, such as:

- `package.json`
- `bun.lock`
- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock`
- future `src-python/pyproject.toml`
- future `src-python/uv.lock`

Renovate does not remove the need for human review. It makes the work smaller
and more regular:

1. Renovate opens an update pull request.
2. CI runs type checks, tests, builds, and audits.
3. A human reviews the changelog and the code diff.
4. The pull request is merged only if the update is understood and checks pass.

The advantage is that the project gets small weekly updates instead of one large
upgrade after months of drift.

## Upgrade Policy

Use this policy to decide how upgrades should happen.

### Patch and Minor Updates

Patch and minor updates can usually be grouped weekly if tests pass.

Examples:

- Bugfix releases.
- Small compatible feature releases.
- Type package updates.
- Tooling patch releases.

Even small updates should still run CI.

### Major Updates

Major updates should be separate pull requests.

Examples:

- Vite 7 to Vite 8.
- React 19 to a future React 20.
- Tauri 2 to a future Tauri 3.
- Large LlamaIndex version jumps.

For major updates:

1. Read the official migration guide first.
2. Update the smallest reasonable set of packages.
3. Run type checks, tests, builds, and audits.
4. Manually smoke-test the app.
5. Keep notes about any migration changes.

### Security Updates

Security fixes take priority over routine upgrades.

When a vulnerability appears:

1. Identify the affected package and fixed version.
2. Prefer the smallest update that reaches the fixed version.
3. Run the verification commands.
4. If the vulnerable package is transitive, update the parent package or use the
   package manager's supported override mechanism only when necessary.
5. Document ignored advisories with a reason if an advisory is not applicable.

### Tauri Updates

Tauri updates need special care because JavaScript packages and Rust crates must
stay compatible.

For Tauri updates:

1. Check official Tauri dependency sync guidance.
2. Update matching JavaScript and Rust packages together.
3. Review plugin permissions.
4. Review CSP and capabilities.
5. Run the full Tauri build.

### Vite and React Updates

For Vite major updates:

1. Read the Vite migration guide.
2. Check required Node/Bun compatibility.
3. Update Vite and `@vitejs/plugin-react` together when needed.
4. Run frontend checks.
5. Smoke-test the Tauri dev server flow.

For React major updates:

1. Read the React upgrade guide.
2. Use official codemods when recommended.
3. Run TypeScript checks.
4. Run component/unit tests.
5. Smoke-test app boot and core UI flows.

## Verification Commands

Run these after dependency updates.

### Frontend

```bash
bunx tsc --noEmit
bun run test
bun run build
bun audit --audit-level=high
```

### Rust and Tauri

```bash
cargo check --manifest-path src-tauri/Cargo.toml --locked
```

Future CI advisory scan:

```bash
cargo audit
```

or:

```bash
cargo deny check advisories
```

### Python

Current install check:

```bash
uv pip install -r src-python/requirements.txt
```

Future lock-file install check:

```bash
cd src-python
uv sync --locked
```

Future audit:

```bash
uvx pip-audit --locked src-python
```

or run OSV Scanner against `uv.lock`.

## Suggested Upgrade Workflow

Use this step-by-step flow for routine maintenance.

### 1. Start Clean

Check what files are already changed:

```bash
git status --short
```

Do not mix dependency upgrades with unrelated UI or feature work.

### 2. Check What Is Outdated

Frontend:

```bash
bun outdated
```

Rust:

```bash
cd src-tauri
cargo update --dry-run
```

Python today:

```bash
cd src-python
uv pip install -r requirements.txt
```

Python after `uv.lock` exists:

```bash
cd src-python
uv lock --check
```

### 3. Choose the Upgrade Type

Pick one:

- Routine patch/minor update.
- Single package security update.
- Planned major framework upgrade.
- Tauri synchronized upgrade.
- Python locking migration.

Do not combine all of these in one pull request.

### 4. Apply the Upgrade

Frontend compatible update:

```bash
bun update
```

Frontend major/specific latest update:

```bash
bun update --latest vite @vitejs/plugin-react
```

Rust compatible lock update:

```bash
cd src-tauri
cargo update
```

Rust single-package update:

```bash
cd src-tauri
cargo update -p tauri
```

Python future all-package update:

```bash
cd src-python
uv lock --upgrade
uv sync
```

Python future single-package update:

```bash
cd src-python
uv lock --upgrade-package fastapi
uv sync
```

### 5. Verify

Run the relevant verification commands from this document. For Tauri and major
frontend upgrades, run the full frontend and Rust/Tauri checks.

### 6. Review the Diff

Check what changed:

```bash
git status --short
git diff
```

Expected dependency-upgrade diffs usually include manifests and lock files. They
should not include unrelated source code unless a migration required code
changes.

### 7. Review Release Notes

For major packages, read release notes or migration guides before merging.

Pay special attention to:

- Breaking changes.
- Minimum supported Node/Bun/Rust/Python versions.
- Security-related defaults.
- Tauri permission or capability changes.
- Vite dev server behavior.
- React rendering or TypeScript changes.

## References

- Tauri dependency sync guidance:
  https://v2.tauri.app/develop/updating-dependencies/
- Tauri CSP guidance:
  https://v2.tauri.app/security/csp/
- Tauri capabilities guidance:
  https://v2.tauri.app/security/capabilities/
- Vite migration docs:
  https://vite.dev/guide/migration.html
- React 19 upgrade guide:
  https://react.dev/blog/2024/04/25/react-19-upgrade-guide
- Bun audit docs:
  https://bun.com/docs/pm/cli/audit
- uv lock/sync docs:
  https://docs.astral.sh/uv/concepts/projects/sync/
- uv Dependabot docs:
  https://docs.astral.sh/uv/guides/integration/dependabot/
- Cargo update docs:
  https://doc.rust-lang.org/cargo/commands/cargo-update.html
- RustSec/cargo-audit overview:
  https://rustsec.org/
- Renovate Bun manager docs:
  https://docs.renovatebot.com/modules/manager/bun/
