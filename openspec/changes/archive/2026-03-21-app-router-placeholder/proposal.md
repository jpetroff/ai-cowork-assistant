## Why

The project is being refactored from scratch against a new detailed specification. Before any feature work can begin, the application needs a navigable skeleton — a router with all defined routes wired up, each rendering a placeholder page with the correct loading architecture. Without this, no page or store can be developed in isolation.

## What Changes

- Add `src/router.tsx` — `createHashRouter` route tree with all 5 routes and fire-and-return loaders
- Add `src/App.tsx` — root component wiring `RouterProvider` and the single boot `useEffect`
- Add `src/components/layout/AppShell.tsx` — shared layout shell with navigation progress bar
- Add `src/pages/LoadingPage.tsx` — startup loading screen placeholder (600×600 window state)
- Add `src/pages/SetupPage.tsx` — first-run wizard placeholder
- Add `src/pages/HomePage.tsx` — project list placeholder with shimmer skeleton
- Add `src/pages/ProjectPage.tsx` — project detail / conversation list placeholder with shimmer skeleton
- Add `src/pages/ChatPage.tsx` — chat + editor layout placeholder, with `MessageList` and `EditorPanel` sub-components each owning their own skeleton
- Establish the per-component loading pattern: every store slice uses `status: 'idle' | 'loading' | 'ready' | 'error'`; components render their own skeleton when `status === 'loading'`

## Capabilities

### New Capabilities

- `app-router`: React Router v7 route tree, `App.tsx` entry point, `AppShell` layout, and the fire-and-return loader pattern that dispatches store actions without awaiting them.
- `page-loading-states`: Per-component loading architecture — store `status` enum contract, skeleton component pattern, and the sync-before-async store action discipline that prevents stale-data flash on navigation.

### Modified Capabilities

<!-- None — this is greenfield scaffold work; no existing specs have changing requirements. -->

## Impact

- `src/main.tsx` — updated to render `<App />` instead of empty root
- All future store implementations must expose `status: 'idle' | 'loading' | 'ready' | 'error'` on their state slice (established as a pattern, not enforced yet)
- All future page components are expected to be thin shells delegating loading state to their child components
- `react-router-dom@7` already installed — no new dependencies needed
