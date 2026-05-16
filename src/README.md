# App Router

This document explains how the routing architecture works, the loading pattern it enforces, and what to keep in mind when adding new routes or components.

## Structure

```
main.tsx
└── App.tsx                          # RouterProvider + boot effect
    └── router.tsx                   # createHashRouter route tree
        └── AppShell (layout)        # shared shell, progress bar
            ├── /loading             # LoadingPage
            ├── /setup               # SetupPage
            ├── /                    # HomePage
            ├── /projects/:id        # ProjectPage
            └── /projects/:id/chats/:chatId  # ChatPage
```

**Why hash routing?** Tauri hosts the WebView under a custom asset protocol (`tauri://localhost`). Hash URLs (`#/path`) require zero server configuration and work identically in dev, production, macOS, Windows, and Linux. `createBrowserRouter` would require per-platform asset protocol setup and behaves differently across environments.

## How loading works

Navigation in this app follows a **fire-and-return** pattern rather than awaiting data in route loaders.

### Route loaders (fire-and-return)

Loaders call store actions to initiate data fetches but return `null` immediately — they do **not** `await` anything:

```ts
// router.tsx
loader: ({ params }) => {
  messageStore.getState().loadForConversation(params.chatId!)
  artifactStore.getState().loadForConversation(params.chatId!)
  return null // ← sync return, never awaits
}
```

This means:

- React Router's navigation completes instantly
- `AppShell` shows its progress bar for a single frame (a brief flash — acceptable)
- The new page renders immediately with skeleton UIs
- Components reveal progressively as each store slice resolves

### Store status enum

Every store slice must expose a `status` field:

```ts
type StoreStatus = 'idle' | 'loading' | 'ready' | 'error'
```

This is a hard convention. Do not use `isLoading: boolean` — components depend on the full enum.

### Sync-before-async discipline

Every store load action must set `status: 'loading'` and clear stale data **synchronously** as its first operation, before any `await`:

```ts
loadForConversation: async (id) => {
  set({ status: 'loading', messages: [] }) // ← must be first, sync
  const rows = await db.getMessages(id)
  set({ status: 'ready', messages: rows })
}
```

This is the anti-flash guarantee. By the time the loader returns and React renders the new page, every store slice is already in `'loading'` state with stale data cleared. Without this, navigating from Project A to Project B could briefly show Project A's data.

### Per-component skeletons

Components own their own loading state — pages do not check status:

```ts
// MessageList.tsx
const status = useMessageStore(s => s.status)
if (status === 'loading') return <MessageListSkeleton />
```

This gives full independence: `MessageList` can reveal while `EditorPanel` is still loading. Pages are thin layout shells — keep loading logic out of them.

**`EditorPanel` is the only component besides `App.tsx` permitted to use `useEffect`.** If you find yourself reaching for `useEffect` in a page or data component, reconsider — the pattern is store actions triggered by loaders, not component-level effects.

## The progress bar

`AppShell` uses `useNavigation()` from React Router to show a thin bar at the top of the screen while navigation state is `'loading'`:

```ts
const navigation = useNavigation()
const isLoading = navigation.state === 'loading'
```

Because loaders return synchronously, the bar is visible for less than one frame in practice. Its purpose is correctness, not visibility — skeletons communicate loading to the user.

## Adding a new route

1. **Create the page component** in `src/pages/`. Keep it a thin layout shell — no loading logic.
2. **Add the route** in `src/router.tsx` with a fire-and-return loader that dispatches the appropriate store actions.
3. **Add a loader** that calls `store.getState().someAction()` — do not `await`.
4. **Ensure store actions** set `status: 'loading'` synchronously before any `await`.
5. **Create skeleton components** for any new data-bearing sub-components. Each component subscribes to its own store slice and renders its own skeleton.

```ts
// Example: adding /teams/:teamId
{
  path: 'teams/:teamId',
  loader: ({ params }) => {
    teamStore.getState().setActive(params.teamId!)
    memberStore.getState().loadForTeam(params.teamId!)
    return null
  },
  element: <TeamPage />,
}
```

## Colocated stores

Zustand stores live next to the feature components that consume them. Components still use the selector API:

```ts
const status = useMessageStore((s) => s.status)
```

Import stores from their feature folders:

```ts
import { useMessageStore } from '@/components/chat/messageStore'
import { useArtifactStore } from '@/components/editor/artifactStore'
```

Page-level coordination belongs in a colocated orchestration store, such as `chatSessionStore`, rather than hidden imports between domain stores.
