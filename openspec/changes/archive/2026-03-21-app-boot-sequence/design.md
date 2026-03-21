## Context

The app currently defines a single Tauri window (`main`, 800×600) that loads the React app immediately. There is no boot coordination: the sidecar is not started, the DB is not checked, and the router renders whatever route the hash URL points to. `App.tsx` has a stub `useEffect` calling `appStore.init()` (not yet implemented), and `stubs.ts` provides placeholder stores. The Python sidecar is spawned by the Tauri Rust command `sidecar::init`, which returns a URL immediately after spawning — no health verification happens. There is no first-run detection.

## Goals / Non-Goals

**Goals:**
- Start the sidecar unconditionally and immediately when Tauri launches (Rust side)
- Show a 400×400 splash window during boot; never show the main window until ready
- Detect first-run (no LLM providers in DB) and route to setup vs. home with zero visible intermediate transitions
- Health-check the sidecar from React; treat the sidecar as ready only when `/health` returns 200
- Support extensible startup steps (sidecar today; ChromaDB, external services later)
- Persist and restore main window dimensions via `app_settings`
- Provide a retry path for boot errors

**Non-Goals:**
- Sidecar restart after crash (covered by a separate spec)
- ChromaDB or external service startup (future startup steps — model is extensible but not populated now)
- Animated window transitions (OS handles resize/show natively)
- Multi-window state sharing via Tauri events (all state lives in the single React WebView context)

## Decisions

### D1: Two windows defined in `tauri.conf.json` (splash + main hidden)

**Decision:** Define both windows statically in `tauri.conf.json`. Splash is `visible: true`, 400×400, no decorations. Main is `visible: false`, 1200×800 default, min 800×600.

**Alternatives considered:**
- *Single window that resizes*: Simpler React code, but the OS resize animation is jarring — window shrinks from 1200px wide to 400px or vice versa. Two separate windows gives a clean "splash closes, main appears" feel.
- *Create main window dynamically from Rust on boot complete*: More control, but requires a Tauri command round-trip and adds Rust complexity. Static definition is simpler and sufficient.

**Rationale:** The splash and main windows serve fundamentally different UX roles (loading splash vs. application). Static definition is declarative and avoids runtime window creation complexity.

---

### D2: AppShell branches on `getCurrentWindow().label`

**Decision:** `AppShell` calls `getCurrentWindow().label` once on mount. If label is `"splash"`, it always renders `<LoadingPage />` and ignores the router `<Outlet />`. If label is `"main"`, it renders normally with a loading overlay guard for the `'loading'` phase.

**Alternatives considered:**
- *Separate entry HTML for each window*: Clean isolation but requires build complexity (multiple Vite entry points, Tauri custom protocols).
- *URL parameter to indicate window type*: Fragile — the URL is user-visible and user-controllable.

**Rationale:** Window label is the canonical Tauri identifier for a window. Reading it once in `AppShell` is clean, zero-overhead, and requires no build changes.

---

### D3: Health check polling in React, not Rust

**Decision:** The Rust `sidecar::init` command spawns the process and returns the URL immediately. React polls `GET {url}/health` every 500ms with a 30-second timeout.

**Alternatives considered:**
- *Rust polls health and resolves only when ready*: Cleaner from React's perspective (one `await invoke()`), but blocks the Rust async executor and prevents React from showing incremental progress.
- *Tauri event emitted when sidecar is healthy*: Decoupled, but requires Rust to do the polling — same problem as above.

**Rationale:** Health-check progress (step status, error display, retry) is UI state. It belongs in React where it can update the store and drive the `LoadingPage` component incrementally.

---

### D4: `AppPhase` enum as the single source of truth for navigation

**Decision:** A typed `AppPhase` enum (`'booting' | 'setup' | 'loading' | 'ready' | 'error'`) in `appStore` drives all window show/hide and route navigation decisions. Components and `AppShell` subscribe to this value; nothing navigates imperatively based on local component logic.

```
'booting'  → splash visible, main hidden, DB check + sidecar invoke in progress
'setup'    → main visible at /setup, sidecar health-check running in background
'loading'  → splash visible (normal run) OR main shows overlay (post-setup wait)
'ready'    → main visible at /, splash closed
'error'    → current window shows error state, retry available
```

**Rationale:** Centralizing routing decisions in the store prevents race conditions where multiple components independently decide to navigate. The enum is also the natural integration point for future startup steps.

---

### D5: Sidecar always starts unconditionally

**Decision:** The Rust `sidecar::init` command is called at Tauri startup (via a setup hook or early in the app lifecycle), not triggered by React. React receives the URL and does health checks.

**Alternatives considered:**
- *React triggers sidecar start via invoke*: Works but introduces a round-trip delay before health-checking can begin.

**Rationale:** Starting the sidecar as early as possible (before React even mounts) maximizes the time available for the sidecar to warm up. On first run, this means the sidecar may already be healthy by the time the user finishes setup.

**Implementation note:** In dev mode, the sidecar is assumed to be running externally on the fixed port. `sidecar::init` in dev mode returns the fixed URL immediately without spawning. In production, it spawns the binary with `--port <random>`.

---

### D6: `LoadingPage` is a single component used in two contexts

**Decision:** The same `LoadingPage` component renders in the splash window (fullscreen, 400×400 container) and as an overlay in the main window during the post-setup sidecar wait (`'loading'` phase). The component is layout-agnostic: it fills its container and centers its content.

**Rationale:** Avoids duplication. The visual design (app logo, step list, error state) is identical in both contexts; only the container size differs.

---

### D7: Window size stored in `app_settings`, seeded with defaults

**Decision:** Two new `app_settings` keys: `main_window_width` (default `1200`) and `main_window_height` (default `800`). Read before showing the main window; written on `resize` event (debounced 500ms).

**Alternatives considered:**
- *OS-level window state persistence via Tauri plugin*: Would handle position too, but adds a dependency. For MVP, width/height in `app_settings` is sufficient.

## Risks / Trade-offs

**[Risk] Splash window flickers on very fast hardware** → The splash may be visible for only a few frames before closing (DB check is ~1ms). Mitigation: enforce a minimum splash display time of 300ms so the transition feels intentional rather than glitchy.

**[Risk] Main window visible=false causes blank flash on show** → On some platforms, `window.show()` may briefly show a blank frame before React renders. Mitigation: navigate to the correct route in React before calling `window.show()` — the render is synchronous from the already-mounted React tree.

**[Risk] 30-second health check timeout blocks the user** → If the sidecar never starts (binary missing, crash), the user is stuck on the splash for 30 seconds. Mitigation: reduce timeout to 15 seconds for MVP; show a "Taking longer than expected…" message at 5 seconds.

**[Risk] Dev sidecar not running when app starts** → Health check will fail after timeout, landing on error state. This is acceptable dev ergonomics — the error message should clearly say "Sidecar not reachable at {url}" with a Retry button.

**[Risk] `tauri.conf.json` DB name mismatch** → Currently `plugins.sql.preload` references `sqlite:user_data.db` but `db.rs` uses `sqlite:app_data.db`. This must be resolved as part of this change (use `app_data.db` consistently).

## Open Questions

- **Q1**: Should the splash enforce a minimum display time (e.g., 300ms) to avoid a flash-and-gone feel? Proposed: yes, 300ms minimum.
- **Q2**: Should window position (x, y) also be persisted, or just size? Proposed: size only for MVP; center on open.
- **Q3**: What is the exact `/health` response contract for the FastAPI sidecar? Assumed: `GET /health` → `200 OK`. The Python sidecar must implement this endpoint.
