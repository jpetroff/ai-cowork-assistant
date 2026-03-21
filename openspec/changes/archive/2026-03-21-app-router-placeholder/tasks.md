## 1. Entry Point

- [x] 1.1 Update `src/main.tsx` to import and render `<App />` inside `React.StrictMode`

## 2. Router

- [x] 2.1 Create `src/router.tsx` with `createHashRouter` importing all 5 page components
- [x] 2.2 Add root layout route wrapping all children in `<AppShell><Outlet /></AppShell>`
- [x] 2.3 Add `/loading` route → `<LoadingPage />`
- [x] 2.4 Add `/setup` route → `<SetupPage />`
- [x] 2.5 Add `/` route with fire-and-return loader calling `projectStore.loadAll()` → `<HomePage />`
- [x] 2.6 Add `/projects/:projectId` route with loader calling `projectStore.setActive()` + `conversationStore.loadForProject()` → `<ProjectPage />`
- [x] 2.7 Add `/projects/:projectId/chats/:chatId` route with loader calling `conversationStore.setActive()` + `messageStore.loadForConversation()` + `artifactStore.loadForConversation()` → `<ChatPage />`

## 3. App Entry Component

- [x] 3.1 Create `src/App.tsx` rendering `<RouterProvider router={router} />` with single `useEffect(() => { appStore.init() }, [])` stub

## 4. AppShell Layout

- [x] 4.1 Create `src/components/layout/AppShell.tsx` using `useNavigation()` to show/hide a thin progress bar when `state === 'loading'`
- [x] 4.2 Render `{children}` (or `<Outlet />`) below the progress bar in `AppShell`

## 5. Stub Store Hooks

- [x] 5.1 Create `src/stores/stubs.ts` exporting minimal stub store hooks (`useProjectStore`, `useConversationStore`, `useMessageStore`, `useArtifactStore`, `useAppStore`) each returning hardcoded `{ status: 'loading' }` — these are replaced when real stores are implemented

## 6. Page Placeholders

- [x] 6.1 Create `src/pages/LoadingPage.tsx` — centered spinner + "Starting up…" text, full viewport, matches 600×600 window state
- [x] 6.2 Create `src/pages/SetupPage.tsx` — placeholder card with "First-run setup" heading and empty form area
- [x] 6.3 Create `src/pages/HomePage.tsx` — renders `<ProjectListSkeleton />` (3–4 shimmer project cards in a grid)
- [x] 6.4 Create `src/pages/ProjectPage.tsx` — renders a header skeleton + `<ConversationListSkeleton />` (shimmer list rows)
- [x] 6.5 Create `src/pages/ChatPage.tsx` — renders `<ChatLayout />` directly with no status check

## 7. Skeleton Sub-components

- [x] 7.1 Create `src/components/projects/ProjectListSkeleton.tsx` — shimmer grid of 3 project card outlines using `animate-pulse`
- [x] 7.2 Create `src/components/chat/ConversationListSkeleton.tsx` — shimmer list of 4 conversation row outlines
- [x] 7.3 Create `src/components/chat/MessageListSkeleton.tsx` — shimmer alternating message bubbles (user + assistant)
- [x] 7.4 Create `src/components/editor/EditorSkeleton.tsx` — shimmer rectangle representing the editor canvas
- [x] 7.5 Create `src/components/chat/MessageList.tsx` — reads `useMessageStore(s => s.status)`, returns `<MessageListSkeleton />` when `'loading'`, placeholder empty state otherwise
- [x] 7.6 Create `src/components/editor/EditorPanel.tsx` — reads `useArtifactStore(s => s.status)`, returns `<EditorSkeleton />` when `'loading'`, placeholder div otherwise
- [x] 7.7 Create `src/components/chat/ChatLayout.tsx` — composes `ConversationSidebar` placeholder + `<MessageList />` + `<EditorPanel />` in a split layout

## 8. Verification

- [x] 8.1 Run `bunx tsc --noEmit` and resolve all type errors
- [ ] 8.2 Run the app in dev mode (`bun run tauri dev` or `bun run dev`) and confirm all 5 routes render without blank screens or console errors
- [ ] 8.3 Confirm navigating between routes shows the progress bar flash and renders the correct skeleton for each route
