---
name: react-hooks-with-global-storage
user-invocable: false
description: Patterns for running app logic outside React hooks using external state (e.g. Zustand) and router loaders. Use this skill when deciding to use useEffect(). This skills helps minimize use of useEffect() hooks in application.
---

# Problem

You are building a React app that uses:

- External state (e.g. Zustand, Jotai, custom store, `useStorage()`).
- A router (e.g. React Router with loaders/actions).

You want to:

- Move most app logic out of React components and `useEffect`.
- Run logic on events like route changes and user actions.
- Communicate changes through an external store so components just subscribe and render.

The patterns below show how to:

- Use the store API outside React (Pattern 1).
- Run logic in router loaders/actions and push results into the store (Pattern 2).
- Encapsulate logic in domain/service modules that talk to the store (Pattern 3).
- Model “page load” behavior as store actions triggered by router, not `useEffect` (Pattern 5).
- Use the store instance (`getState`/`setState`) instead of React hooks in non-React code (Pattern 6).

The examples use Zustand-style API, but the ideas work with any external store that exposes a non-hook API.

***

# Pattern 1: Unhooked store API

**Goal:** Use the store from any module (not only React components) without breaking the Rules of Hooks.

Key ideas:

- Define your store once (e.g. `store.ts`).
- Export the hook for components.
- Also use the store instance (`useStore.getState`, `useStore.setState`) from non-React code.

Example:

```ts
// store.ts
import { create } from "zustand";

type User = { id: string; name: string } | null;

interface AppState {
  user: User;
  redirectToLogin: boolean;
  setUser: (user: User) => void;
  setRedirectToLogin: (flag: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  redirectToLogin: false,
  setUser: (user) => set({ user }),
  setRedirectToLogin: (flag) => set({ redirectToLogin: flag }),
}));
```

Use in React:

```tsx
// components/Header.tsx
import { useAppStore } from "../store";

export function Header() {
  const user = useAppStore((s) => s.user);

  return <div>{user ? `Hi, ${user.name}` : "Not signed in"}</div>;
}
```

Use outside React:

```ts
// services/authSession.ts
import { useAppStore } from "../store";

export function forceLogout() {
  const { setUser, setRedirectToLogin } = useAppStore.getState();
  setUser(null);
  setRedirectToLogin(true);
}
```

This pattern is the base for the rest:

- All React-specific code uses `useAppStore(selector)`.
- All non-React code uses `useAppStore.getState()` and `useAppStore.setState()`.

***

# Pattern 2: Router loaders/actions as logic entry points

**Goal:** Run “on page load” logic in router loaders/actions, not in component `useEffect`.

Key ideas:

- Router loaders/actions run on navigation, before your component renders.
- They can fetch data, run checks (auth, feature flags), and update the external store.
- Components then read store state and loader data.

Example with React Router v6.4+:

```ts
// routes/dashboard.loader.ts
import type { LoaderFunctionArgs } from "react-router-dom";
import { redirect } from "react-router-dom";
import { useAppStore } from "../store";
import { authService } from "../services/authService";

export async function dashboardLoader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // 1. Check auth in a service (no React here)
  const user = await authService.getCurrentUser();

  // 2. Update store with unhooked API
  const { setUser, setRedirectToLogin } = useAppStore.getState();

  if (!user) {
    setUser(null);
    setRedirectToLogin(true);
    return redirect("/login");
  }

  setUser(user);
  setRedirectToLogin(false);

  // 3. Optional: return loader data for this route
  return { pathname };
}
```

Route config:

```tsx
// routes/router.tsx
import { createBrowserRouter } from "react-router-dom";
import { dashboardLoader } from "./dashboard.loader";
import { DashboardPage } from "../pages/DashboardPage";

export const router = createBrowserRouter([
  {
    path: "/dashboard",
    loader: dashboardLoader,
    element: <DashboardPage />,
  },
]);
```

Component uses store and loader data:

```tsx
// pages/DashboardPage.tsx
import { useLoaderData } from "react-router-dom";
import { useAppStore } from "../store";

export function DashboardPage() {
  const { pathname } = useLoaderData() as { pathname: string };
  const user = useAppStore((s) => s.user);

  return (
    <main>
      <h1>Dashboard for {user?.name}</h1>
      <p>Loaded route: {pathname}</p>
    </main>
  );
}
```

Result:

- No `useEffect` for “on page load” checks.
- Logic runs in loaders, which are plain async functions.
- State flows into the store, then components react to store changes.

***

# Pattern 3: Domain/service layer that talks to the store

**Goal:** Keep business logic in plain TypeScript modules, independent from React, and use the store as the integration point.

Key ideas:

- Domain modules contain pure or mostly pure functions.
- They read and write store state via `getState`/`setState`.
- They can be called from loaders, actions, event handlers, or other services.

Example domain module:

```ts
// domain/routeGuards.ts
import { useAppStore } from "../store";
import { featureFlags } from "../config/featureFlags";
import { authService } from "../services/authService";

export async function handleRouteEnter(pathname: string) {
  const { user, setUser, setRedirectToLogin } = useAppStore.getState();

  // Ensure user data
  if (!user) {
    const fetchedUser = await authService.getCurrentUser();
    setUser(fetchedUser);
  }

  // Simple auth rule
  if (!useAppStore.getState().user && pathname.startsWith("/account")) {
    setRedirectToLogin(true);
  }

  // Feature flag rule
  if (!featureFlags.newDashboard && pathname === "/dashboard") {
    // Example: mark this in store or redirect from loader
    // useAppStore.setState({ useLegacyDashboard: true });
  }
}
```

Use from a loader:

```ts
// routes/account.loader.ts
import type { LoaderFunctionArgs } from "react-router-dom";
import { redirect } from "react-router-dom";
import { handleRouteEnter } from "../domain/routeGuards";
import { useAppStore } from "../store";

export async function accountLoader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  await handleRouteEnter(pathname);

  const { redirectToLogin, user } = useAppStore.getState();
  if (redirectToLogin || !user) {
    return redirect("/login");
  }

  return null;
}
```

Use from an event handler:

```ts
// components/NavLink.tsx
import { handleRouteEnter } from "../domain/routeGuards";

export async function navigateTo(pathname: string, navigate: (to: string) => void) {
  await handleRouteEnter(pathname);
  navigate(pathname);
}
```

Benefits:

- Domain functions are testable without React.
- React components stay thin and declarative.

***

# Pattern 4: Page “enter” behavior via store actions, not `useEffect`

**Goal:** Model “when this page loads, do X” as a store action triggered by router logic instead of a `useEffect` in the page component.

Common anti-pattern:

```tsx
// pages/SettingsPage.tsx (anti-pattern)
import { useEffect } from "react";
import { useAppStore } from "../store";

export function SettingsPage() {
  const setCurrentPage = useAppStore((s) => s.setCurrentPage);

  useEffect(() => {
    setCurrentPage("settings");
  }, [setCurrentPage]);

  return <SettingsForm />;
}
```

Better: move this to the store + loader.

Store:

```ts
// store.ts (additions)
interface AppState {
  // ...
  currentPage: string | null;
  enterPage: (id: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // ...
  currentPage: null,
  enterPage: (id) => set({ currentPage: id }),
}));
```

Loader:

```ts
// routes/settings.loader.ts
import type { LoaderFunctionArgs } from "react-router-dom";
import { useAppStore } from "../store";

export function settingsLoader(_: LoaderFunctionArgs) {
  useAppStore.getState().enterPage("settings");
  return null;
}
```

Route:

```tsx
// routes/router.tsx
import { settingsLoader } from "./settings.loader";
import { SettingsPage } from "../pages/SettingsPage";

{
  path: "/settings",
  loader: settingsLoader,
  element: <SettingsPage />,
}
```

Component becomes dumb:

```tsx
// pages/SettingsPage.tsx
import { SettingsForm } from "../components/SettingsForm";

export function SettingsPage() {
  return <SettingsForm />;
}
```

Now:

- The page has no `useEffect`.
- “When page loads” logic is tied to routing, not rendering.
- The current page is still visible in the store for any subscriber.

***

# Pattern 5: Use store instance in utilities, not hooks

**Goal:** Use the store in non-React code without violating the Rules of Hooks.

Key ideas:

- Never call React hooks (`useStore`, `useAppStore`, `useStorage`) in:
  - Plain functions.
  - Classes.
  - Services.
  - Domain modules.
- Instead, call `store.getState()` and `store.setState()` or actions on the returned state.

Anti-pattern:

```ts
// utils/formatUser.ts (anti-pattern)
import { useAppStore } from "../store";

export function formatUserName() {
  const user = useAppStore((s) => s.user); // ❌ hook in non-React code
  return user ? user.name.toUpperCase() : "UNKNOWN";
}
```

Correct pattern:

```ts
// utils/formatUser.ts
import { useAppStore } from "../store";

export function formatUserName() {
  const { user } = useAppStore.getState(); // ✅ no hook
  return user ? user.name.toUpperCase() : "UNKNOWN";
}
```

Another example for imperative updates:

```ts
// services/notifications.ts
import { useAppStore } from "../store";

export function showGlobalError(message: string) {
  useAppStore.setState((prev) => ({
    ...prev,
    globalError: message,
  }));
}
```

Or using actions:

```ts
// store.ts
interface AppState {
  globalError: string | null;
  setGlobalError: (msg: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  globalError: null,
  setGlobalError: (msg) => set({ globalError: msg }),
}));
```

```ts
// services/notifications.ts
import { useAppStore } from "../store";

export function showGlobalError(message: string) {
  useAppStore.getState().setGlobalError(message);
}
```

This keeps all non-React code safe and usable from any context (Node, tests, workers).

***

# How to apply these patterns

When you think “I need `useEffect`”:

1. Check if this logic belongs to:
    - Routing (on navigation, on page load, auth checks).
    - Business rules (domain logic).
    - Global app state (current user, current page, flags).
2. If yes:
    - Put it in a domain/service module (Pattern 3).
    - Trigger it from a loader/action or other entry point (Pattern 2, Pattern 5).
    - Use the store instance, not hooks, in that code (Pattern 1, Pattern 6).
3. Keep `useEffect` only for:
    - DOM subscriptions.
    - Component-local async behaviors tied purely to that component’s lifecycle.

This way, your React components become thin views bound to an external store, and most logic lives in predictable, testable modules.
