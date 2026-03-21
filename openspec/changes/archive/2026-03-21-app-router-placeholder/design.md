## Context

The project is being built from scratch against a new specification. `src/main.tsx` currently renders an empty React root. No router, pages, or stores exist yet. The spec mandates React Router v7, Zustand, Tauri v2, and a strict "no useEffect in components except App.tsx and EditorPanel.tsx" discipline. This design establishes the routing skeleton and the per-component loading pattern that all future feature work builds on.

## Goals / Non-Goals

**Goals:**
- Wire up all 5 routes defined in the spec with correct paths and loader signatures
- Establish fire-and-return loader pattern (loaders dispatch store actions, return `null` immediately)
- Establish per-component `status` enum pattern for independent loading skeletons
- Establish sync-before-async discipline in store actions to prevent stale-data flash
- All pages render meaningful skeleton UIs (not blank screens)
- `main.tsx` renders a working `<App />` with the router

**Non-Goals:**
- Real store implementations (stores don't exist yet; pages stub what they need)
- Real data fetching (DB layer not wired yet)
- Navigation logic in `appStore.init()` (boot sequence implementation is separate)
- Functional UI for any page (this is a placeholder scaffold)

## Decisions

### D1: `createHashRouter` over `createBrowserRouter`

Tauri v2 hosts the WebView under a custom asset protocol (`tauri://localhost` or `https://tauri.localhost`). HTML5 history routing requires the server to handle arbitrary paths — in Tauri this means configuring the asset protocol per-platform. Hash routing works with zero configuration on all platforms.

**Alternative considered:** `createBrowserRouter` with Tauri `devUrl`/asset config — possible but fragile; behaves differently in dev vs production build and across macOS/Windows/Linux. Hash URLs have no downside for a desktop app with no URL sharing or SEO requirements.

### D2: Fire-and-return loaders (no `await` in loaders)

Route loaders call store actions to initiate data loads but do **not** await them. They return `null` synchronously. This means:
- React Router's `useNavigation().state` flips to `'loading'` and back instantly (brief progress bar flash — acceptable)
- The new page renders immediately with skeleton UIs
- Components reveal progressively as each slice resolves

**Alternative considered:** Await primary data in loader (e.g., await messages, fire artifact load) — this would extend the progress bar to cover real load time, but forces the entire page to wait for the slowest awaited call before any content appears. Rejected in favour of per-component independence.

### D3: Per-component `status` enum over page-level `isLoading` or React Suspense

Each store slice exposes `status: 'idle' | 'loading' | 'ready' | 'error'`. Components subscribe to their own slice's status and render their own skeleton. This gives full independence: `MessageList` can reveal while `EditorPanel` is still loading.

**React Suspense considered:** Would require stores to expose stable Promise references and every component tree to be wrapped in `<Suspense>` + `<ErrorBoundary>`. More elegant in theory, but adds significant boilerplate for marginal gain given this app's data patterns. Deferred to a potential future refactor.

**Page-level `isLoading` considered:** Simpler, but forces all components to wait for the slowest slice. Rejected.

### D4: Store action sync-before-async discipline

Every load action must set `status: 'loading'` and clear stale data **synchronously** (before any `await`) as its first operation:

```ts
loadForConversation: async (id) => {
  set({ status: 'loading', messages: [] }); // ← sync, runs before any await
  const rows = await db.getMessages(id);
  set({ status: 'ready', messages: rows });
}
```

This is the anti-flash guarantee: by the time the loader returns `null` and React renders the new page, every store slice is already in `'loading'` state with cleared data. Components never display stale Project A data while loading Project B.

For the placeholder implementation, stub stores use `'loading'` as the hardcoded initial status (no real async work yet).

### D5: Pages are layout shells — no loading logic at page level

`ChatPage`, `ProjectPage`, etc. do not check any loading state themselves. They render layout components (`ChatLayout`, `ConversationList`, `EditorPanel`) which each handle their own status. This keeps pages thin and prevents loading state logic from leaking into the wrong layer.

### D6: Stub stores for placeholder phase

Since Zustand stores don't exist yet, each page file defines a minimal local stub — a plain object or a simple `create()` store with hardcoded `status: 'loading'` — imported only within that page file. When real stores are implemented, only the import path changes. This avoids coupling the router scaffold to store architecture decisions not yet made.

## Risks / Trade-offs

- **Stub stores are temporary coupling** → Stubs are co-located in page files and clearly marked with `// TODO: replace with real store`. When stores land, it's a one-line import swap per file.
- **Progress bar is nearly invisible** → Since loaders return synchronously, `useNavigation()` state is `'loading'` for less than one frame. The bar may not visibly render. Acceptable — the skeleton UIs communicate loading clearly.
- **`status` enum must be adopted consistently** → If a future store exposes `isLoading: boolean` instead of `status`, components break the per-component pattern. Mitigated by documenting this as a hard convention in the spec (ADR-004).

## Migration Plan

1. Write all files in one pass (no existing code to migrate — greenfield)
2. Update `src/main.tsx` to render `<App />`
3. Verify app launches and all 5 routes are reachable via hash navigation
4. No rollback needed — if broken, revert `main.tsx` to empty root

## Open Questions

- None blocking implementation. Boot sequence (`appStore.init()` navigating from `/loading` to `/` or `/setup`) is out of scope for this change and will be resolved when `app.store.ts` is implemented.
