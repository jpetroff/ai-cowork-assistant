# Solution Specification: AI CoLab

**Version:** 1.0
**Date:** 2026-03-19
**Status:** Draft
**Requirements Source:** REQUIREMENTS.md v1.1
**Author:** Solution Architect (AI-assisted)

---

## 1. Executive Summary

AI CoLab is a cross-platform desktop application built on Tauri v2 (Rust shell + WebView frontend) that pairs a TipTap rich-text editor with an AI chat assistant backed by a locally-bundled Python FastAPI sidecar. The frontend is a React 19 single-page application using Zustand for all state, React Router v7 for route-driven data loading, and a strict no-useEffect-in-components discipline — all side effects live in store actions or route loaders. Persistence uses SQLite via the Tauri SQL plugin; the Python sidecar communicates over a localhost WebSocket using the existing FastAPI schema contract defined in `fastapi-schemas.py`.

---

## 2. Architecture Overview

### 2.1 System Type

**Modular Monolith (desktop process boundary).** A single OS process (Tauri) owns the window, Rust commands, and SQLite. A child sidecar process (PyInstaller binary) owns AI orchestration. The React frontend runs inside the Tauri WebView and is the sole UI layer. Components are split into presentation (dumb) and containers (store-connected), but they all ship in one bundle. Rationale: NFR-007 (cross-platform), TC-001, TC-002 — no network deployment complexity needed.

### 2.2 High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  Tauri Desktop Process                                      │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  WebView  (React 19 + Zustand + React Router v7)     │   │
│  │                                                      │   │
│  │  Stores: app · project · conversation · message      │   │
│  │          artifact · sidecar · settings               │   │
│  │                                                      │   │
│  │  Components: TopBar · ProjectList · ChatView         │   │
│  │              Editor (TipTap) · SettingsPanel         │   │
│  └───────────┬──────────────────────┬───────────────────┘   │
│              │ invoke()             │ WebSocket             │
│              ▼                      │ ws://127.0.0.1:{port} │
│  ┌───────────────────────┐          │                       │
│  │  Rust Commands        │          │                       │
│  │  db · sidecar · fs    │          │                       │
│  │  system · window      │          │                       │
│  └──────┬────────────────┘          │                       │
│         │                           │                       │
│  ┌──────▼────────┐                  │                       │
│  │  SQLite DB    │                  │                       │
│  │  (plugin-sql) │                  │                       │
│  └───────────────┘                  │                       │
└─────────────────────────────────────┼───────────────────────┘
                                      │
┌─────────────────────────────────────▼───────────────────────┐
│  Python Sidecar Process (PyInstaller binary)                │
│                                                             │
│  FastAPI  ──  LlamaIndex Workflow  ──  ChromaDB             │
│                     │                                       │
│              LLM Provider APIs (Ollama / OpenAI / etc.)     │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 Request Flow

**Chat request lifecycle:**

1. User types in `ChatInput`, hits send → calls `sidecaStore.sendChatRequest(request)`
2. Store serializes `ChatCompletionRequest` (message + history + workingFolder + knowledgeHubs) and sends over the open WebSocket
3. Sidecar streams `DefaultResponse` messages back over the same WebSocket
4. `sidecaStore._onMessage()` handler dispatches each event type:
   - `completion.chunk` → `messageStore.appendChunk(content)`
   - `completion.hitl.request` → `sidecaStore` sets `hitlRequest`, UI shows `HitlConfirmation` dialog
   - `completion.response` → `messageStore.finalizeMessage()`, `artifactStore.applyAiArtifact()`
   - `error` → `messageStore.setError()`
5. Auto-save debounce in `artifactStore` fires 1 s after last content change → `invoke('save_artifact', ...)`

**Navigation lifecycle:** React Router v7 loaders call store actions before rendering. No component fetches data independently.

---

## 3. Technology Stack

| Layer                  | Technology                | Version    | Justification                                                                     | Satisfies           |
| ---------------------- | ------------------------- | ---------- | --------------------------------------------------------------------------------- | ------------------- |
| Desktop shell          | Tauri                     | 2.x stable | Mandatory constraint                                                              | TC-001, NFR-007     |
| Frontend language      | TypeScript                | 5.x        | Type safety across store/component boundary                                       | TC-002              |
| Frontend runtime       | React                     | 19.x       | Mandatory constraint                                                              | TC-002              |
| Build tool             | Vite                      | 6.x        | Tauri-recommended; fast HMR                                                       | NFR-001             |
| Router                 | React Router              | 7.x        | Loader-based data fetching eliminates useEffect for navigation; familiar API, MIT | TC-002, NFR-001     |
| State management       | Zustand                   | 5.x        | Mandatory constraint                                                              | TC-004              |
| Editor                 | TipTap                    | 2.x        | Mandatory constraint, MIT                                                         | TC-003              |
| Styling                | Tailwind CSS              | 4.x        | Utility-first; pairs with shadcn components                                       | NFR-001             |
| UI components          | shadcn/ui (Base UI)       | latest     | Copy-owned components backed by Base UI primitives; accessible, headless, MIT     | NFR-008             |
| Icons                  | Lucide React              | 0.x        | MIT, tree-shakeable                                                               | NFR-008             |
| SQLite                 | @tauri-apps/plugin-sql    | 2.x        | Official Tauri plugin                                                             | TC-007, INT-006     |
| File system            | @tauri-apps/plugin-fs     | 2.x        | Official Tauri plugin                                                             | INT-005             |
| Shell/Sidecar          | @tauri-apps/plugin-shell  | 2.x        | Sidecar spawn management                                                          | FR-SYS-002, INT-001 |
| File dialog            | @tauri-apps/plugin-dialog | 2.x        | Folder picker                                                                     | FR-PRJ-004          |
| OS info                | @tauri-apps/plugin-os     | 2.x        | Username detection                                                                | FR-SYS-001          |
| Unit/integration tests | Vitest                    | 2.x        | Vite-native, fast                                                                 | —                   |
| Component tests        | React Testing Library     | 16.x       | Idiomatic React testing                                                           | —                   |
| E2E tests              | Playwright                | 1.x        | Cross-platform browser automation                                                 | —                   |

### 3.1 Runtime Dependencies

```
# Tauri plugins (npm)
@tauri-apps/api@2
@tauri-apps/plugin-sql@2
@tauri-apps/plugin-fs@2
@tauri-apps/plugin-shell@2
@tauri-apps/plugin-dialog@2
@tauri-apps/plugin-os@2

# React core
react@19
react-dom@19

# Router
react-router@7

# State
zustand@5

# Editor — core
@tiptap/react@2
@tiptap/pm@2                              # ProseMirror peer deps (bundled by TipTap)

# Editor — StarterKit constituents (listed explicitly, StarterKit not used)
@tiptap/extension-document@2
@tiptap/extension-paragraph@2
@tiptap/extension-text@2
@tiptap/extension-heading@2               # H1–H6 [FR-EDT-002]
@tiptap/extension-blockquote@2           # [FR-EDT-002]
@tiptap/extension-bullet-list@2          # [FR-EDT-002]
@tiptap/extension-ordered-list@2         # [FR-EDT-002]
@tiptap/extension-list-item@2
@tiptap/extension-list-keymap@2          # list keyboard shortcuts
@tiptap/extension-horizontal-rule@2      # [FR-EDT-002]
@tiptap/extension-hard-break@2
@tiptap/extension-bold@2                 # [FR-EDT-002]
@tiptap/extension-italic@2               # [FR-EDT-002]
@tiptap/extension-strike@2               # [FR-EDT-002]
@tiptap/extension-underline@2
@tiptap/extension-code@2                 # inline code [FR-EDT-002]
@tiptap/extension-history@2              # undo/redo
@tiptap/extension-gapcursor@2            # cursor at block boundaries
@tiptap/extension-dropcursor@2           # drag-and-drop cursor

# Editor — additional extensions
@tiptap/extension-table@2               # [FR-EDT-003]
@tiptap/extension-table-row@2
@tiptap/extension-table-cell@2
@tiptap/extension-table-header@2
@tiptap/extension-task-list@2           # [FR-EDT-006]
@tiptap/extension-task-item@2
@tiptap/extension-highlight@2           # [FR-EDT-007]
@tiptap/extension-link@2                # [FR-EDT-002]
@tiptap/extension-image@2
@tiptap/extension-code-block-lowlight@2 # [FR-EDT-005] replaces extension-code-block
lowlight@3
@tiptap/extension-character-count@2
tiptap-markdown@0.8                     # markdown serialization/deserialization, MIT

# UI
@base-ui/react                # Base UI primitives (headless, used by shadcn components)
lucide-react@0
tailwind-merge@2
clsx@2

# Utilities
uuid@11
```

### 3.2 Development Dependencies

```
vite@6
@vitejs/plugin-react@4
typescript@5
tailwindcss@4
@tailwindcss/vite@4
vitest@2
@vitest/ui@2
@testing-library/react@16
@testing-library/user-event@14
@playwright/test@1
@types/react@19
@types/react-dom@19
@types/uuid@9
```

### 3.3 Rust (Cargo) Dependencies

```toml
[dependencies]
tauri = { version = "2", features = ["devtools"] }
tauri-plugin-sql = { version = "2", features = ["sqlite"] }
tauri-plugin-fs = "2"
tauri-plugin-shell = "2"
tauri-plugin-dialog = "2"
tauri-plugin-os = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
```

---

## 4. Project Structure

```
ai-colab/
├── REQUIREMENTS.md
├── SPEC.md
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── index.html
│
├── src/                               # React frontend
│   ├── main.tsx                       # ReactDOM.createRoot entry point
│   ├── App.tsx                        # Root: router outlet + single init useEffect
│   ├── router.tsx                     # React Router v7 route tree with all loaders
│   │
│   ├── stores/                        # All application state (Zustand)
│   │   ├── app.store.ts               # Startup phase, window sizing, theme [FR-SYS-*]
│   │   ├── project.store.ts           # Projects CRUD, active project [FR-PRJ-*]
│   │   ├── conversation.store.ts      # Conversations CRUD [FR-CHT-*]
│   │   ├── message.store.ts           # Messages, streaming state [FR-CHT-003]
│   │   ├── artifact.store.ts          # Artifacts, editor content, auto-save [FR-EDT-*]
│   │   ├── sidecar.store.ts           # WebSocket lifecycle, HITL [INT-001, FR-SYS-002]
│   │   └── settings.store.ts          # LLM providers, app settings [FR-LLM-*]
│   │
│   ├── lib/
│   │   ├── db.ts                      # Tauri SQL helpers (typed wrappers)
│   │   ├── ws-client.ts               # Raw WebSocket send/receive, no state
│   │   ├── types.ts                   # All shared TypeScript types + DB row types
│   │   ├── constants.ts               # DEV_SIDECAR_PORT, DB_NAME, etc.
│   │   └── utils.ts                   # cn(), debounce(), formatDate(), generateId()
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.tsx           # Root layout: TopBar + main content area
│   │   │   └── TopBar.tsx             # App title, project breadcrumb, user avatar
│   │   │
│   │   ├── loading/
│   │   │   └── LoadingScreen.tsx      # 600×600 startup animation
│   │   │
│   │   ├── setup/
│   │   │   └── SetupWizard.tsx        # First-run: name + avatar form [FR-LLM-004]
│   │   │
│   │   ├── projects/
│   │   │   ├── ProjectList.tsx        # Grid/list of ProjectCard
│   │   │   ├── ProjectCard.tsx        # Single project display
│   │   │   └── ProjectForm.tsx        # Create/rename project modal
│   │   │
│   │   ├── chat/
│   │   │   ├── ChatLayout.tsx         # Split pane: sidebar + chat + editor
│   │   │   ├── ConversationSidebar.tsx # List of conversations for active project
│   │   │   ├── MessageList.tsx        # Scrollable message history
│   │   │   ├── MessageBubble.tsx      # Single message (user or assistant)
│   │   │   ├── StreamingMessage.tsx   # Live-updating assistant message
│   │   │   ├── ChatInput.tsx          # Text input + send + file attach
│   │   │   └── HitlConfirmation.tsx   # HITL approval dialog [BR-AI-005]
│   │   │
│   │   ├── editor/
│   │   │   ├── EditorPanel.tsx        # Container: toolbar + TipTap canvas
│   │   │   ├── EditorToolbar.tsx      # Formatting buttons (bold, italic, etc.)
│   │   │   └── ArtifactTabs.tsx       # Tab strip when multiple artifacts exist
│   │   │
│   │   ├── settings/
│   │   │   ├── SettingsSheet.tsx      # Slide-over panel (not a page)
│   │   │   ├── ProviderList.tsx       # LLM providers table
│   │   │   ├── ProviderForm.tsx       # Add/edit provider modal
│   │   │   ├── ModelSelector.tsx      # Provider + model picker dropdown
│   │   │   └── UserProfile.tsx        # Name + avatar edit
│   │   │
│   │   └── ui/                        # shadcn/ui components (Base UI primitives)
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       ├── Dialog.tsx
│   │       ├── DropdownMenu.tsx
│   │       ├── Avatar.tsx
│   │       ├── ScrollArea.tsx
│   │       ├── Spinner.tsx
│   │       └── Toast.tsx
│   │
│   ├── pages/                         # Route-level components (thin shells)
│   │   ├── LoadingPage.tsx            # Startup loading [FR-SYS-002]
│   │   ├── SetupPage.tsx              # First-run wizard [FR-LLM-004]
│   │   ├── HomePage.tsx               # Project list [FR-PRJ-005]
│   │   ├── ProjectPage.tsx            # Project overview [FR-PRJ-005]
│   │   └── ChatPage.tsx               # Chat + editor [FR-CHT-*, FR-EDT-*]
│   │
│   └── styles/
│       └── globals.css                # Tailwind imports + CSS custom properties (theme)
│
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json                # Window config, sidecar declaration, permissions
│   ├── capabilities/
│   │   └── default.json               # Capability grants for plugins
│   ├── resources/
│   │   └── default-config.yaml        # Bundled default app settings [FR-SYS-*]
│   └── src/
│       ├── main.rs                    # Tauri builder entry
│       ├── lib.rs                     # Plugin registration, command registration
│       └── commands/
│           ├── mod.rs
│           ├── db.rs                  # run_migrations, execute_sql, query_sql
│           ├── sidecar.rs             # start_sidecar, stop_sidecar, get_sidecar_port
│           ├── fs.rs                  # read_file, write_file, file_exists, file_hash
│           ├── system.rs              # get_os_username, get_os_avatar_path
│           └── window.rs              # resize_to_main, resize_to_loading
│
└── tests/
    ├── unit/
    │   ├── stores/                    # Zustand store action tests
    │   └── lib/                      # db.ts, utils.ts tests
    ├── integration/
    │   └── db/                       # SQLite schema + CRUD tests (real DB)
    └── e2e/
        └── flows/                    # Playwright: startup, project, chat flows
```

---

## 5. Module Specifications

### 5.1 App Startup & Lifecycle (`app.store.ts`, `AppShell`, `LoadingPage`)

**Purpose:** Orchestrate the application boot sequence: window sizing, DB initialization, sidecar startup, first-run detection, theme setup.
**Satisfies:** FR-SYS-001, FR-SYS-002, FR-SYS-003, FR-SYS-004, FR-SYS-005, FR-SYS-006, FR-SYS-007, NFR-010, NFR-011

#### 5.1.1 Startup Phase State Machine

```typescript
// src/stores/app.store.ts

type StartupPhase =
  | "loading" // initial — window is 600×600, animations running
  | "setup" // first-run wizard shown
  | "ready" // main app, window resized to 1200×800
  | "error"; // fatal error (sidecar failed, DB failed)

type SidecarStatus = "starting" | "ready" | "crashed" | "error";

interface UserProfile {
  name: string;
  avatarPath: string | null; // absolute path or null
}

interface AppState {
  startupPhase: StartupPhase;
  startupError: string | null;
  sidecarStatus: SidecarStatus;
  sidecarPort: number | null;
  userProfile: UserProfile | null;
  theme: "light" | "dark";
  settingsOpen: boolean;
}

interface AppActions {
  init: () => Promise<void>;
  completeSetup: (profile: UserProfile) => Promise<void>;
  setTheme: (theme: "light" | "dark") => void;
  openSettings: () => void;
  closeSettings: () => void;
  _onSidecarCrash: () => Promise<void>;
}

type AppStore = AppState & AppActions;
```

#### 5.1.2 `init()` Action — Boot Sequence

```typescript
init: async () => {
  // 1. Detect and apply OS theme [FR-SYS-007]
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const savedTheme = await db.getSetting("theme");
  const theme =
    (savedTheme as "light" | "dark") ?? (prefersDark ? "dark" : "light");
  set({ theme });
  applyThemeToDOM(theme);

  // 2. Run DB migrations [INT-006]
  await invoke<void>("run_migrations");

  // 3. Start sidecar [FR-SYS-002]
  const port = await invoke<number>("start_sidecar");
  set({ sidecarPort: port });

  // 4. Poll /healthcheck until ready (max 30s) [FR-SYS-002]
  await pollSidecarHealth(port); // throws if timeout
  set({ sidecarStatus: "ready" });

  // 5. Connect WebSocket [INT-001]
  await sidecaStore.getState().connect(port);

  // 6. Check first-run [FR-LLM-004]
  const profile = await db.getSetting("user_profile");
  const providers = await db.getAllProviders();
  if (!profile || providers.length === 0) {
    const osName = await invoke<string>("get_os_username");
    const osAvatar = await invoke<string | null>("get_os_avatar_path");
    set({
      startupPhase: "setup",
      userProfile: { name: osName, avatarPath: osAvatar },
    });
    return;
  }

  // 7. Expand window and navigate to home
  await invoke<void>("resize_to_main");
  set({ startupPhase: "ready", userProfile: JSON.parse(profile) });
};
```

#### 5.1.3 Sidecar Health Poll

```typescript
// src/lib/utils.ts
export async function pollSidecarHealth(
  port: number,
  maxWaitMs = 30_000,
  intervalMs = 500,
): Promise<void> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/healthcheck`);
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await sleep(intervalMs);
  }
  throw new Error(`Sidecar did not start within ${maxWaitMs}ms`);
}
```

#### 5.1.4 Sidecar Crash Recovery

The sidecar Rust command emits a Tauri event `sidecar-exited` when the child process terminates. The frontend registers a one-time listener in `sidecaStore.connect()` and calls `appStore._onSidecarCrash()`:

```typescript
_onSidecarCrash: async () => {
  set({ sidecarStatus: "crashed" });
  sidecaStore.getState().disconnect();
  // Attempt restart once [FR-SYS-003]
  try {
    const port = await invoke<number>("start_sidecar");
    await pollSidecarHealth(port);
    await sidecaStore.getState().connect(port);
    set({ sidecarStatus: "ready", sidecarPort: port });
  } catch {
    // [ERR-SYS-001] — disable AI features, keep editor
    set({ sidecarStatus: "error" });
    messageStore
      .getState()
      .setGlobalError(
        "AI assistant is unavailable. Editor features remain active.",
      );
  }
};
```

#### 5.1.5 Window Configuration (`tauri.conf.json`)

```json
{
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "AI CoLab",
        "width": 600,
        "height": 600,
        "minWidth": 600,
        "minHeight": 600,
        "resizable": false,
        "center": true
      }
    ]
  }
}
```

After setup/loading completes, call Rust command `resize_to_main` which executes:

```rust
// src-tauri/src/commands/window.rs
#[tauri::command]
pub fn resize_to_main(window: tauri::Window) -> Result<(), String> {
    window.set_size(tauri::Size::Logical(tauri::LogicalSize { width: 1200.0, height: 800.0 }))?;
    window.set_min_size(Some(tauri::Size::Logical(tauri::LogicalSize { width: 900.0, height: 600.0 })))?;
    window.set_resizable(true)?;
    window.center()?;
    Ok(())
}
```

#### 5.1.6 Theme System

Theme is applied by toggling the `dark` class on `<html>`:

```typescript
function applyThemeToDOM(theme: "light" | "dark") {
  document.documentElement.classList.toggle("dark", theme === "dark");
}
```

CSS variables defined in `src/styles/globals.css`:

```css
:root {
  --bg-primary: #ffffff;
  --bg-secondary: #f4f4f5;
  --text-primary: #09090b;
  /* ... full token set ... */
}
.dark {
  --bg-primary: #09090b;
  --bg-secondary: #18181b;
  --text-primary: #fafafa;
  /* ... */
}
```

`tailwind.config.ts` uses `darkMode: 'class'`.

---

### 5.2 Project Management (`project.store.ts`)

**Purpose:** CRUD for projects; track the active project.
**Satisfies:** FR-PRJ-001–006, BR-PRJ-001–003, ERR-PRJ-001–002

#### 5.2.1 Data Model

```typescript
// src/lib/types.ts
interface Project {
  id: string; // UUID v4 [FR-PRJ-001]
  name: string; // unique, max 255 chars [BR-PRJ-003]
  folderPath: string; // absolute path to existing directory [BR-PRJ-001]
  createdAt: number; // Unix ms
  updatedAt: number; // Unix ms
}
```

#### 5.2.2 Store Interface

```typescript
// src/stores/project.store.ts
interface ProjectState {
  projects: Project[];
  activeProjectId: string | null;
  folderAccessErrors: Record<string, boolean>; // projectId → folder inaccessible
}

interface ProjectActions {
  loadAll: () => Promise<void>;
  create: (name: string, folderPath: string) => Promise<Project>;
  rename: (id: string, name: string) => Promise<void>;
  delete: (id: string) => Promise<void>;
  setActive: (id: string) => void;
  reassignFolder: (id: string, folderPath: string) => Promise<void>;
  checkFolderAccess: (id: string) => Promise<boolean>;
}
```

#### 5.2.3 Business Rules

- `create()`: check uniqueness of `name` before INSERT; throw `ERR-PRJ-002` if duplicate
- `create()`: validate `folderPath` exists via `invoke('file_exists', { path: folderPath })`; throw `ERR-PRJ-001` if not
- `delete()`: cascade in DB only; no filesystem operations [BR-PRJ-002]
- `checkFolderAccess()`: called on app startup for each project; sets `folderAccessErrors` [ERR-PRJ-001]

#### 5.2.4 Tauri Commands Used

| Command              | Plugin              | Purpose                        |
| -------------------- | ------------------- | ------------------------------ |
| `open_folder_dialog` | plugin-dialog       | Browse for folder [FR-PRJ-004] |
| `file_exists`        | plugin-fs (wrapped) | Validate folder path           |

---

### 5.3 Conversations & Messages (`conversation.store.ts`, `message.store.ts`)

**Purpose:** Manage conversation list and message history within a project.
**Satisfies:** FR-CHT-001–010, BR-CHT-001–003, ERR-CHT-001–002

#### 5.3.1 Data Models

```typescript
interface Conversation {
  id: string;
  projectId: string;
  title: string | null; // null = auto-generated from first message
  createdAt: number;
  updatedAt: number;
}

interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  sequenceOrder: number;
  createdAt: number;
}
```

#### 5.3.2 Conversation Store Interface

```typescript
interface ConversationState {
  conversations: Conversation[]; // reverse chronological [BR-CHT-003]
  activeConversationId: string | null;
}

interface ConversationActions {
  loadForProject: (projectId: string) => Promise<void>;
  create: (projectId: string) => Promise<Conversation>;
  delete: (id: string) => Promise<void>;
  setActive: (id: string) => void;
  updateTitle: (id: string, title: string) => Promise<void>;
}
```

#### 5.3.3 Message Store Interface

```typescript
interface MessageState {
  messagesByConversation: Record<string, Message[]>;
  streamingContent: string; // partial assistant content being streamed
  isStreaming: boolean;
  globalError: string | null;
}

interface MessageActions {
  loadForConversation: (conversationId: string) => Promise<void>;
  addUserMessage: (conversationId: string, content: string) => Promise<Message>;
  startStreaming: (conversationId: string) => void;
  appendChunk: (chunk: string) => void;
  finalizeMessage: (
    conversationId: string,
    finalContent: string,
  ) => Promise<Message>;
  setGlobalError: (error: string | null) => void;
}
```

#### 5.3.4 New Conversation Flow

`conversationStore.create()` does in one transaction:

1. INSERT conversation row
2. INSERT empty artifact row (no `message_id`) with empty content [FR-CHT-004]
3. Return conversation

#### 5.3.5 Streaming Pattern

When user sends a message:

1. `messageStore.addUserMessage()` — persists user message, returns Message
2. `messageStore.startStreaming()` — sets `isStreaming: true`, `streamingContent: ''`
3. `sidecaStore.sendChatRequest()` — sends WebSocket request
4. Each `completion.chunk` → `messageStore.appendChunk(content)` — appends to `streamingContent`
5. `completion.response` → `messageStore.finalizeMessage()` — persists assistant message, clears streaming state

`StreamingMessage` component renders `streamingContent` directly from store with no local state.

---

### 5.4 Artifacts & Editor (`artifact.store.ts`, `EditorPanel`)

**Purpose:** Manage artifact versions, connect TipTap editor instance to Zustand, handle auto-save and disk sync.
**Satisfies:** FR-EDT-001–012, FR-CHT-004, FR-CHT-008, BR-EDT-001–003, ERR-EDT-001–002

#### 5.4.1 Data Model

```typescript
interface Artifact {
  id: string;
  conversationId: string;
  messageId: string | null; // null for initial empty artifact [FR-CHT-004]
  title: string | null;
  content: string; // markdown text
  filePath: string | null; // relative to project folder [BR-EDT-003]
  fileHash: string | null; // SHA-256 of last known disk content
  version: number;
  createdAt: number;
  updatedAt: number;
}
```

#### 5.4.2 Store Interface

```typescript
interface ArtifactState {
  artifactsByConversation: Record<string, Artifact[]>;
  activeArtifactId: string | null;
  editorInstance: Editor | null; // TipTap Editor object
  isDirty: boolean;
  saveError: string | null;
}

interface ArtifactActions {
  loadForConversation: (conversationId: string) => Promise<void>;
  setActiveArtifact: (id: string) => Promise<void>;
  setEditorInstance: (editor: Editor) => void;
  onContentChange: (content: string) => void; // called by TipTap onUpdate
  saveArtifact: () => Promise<void>; // debounced auto-save target
  linkToDisk: (artifactId: string, relativePath: string) => Promise<void>;
  checkExternalChange: (artifactId: string) => Promise<boolean>;
  reloadFromDisk: (artifactId: string) => Promise<void>;
  applyAiArtifact: (content: string, messageId: string) => Promise<Artifact>;
}
```

#### 5.4.3 Auto-Save Implementation

```typescript
// src/stores/artifact.store.ts
let _saveTimer: ReturnType<typeof setTimeout> | null = null;

// Inside store create():
onContentChange: (content: string) => {
  set({ isDirty: true });
  // Update active artifact content in memory immediately
  const id = get().activeArtifactId;
  if (!id) return;
  get()._updateInMemory(id, content);
  // Debounce DB write [NFR-003, BR-EDT-001]
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    useArtifactStore.getState().saveArtifact();
  }, 1000);
},

saveArtifact: async () => {
  const { activeArtifactId, editorInstance } = get();
  if (!activeArtifactId || !editorInstance) return;
  const markdown = editorInstance.storage.markdown.getMarkdown();
  try {
    await db.updateArtifactContent(activeArtifactId, markdown);
    // If linked to disk, write file too [FR-EDT-010]
    const artifact = get()._getActiveArtifact();
    if (artifact?.filePath) {
      const absPath = `${projectStore.getState().activeProject?.folderPath}/${artifact.filePath}`;
      await invoke('write_file', { path: absPath, content: markdown });
      const hash = await invoke<string>('file_hash', { path: absPath });
      await db.updateArtifactFileHash(activeArtifactId, hash);
    }
    set({ isDirty: false, saveError: null });
  } catch (err) {
    // [ERR-EDT-001, ERR-EDT-002]
    set({ saveError: String(err) });
  }
}
```

#### 5.4.4 TipTap Editor Setup

The `EditorPanel` component is the single place where `useEditor` is called:

```typescript
// src/components/editor/EditorPanel.tsx
const EditorPanel: React.FC = () => {
  const setEditorInstance = useArtifactStore(s => s.setEditorInstance);
  const onContentChange = useArtifactStore(s => s.onContentChange);
  const activeArtifact = useArtifactStore(s => {
    const id = s.activeArtifactId;
    return id ? s.artifactsByConversation[
      useConversationStore.getState().activeConversationId ?? ''
    ]?.find(a => a.id === id) : null;
  });

  const editor = useEditor({
    extensions: TIPTAP_EXTENSIONS,
    content: activeArtifact?.content ?? '',
    onUpdate: ({ editor }) => {
      onContentChange(editor.storage.markdown.getMarkdown());
    },
    onCreate: ({ editor }) => {
      setEditorInstance(editor);
    },
    onDestroy: () => {
      setEditorInstance(null);
    },
  });

  // When active artifact changes, load new content into editor
  // This is the controlled pattern — store tells editor what to display
  const prevArtifactId = useRef<string | null>(null);
  if (editor && activeArtifact && activeArtifact.id !== prevArtifactId.current) {
    prevArtifactId.current = activeArtifact.id;
    editor.commands.setContent(activeArtifact.content, false);
  }

  return (
    <div className="editor-panel">
      <EditorToolbar editor={editor} />
      <EditorContent editor={editor} className="editor-content" />
    </div>
  );
};
```

#### 5.4.5 TipTap Extensions List

```typescript
// src/lib/constants.ts
// StarterKit constituents — listed individually for transparency
import { Document } from "@tiptap/extension-document";
import { Paragraph } from "@tiptap/extension-paragraph";
import { Text } from "@tiptap/extension-text";
import { Heading } from "@tiptap/extension-heading";
import { Blockquote } from "@tiptap/extension-blockquote";
import { BulletList } from "@tiptap/extension-bullet-list";
import { OrderedList } from "@tiptap/extension-ordered-list";
import { ListItem } from "@tiptap/extension-list-item";
import { ListKeymap } from "@tiptap/extension-list-keymap";
import { HorizontalRule } from "@tiptap/extension-horizontal-rule";
import { HardBreak } from "@tiptap/extension-hard-break";
import { Bold } from "@tiptap/extension-bold";
import { Italic } from "@tiptap/extension-italic";
import { Strike } from "@tiptap/extension-strike";
import { Underline } from "@tiptap/extension-underline";
import { Code } from "@tiptap/extension-code"; // inline code
import { History } from "@tiptap/extension-history";
import { Gapcursor } from "@tiptap/extension-gapcursor";
import { Dropcursor } from "@tiptap/extension-dropcursor";
// Additional extensions
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { Highlight } from "@tiptap/extension-highlight";
import { Link } from "@tiptap/extension-link";
import { Image } from "@tiptap/extension-image";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight"; // replaces CodeBlock
import { common, createLowlight } from "lowlight";
import { CharacterCount } from "@tiptap/extension-character-count";
import { Markdown } from "tiptap-markdown";

export const TIPTAP_EXTENSIONS = [
  // Document structure
  Document,
  Paragraph,
  Text,
  HardBreak,
  Gapcursor,
  Dropcursor,
  History,

  // Block nodes [FR-EDT-002]
  Heading.configure({ levels: [1, 2, 3, 4, 5, 6] }),
  Blockquote,
  BulletList,
  OrderedList,
  ListItem,
  ListKeymap,
  HorizontalRule,

  // Marks [FR-EDT-002]
  Bold,
  Italic,
  Strike,
  Underline,
  Code, // inline code
  Link.configure({ openOnClick: false }),

  // Code block with syntax highlighting — replaces plain CodeBlock [FR-EDT-005]
  CodeBlockLowlight.configure({ lowlight: createLowlight(common) }),

  // Tables [FR-EDT-003]
  Table.configure({ resizable: true }),
  TableRow,
  TableCell,
  TableHeader,

  // Task lists [FR-EDT-006]
  TaskList,
  TaskItem.configure({ nested: true }),

  // Highlight [FR-EDT-007]
  Highlight.configure({ multicolor: false }),

  // Images
  Image,

  // Utilities
  CharacterCount,
  Markdown.configure({ html: false, transformPastedText: true }),
];
```

**Note on FR-EDT-004 (LaTeX/math):** `@tiptap/extension-mathematics` is a Pro feature. Defer to a community wrapper around `prosemirror-math` + `katex`. Implement as a separate TipTap extension file `src/lib/math-extension.ts` following the pattern in `prosemirror-math` docs. Mark as `priority: Could` per requirements.

#### 5.4.6 External File Change Detection [FR-EDT-011]

When `setActiveArtifact()` is called for a linked artifact:

1. Call `invoke('file_hash', { path: absPath })` → get current disk hash
2. Compare with `artifact.fileHash`
3. If different → set a flag in `artifactState.externalChangeDetected: true`
4. `EditorPanel` reads this flag and renders a banner with "Reload from disk" action
5. User clicks → `reloadFromDisk()` → reads file, sets editor content, updates hash

---

### 5.5 Sidecar Communication (`sidecar.store.ts`)

**Purpose:** Own the WebSocket connection lifecycle, dispatch incoming events to other stores, handle HITL flow.
**Satisfies:** INT-001, FR-SYS-002, FR-SYS-003, FR-AI-004, BR-AI-005, ERR-CHT-001

#### 5.5.1 Store Interface

```typescript
// src/stores/sidecar.store.ts
type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

interface HitlRequest {
  type: string; // action type (e.g., 'file_write', 'shell_command')
  description: string; // human-readable description of the action
  payload: unknown; // action-specific data
}

interface SidecaState {
  connectionState: ConnectionState;
  hitlRequest: HitlRequest | null;
  approvalMode: "auto" | "manual"; // [BR-AI-005]
}

interface SidecaActions {
  connect: (port: number) => Promise<void>;
  disconnect: () => void;
  sendChatRequest: (req: ChatCompletionRequest) => void;
  respondToHitl: (approved: boolean) => void;
  setApprovalMode: (mode: "auto" | "manual") => void;
}
```

#### 5.5.2 WebSocket Lifecycle

```typescript
// src/stores/sidecar.store.ts (inside create())
let _ws: WebSocket | null = null;

connect: async (port: number) => {
  set({ connectionState: 'connecting' });
  _ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);

  _ws.onopen = () => set({ connectionState: 'connected' });

  _ws.onmessage = (event) => {
    const msg: DefaultResponse = JSON.parse(event.data);
    get()._dispatch(msg);
  };

  _ws.onclose = () => {
    set({ connectionState: 'disconnected' });
    // Notify app store to trigger sidecar crash recovery
    useAppStore.getState()._onSidecarCrash();
  };

  _ws.onerror = () => set({ connectionState: 'error' });
},
```

#### 5.5.3 Message Dispatch

```typescript
_dispatch: (msg: DefaultResponse) => {
  const msgStore = useMessageStore.getState();
  const artStore = useArtifactStore.getState();
  const convId = useConversationStore.getState().activeConversationId ?? '';

  switch (msg.type) {
    case 'completion.chunk':
      msgStore.appendChunk(String(msg.content ?? ''));
      break;

    case 'completion.chunk.thinking':
      // Optionally surface thinking tokens in a collapsible UI element
      break;

    case 'completion.response':
      msgStore.finalizeMessage(convId, String(msg.content ?? ''));
      if (msg.payload?.artifact) {
        artStore.applyAiArtifact(msg.payload.artifact.content, msg.payload.messageId);
      }
      break;

    case 'completion.hitl.request':
      const req = msg.payload as HitlRequest;
      if (get().approvalMode === 'auto') {
        get().respondToHitl(true);
      } else {
        set({ hitlRequest: req });
      }
      break;

    case 'error':
      msgStore.setGlobalError(String(msg.content ?? 'Unknown AI error'));
      msgStore.finalizeMessage(convId, `⚠️ ${msg.content}`);
      break;

    case 'event':
      // Generic event — log or surface as toast
      break;
  }
},
```

#### 5.5.4 Chat Request Builder

```typescript
// Assembled in sidecaStore.sendChatRequest()
sendChatRequest: (userMessage: string, textHighlight?: TextHighlight) => {
  const project = useProjectStore.getState().activeProject;
  const messages = useMessageStore.getState().messagesForActiveConversation;

  const request: ChatCompletionRequest = {
    message: textHighlight
      ? `[Selected text: ${textHighlight.content}]\n\n${userMessage}`
      : userMessage,
    chatHistory: messages.map((m) => ({ role: m.role, content: m.content })),
    workingFolder: project?.folderPath ?? undefined,
    knowledgeHubs: project ? [`project-${project.id}`] : undefined,
  };

  _ws?.send(JSON.stringify(request));
};
```

#### 5.5.5 HITL Flow

1. Sidecar sends `completion.hitl.request` with `payload: HitlRequest`
2. If `approvalMode === 'manual'`: store sets `hitlRequest`, `HitlConfirmation` dialog renders
3. User clicks Approve or Reject → `respondToHitl(approved)`
4. Store sends:
   ```json
   { "type": "confirmation", "payload": { "approved": true } }
   ```
5. Store clears `hitlRequest`

---

### 5.6 LLM Settings (`settings.store.ts`)

**Purpose:** CRUD for LLM providers; model discovery; user profile; theme persistence.
**Satisfies:** FR-LLM-001–009, FR-SYS-006, BR-LLM-001–003, ERR-LLM-001–002

#### 5.6.1 Data Models

```typescript
interface LlmProvider {
  id: string;
  name: string;
  providerType: string; // 'ollama' | 'openai' | 'anthropic' | ...
  baseUrl: string;
  apiKey: string | null;
  isDefault: boolean;
  createdAt: number;
}

interface ModelInfo {
  id: string; // model identifier (e.g., 'llama3.2', 'gpt-4o')
  providerId: string;
}
```

#### 5.6.2 Store Interface

```typescript
interface SettingsState {
  providers: LlmProvider[];
  availableModels: ModelInfo[]; // fetched from providers [FR-LLM-007]
  selectedModel: ModelInfo | null; // currently active model [FR-LLM-008]
  modelsLoading: boolean;
  userProfile: UserProfile | null;
}

interface SettingsActions {
  loadProviders: () => Promise<void>;
  createProvider: (
    data: Omit<LlmProvider, "id" | "createdAt">,
  ) => Promise<void>;
  updateProvider: (id: string, data: Partial<LlmProvider>) => Promise<void>;
  deleteProvider: (id: string) => Promise<void>;
  setDefaultProvider: (id: string) => Promise<void>;
  fetchModels: () => Promise<void>; // [FR-LLM-007, FR-LLM-009]
  selectModel: (model: ModelInfo) => void;
  saveUserProfile: (profile: UserProfile) => Promise<void>;
}
```

#### 5.6.3 Model Discovery [FR-LLM-007]

```typescript
fetchModels: async () => {
  set({ modelsLoading: true });
  const providers = get().providers;
  const results: ModelInfo[] = [];

  await Promise.allSettled(
    providers.map(async (provider) => {
      try {
        // OpenAI-compatible /models endpoint
        const res = await fetch(`${provider.baseUrl}/models`, {
          headers: provider.apiKey
            ? { Authorization: `Bearer ${provider.apiKey}` }
            : {},
        });
        const data = await res.json();
        const models = (data.data ?? data.models ?? []) as Array<{
          id: string;
        }>;
        models.forEach((m) =>
          results.push({ id: m.id, providerId: provider.id }),
        );
      } catch {
        // [ERR-LLM-001] — provider unreachable, skip silently
      }
    }),
  );

  set({ availableModels: results, modelsLoading: false });
  // Auto-select default model if none selected
  if (!get().selectedModel && results.length > 0) {
    const defaultProvider = providers.find((p) => p.isDefault) ?? providers[0];
    const defaultModel = results.find(
      (m) => m.providerId === defaultProvider?.id,
    );
    if (defaultModel) set({ selectedModel: defaultModel });
  }
};
```

Model fetch is triggered:

- On app startup (after `init()`) in the background [FR-LLM-007]
- When user opens `SettingsSheet` [FR-LLM-009]
- When a provider is added/updated [FR-LLM-009]

---

## 6. Database Design

### 6.1 Schema

All migrations run via `invoke('run_migrations')` on startup. Migration files are embedded in the Rust binary using `include_str!()`.

```sql
-- src-tauri/src/commands/db.rs (migrations embedded as strings)

PRAGMA journal_mode=WAL;         -- [NFR-011] durability
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS projects (
  id          TEXT PRIMARY KEY,               -- UUID [FR-PRJ-001]
  name        TEXT UNIQUE NOT NULL,           -- [BR-PRJ-003]
  folder_path TEXT NOT NULL,                  -- [FR-PRJ-004]
  created_at  INTEGER NOT NULL,               -- Unix ms
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  id          TEXT PRIMARY KEY,               -- UUID [FR-CHT-001]
  project_id  TEXT NOT NULL
              REFERENCES projects(id) ON DELETE CASCADE,
  title       TEXT,                           -- [FR-CHT-002]
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_conv_project
  ON conversations(project_id, updated_at DESC);  -- [BR-CHT-003]

CREATE TABLE IF NOT EXISTS messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL
                  REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content         TEXT NOT NULL,
  sequence_order  INTEGER NOT NULL,
  created_at      INTEGER NOT NULL,
  UNIQUE(conversation_id, sequence_order)
);
CREATE INDEX IF NOT EXISTS idx_msg_conv
  ON messages(conversation_id, sequence_order);

CREATE TABLE IF NOT EXISTS artifacts (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL
                  REFERENCES conversations(id) ON DELETE CASCADE,
  message_id      TEXT
                  REFERENCES messages(id) ON DELETE SET NULL,
  title           TEXT,
  content         TEXT NOT NULL DEFAULT '',   -- markdown [FR-EDT-001]
  file_path       TEXT,                       -- relative path [BR-EDT-003]
  file_hash       TEXT,                       -- SHA-256 [FR-EDT-011]
  version         INTEGER NOT NULL DEFAULT 1, -- [BR-CHT-001]
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_art_conv
  ON artifacts(conversation_id, version);

CREATE TABLE IF NOT EXISTS llm_providers (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  provider_type TEXT NOT NULL,              -- [BR-LLM-002]
  base_url      TEXT NOT NULL,
  api_key       TEXT,                       -- plaintext [A-003, NFR-005]
  is_default    INTEGER NOT NULL DEFAULT 0, -- boolean
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL                       -- JSON-encoded
);
```

### 6.2 Default Settings (Bundled YAML)

```yaml
# src-tauri/resources/default-config.yaml
settings:
  - key: theme
    value: '"system"'
  - key: approval_mode
    value: '"manual"'
  - key: editor_autosave_interval_ms
    value: "1000"
```

Loaded by `run_migrations` Rust command if `app_settings` table is empty.

### 6.3 `db.ts` — Typed Query Helpers

```typescript
// src/lib/db.ts
import Database from "@tauri-apps/plugin-sql";

let _db: Database | null = null;

async function getDb(): Promise<Database> {
  if (!_db) _db = await Database.load("sqlite:app_data.db");
  return _db;
}

// Example helpers (all stores use these — never raw SQL in stores):
export const db = {
  // Projects
  getAllProjects: () =>
    getDb().then((d) =>
      d.select<Project[]>("SELECT * FROM projects ORDER BY updated_at DESC"),
    ),
  insertProject: (p: Project) =>
    getDb().then((d) =>
      d.execute(
        "INSERT INTO projects (id,name,folder_path,created_at,updated_at) VALUES (?,?,?,?,?)",
        [p.id, p.name, p.folderPath, p.createdAt, p.updatedAt],
      ),
    ),
  // ... full set for all entities

  // Settings
  getSetting: async (key: string): Promise<string | null> => {
    const rows = await (
      await getDb()
    ).select<{ value: string }[]>(
      "SELECT value FROM app_settings WHERE key=?",
      [key],
    );
    return rows[0]?.value ?? null;
  },
  setSetting: (key: string, value: string) =>
    getDb().then((d) =>
      d.execute(
        "INSERT OR REPLACE INTO app_settings (key,value) VALUES (?,?)",
        [key, value],
      ),
    ),
};
```

---

## 7. Routing

### 7.1 Route Tree

```typescript
// src/router.tsx
import { createBrowserRouter, RouterProvider, Outlet } from 'react-router';

export const router = createBrowserRouter([
  {
    element: <AppShell><Outlet /></AppShell>,
    children: [
      {
        path: '/loading',
        element: <LoadingPage />,
      },
      {
        path: '/setup',
        element: <SetupPage />,
      },
      {
        path: '/',
        loader: () => useProjectStore.getState().loadAll(),
        element: <HomePage />,
      },
      {
        path: '/projects/:projectId',
        loader: async ({ params }) => {
          useProjectStore.getState().setActive(params.projectId!);
          await useConversationStore.getState().loadForProject(params.projectId!);
          return null;
        },
        element: <ProjectPage />,
      },
      {
        path: '/projects/:projectId/chats/:chatId',
        loader: async ({ params }) => {
          useConversationStore.getState().setActive(params.chatId!);
          await useMessageStore.getState().loadForConversation(params.chatId!);
          await useArtifactStore.getState().loadForConversation(params.chatId!);
          return null;
        },
        element: <ChatPage />,
      },
    ],
  },
]);

// src/App.tsx
export default function App() {
  const init = useAppStore(s => s.init);
  useEffect(() => { init(); }, []); // single root-level init
  return <RouterProvider router={router} />;
}
```

**Loading state during navigation** — use React Router's built-in `useNavigation()` in `AppShell` for a top-of-page progress indicator, and store-level `isLoading` flags for per-route skeleton screens:

```typescript
// src/components/layout/AppShell.tsx
function AppShell({ children }: { children: React.ReactNode }) {
  const { state } = useNavigation(); // 'idle' | 'loading' | 'submitting'
  return (
    <>
      {state === 'loading' && <ProgressBar />}
      {children}
    </>
  );
}

// src/pages/ChatPage.tsx — loading return node pattern
export default function ChatPage() {
  const isLoading = useMessageStore(s => s.isLoading);
  if (isLoading) return <ChatSkeleton />;  // ← loading return node
  return <ChatLayout />;
}
```

### 7.2 No-useEffect Pattern Summary

| Concern                | Solution                                            | Where               |
| ---------------------- | --------------------------------------------------- | ------------------- |
| App initialization     | Single `useEffect` in `App.tsx` → `appStore.init()` | `App.tsx`           |
| Data on route change   | React Router v7 `loader` → store actions            | `router.tsx`        |
| Cross-store reactivity | `zustand.subscribe()` in store file                 | Each store          |
| Theme DOM sync         | Called inside store action                          | `app.store.ts`      |
| WebSocket events       | `ws.onmessage` inside store action                  | `sidecar.store.ts`  |
| Editor auto-save       | `setTimeout` inside store action                    | `artifact.store.ts` |
| Sidecar health poll    | `while` loop inside store action                    | `app.store.ts`      |
| External file change   | Checked in route loader / `setActiveArtifact`       | `artifact.store.ts` |

**Rule:** No component may import `useEffect` except `App.tsx` and `EditorPanel.tsx` (the latter uses `useEditor` from TipTap which is a controlled hook, not a side-effect hook).

### 7.3 Re-render Minimization

```typescript
// Use primitive selectors wherever possible
const isStreaming = useMessageStore((s) => s.isStreaming); // ✓
const { isStreaming } = useMessageStore(); // ✗ (re-renders on any change)

// Use useShallow for object/array selectors
import { useShallow } from "zustand/react/shallow";
const { name, folderPath } = useProjectStore(
  useShallow((s) => ({
    name: s.activeProject?.name,
    folderPath: s.activeProject?.folderPath,
  })),
);

// Message list: subscribe to IDs only, fetch content by ID
const messageIds = useMessageStore(
  (s) => s.messagesByConversation[convId]?.map((m) => m.id) ?? [],
);
// Each MessageBubble subscribes to its own message by ID
```

---

## 8. Tauri Commands Reference

All commands are `async` Rust functions registered in `lib.rs` via `.invoke_handler(tauri::generate_handler![...])`.

### 8.1 Database Commands (`commands/db.rs`)

| Command                                                  | Signature                 | Purpose                                                                           |
| -------------------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------- |
| `run_migrations`                                         | `() → Result<(), String>` | Run SQL migrations + load default config                                          |
| (DB access via `@tauri-apps/plugin-sql` JS API directly) | —                         | All CRUD goes through `db.ts` helpers, no custom Rust commands needed for queries |

### 8.2 Sidecar Commands (`commands/sidecar.rs`)

| Command            | Signature                                | Purpose                             |
| ------------------ | ---------------------------------------- | ----------------------------------- |
| `start_sidecar`    | `(app: AppHandle) → Result<u16, String>` | Spawn sidecar, return assigned port |
| `stop_sidecar`     | `(app: AppHandle) → Result<(), String>`  | Kill sidecar process                |
| `get_sidecar_port` | `(app: AppHandle) → Result<u16, String>` | Return currently assigned port      |

**Port assignment:** In production, pick an available port using `TcpListener::bind("127.0.0.1:0")`, extract the port, release the socket, then pass `--port {port}` as sidecar arg. In development (`#[cfg(debug_assertions)]`), use fixed port `8765` (constant in `constants.ts`).

Tauri manages sidecar process handle in `AppState<Mutex<Option<CommandChild>>>`. The sidecar binary is declared in `tauri.conf.json`:

```json
{
  "bundle": {
    "externalBin": ["binaries/ai-colab-sidecar"]
  }
}
```

Sidecar `onClose` event emitted via Tauri event: `app.emit("sidecar-exited", ())`.

### 8.3 File System Commands (`commands/fs.rs`)

| Command       | Signature                                              | Purpose                     |
| ------------- | ------------------------------------------------------ | --------------------------- |
| `read_file`   | `(path: String) → Result<String, String>`              | Read text file              |
| `write_file`  | `(path: String, content: String) → Result<(), String>` | Write text file             |
| `file_exists` | `(path: String) → Result<bool, String>`                | Check path exists           |
| `file_hash`   | `(path: String) → Result<String, String>`              | SHA-256 hex of file content |

### 8.4 System Commands (`commands/system.rs`)

| Command              | Signature                             | Purpose                          |
| -------------------- | ------------------------------------- | -------------------------------- |
| `get_os_username`    | `() → Result<String, String>`         | OS user's display name           |
| `get_os_avatar_path` | `() → Result<Option<String>, String>` | Path to user avatar if available |

### 8.5 Window Commands (`commands/window.rs`)

| Command             | Signature                               | Purpose             |
| ------------------- | --------------------------------------- | ------------------- |
| `resize_to_main`    | `(window: Window) → Result<(), String>` | 1200×800, resizable |
| `resize_to_loading` | `(window: Window) → Result<(), String>` | 600×600, fixed      |

---

## 9. Non-Functional Implementation

### 9.1 Performance [NFR-001, NFR-002, NFR-003]

- **Re-renders:** Zustand slice selectors + `useShallow` (documented in §7.3). Message list uses the shadcn `ScrollArea` component (backed by Base UI) with manual `scrollIntoView` on new messages.
- **Auto-save:** 1 s debounce in store action — no DB writes during active typing [NFR-003].
- **Streaming:** `appendChunk` uses `set(s => ({ streamingContent: s.streamingContent + chunk }))` — O(n) per chunk. For very long responses, switch to a ref-based approach with a flush interval of 16 ms.
- **TipTap content updates:** Use `editor.commands.setContent(content, false)` (second arg disables history emission) when loading new artifact.

### 9.2 Security [NFR-005, NFR-006]

- **API keys:** Stored in SQLite plaintext per A-003. Future: migrate to `@tauri-apps/plugin-stronghold` or OS keychain.
- **Sidecar access:** WebSocket only on `127.0.0.1` (loopback). No external network exposure.
- **File access scope:** AI file operations restricted to project folder via `BR-AI-003`. Tauri `fs` plugin capabilities scoped to `$HOME` and app data directories.
- **No telemetry:** Zero outbound requests except explicit LLM API calls and user-initiated web access [NFR-006].
- **Input sanitization:** All user inputs validated with Zod schemas before store persistence.

### 9.3 Observability [NFR-011]

- SQLite WAL mode enabled (`PRAGMA journal_mode=WAL`) [NFR-011].
- Console logging structured as `{ level, module, message, data }` in development. Suppressed in production builds.
- No external logging or telemetry.

### 9.4 Offline Support [NFR-004]

- All features except cloud LLM API calls work offline.
- Model list cached in `app_settings` table; stale cache used if provider unreachable.
- Sidecar WebSocket on localhost — unaffected by network state.

---

## 10. Configuration & Environment

### 10.1 Environment Variables

| Variable                    | Description                    | Required   | Default |
| --------------------------- | ------------------------------ | ---------- | ------- |
| `VITE_DEV_SIDECAR_PORT`     | Fixed sidecar port in dev mode | No         | `8765`  |
| `TAURI_SIGNING_PRIVATE_KEY` | Code signing key               | Build only | —       |

### 10.2 `constants.ts`

```typescript
// src/lib/constants.ts
export const DEV_SIDECAR_PORT = Number(
  import.meta.env.VITE_DEV_SIDECAR_PORT ?? 8765,
);
export const DB_NAME = "app_data.db";
export const AUTOSAVE_DEBOUNCE_MS = 1000;
export const SIDECAR_HEALTH_TIMEOUT_MS = 30_000;
export const SIDECAR_HEALTH_POLL_INTERVAL_MS = 500;
export const MODEL_REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 min
```

### 10.3 `tauri.conf.json` Key Sections

```json
{
  "productName": "AI CoLab",
  "identifier": "io.aicolab.app",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:1420"
  },
  "bundle": {
    "externalBin": ["binaries/ai-colab-sidecar"],
    "resources": ["resources/default-config.yaml"]
  }
}
```

---

## 11. Testing Strategy

### 11.1 Unit Tests (Vitest)

Test files co-located: `src/stores/__tests__/`, `src/lib/__tests__/`.

**What to test per module:**

| Module                  | Test targets                                                   |
| ----------------------- | -------------------------------------------------------------- |
| `app.store.ts`          | `init()` phases, theme application, crash recovery logic       |
| `project.store.ts`      | Create/rename/delete, duplicate name error, folder validation  |
| `conversation.store.ts` | Create with empty artifact, delete cascade, ordering           |
| `message.store.ts`      | `appendChunk` accumulation, `finalizeMessage` state reset      |
| `artifact.store.ts`     | Auto-save debounce, `applyAiArtifact` version increment        |
| `sidecar.store.ts`      | `_dispatch` routing for all message types, HITL auto vs manual |
| `settings.store.ts`     | Provider CRUD, model fetch success/failure                     |
| `db.ts`                 | SQL helper return types (using in-memory SQLite mock)          |
| `utils.ts`              | `pollSidecarHealth`, `debounce`, `generateId`, `cn`            |

**Mocking strategy:**

- Tauri `invoke` calls: mock via `vi.mock('@tauri-apps/api/core', ...)`
- WebSocket: use `vi.fn()` + a mock `WebSocket` class
- `@tauri-apps/plugin-sql`: mock `Database.load` to return in-memory SQLite or a fake

### 11.2 Integration Tests (Vitest + real SQLite)

Location: `tests/integration/db/`

- Run against a real SQLite file in a temp directory
- Test all `db.ts` helpers: insert, select, update, delete, FK cascade
- Test migration idempotency (run `run_migrations` twice)
- Test WAL mode is active after migration

### 11.3 Component Tests (React Testing Library)

- `ChatInput`: typing + submit calls `sidecaStore.sendChatRequest`
- `MessageBubble`: renders user vs assistant styles correctly
- `HitlConfirmation`: approve/reject calls correct store action
- `ProjectForm`: validation errors shown for duplicate name
- `ProviderForm`: required fields enforced

### 11.4 End-to-End Tests (Playwright)

Location: `tests/e2e/flows/`

| Flow               | Steps                                                                     |
| ------------------ | ------------------------------------------------------------------------- |
| First-run setup    | Launch app → see loading → see setup form → fill name → navigate to home  |
| Create project     | Home → New Project → fill name + folder → project appears in list         |
| Start conversation | Open project → New Chat → type message → (mock sidecar) → see streaming   |
| Editor auto-save   | Type in editor → wait 1.1s → reload app → content preserved               |
| Theme toggle       | Open settings → toggle dark mode → DOM class changes → persists on reload |

---

## 12. Implementation Plan

### Phase 1: Foundation

| #   | Task                                                                     | Files                                                                     | Satisfies        | Deps |
| --- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------- | ---------------- | ---- |
| 1   | Scaffold Tauri v2 + React + TypeScript + Vite                            | `package.json`, `tsconfig.json`, `vite.config.ts`, `src-tauri/Cargo.toml` | TC-001, TC-002   | —    |
| 2   | Configure Tailwind v4 + globals.css theme tokens                         | `tailwind.config.ts`, `src/styles/globals.css`                            | FR-SYS-006       | 1    |
| 3   | Install + configure React Router v7; create route tree with all 5 routes | `src/router.tsx`, `src/pages/*`                                           | —                | 1    |
| 4   | Implement SQLite schema + WAL migration in Rust; `db.ts` typed helpers   | `commands/db.rs`, `src/lib/db.ts`                                         | INT-006, NFR-011 | 1    |
| 5   | Implement Tauri Rust commands: window, system, fs                        | `commands/window.rs`, `commands/system.rs`, `commands/fs.rs`              | FR-SYS-001       | 1    |

### Phase 2: Startup & Onboarding

| #   | Task                                                                       | Files                                                            | Satisfies                          | Deps |
| --- | -------------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------- | ---- |
| 6   | `app.store.ts`: full init() state machine, theme actions                   | `stores/app.store.ts`                                            | FR-SYS-002, FR-SYS-006, FR-SYS-007 | 4, 5 |
| 7   | Sidecar spawn Rust command (dynamic port in prod, fixed in dev)            | `commands/sidecar.rs`, `tauri.conf.json`                         | FR-SYS-002, FR-SYS-005             | 1    |
| 8   | `LoadingPage`: 600×600 animation; wire to `app.store.startupPhase`         | `pages/LoadingPage.tsx`, `components/loading/LoadingScreen.tsx`  | NFR-010                            | 6    |
| 9   | `SetupPage` + `SetupWizard`: name/avatar form; `completeSetup()` action    | `pages/SetupPage.tsx`, `components/setup/SetupWizard.tsx`        | FR-LLM-004, FR-SYS-001             | 6    |
| 10  | `AppShell` + `TopBar`: breadcrumb nav, avatar trigger, settings sheet slot | `components/layout/AppShell.tsx`, `components/layout/TopBar.tsx` | —                                  | 3, 6 |

### Phase 3: Project Management

| #   | Task                                                       | Files                                                     | Satisfies                           | Deps |
| --- | ---------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------- | ---- |
| 11  | `project.store.ts`: all actions + DB calls                 | `stores/project.store.ts`                                 | FR-PRJ-001–006                      | 4    |
| 12  | `HomePage` + `ProjectList` + `ProjectCard`                 | `pages/HomePage.tsx`, `components/projects/*`             | FR-PRJ-005                          | 11   |
| 13  | `ProjectForm` modal: create + rename with validation       | `components/projects/ProjectForm.tsx`                     | FR-PRJ-001, FR-PRJ-002, ERR-PRJ-002 | 11   |
| 14  | Folder picker integration + folder access check on load    | `components/projects/ProjectForm.tsx`, `project.store.ts` | FR-PRJ-004, ERR-PRJ-001             | 11   |
| 15  | `ProjectPage`: project overview, conversation list sidebar | `pages/ProjectPage.tsx`                                   | FR-PRJ-005                          | 11   |

### Phase 4: Conversations & Messages

| #   | Task                                                                  | Files                                                  | Satisfies                          | Deps   |
| --- | --------------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------- | ------ |
| 16  | `conversation.store.ts` + DB calls                                    | `stores/conversation.store.ts`                         | FR-CHT-001, FR-CHT-006             | 4      |
| 17  | `message.store.ts` with streaming state                               | `stores/message.store.ts`                              | FR-CHT-002, FR-CHT-003             | 4      |
| 18  | `ConversationSidebar` + new/delete conversation actions               | `components/chat/ConversationSidebar.tsx`              | FR-CHT-001, FR-CHT-009, FR-CHT-010 | 16     |
| 19  | `MessageList` + `MessageBubble` (static, no streaming yet)            | `components/chat/MessageList.tsx`, `MessageBubble.tsx` | FR-CHT-002                         | 17     |
| 20  | `ChatInput` component + text selection highlight support              | `components/chat/ChatInput.tsx`                        | FR-CHT-005                         | 17     |
| 21  | `ChatLayout`: split pane layout (sidebar + chat + editor placeholder) | `components/chat/ChatLayout.tsx`                       | —                                  | 18, 19 |

### Phase 5: Editor

| #   | Task                                                              | Files                                                       | Satisfies              | Deps |
| --- | ----------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------- | ---- |
| 22  | `artifact.store.ts`: load, setActive, save, linkToDisk            | `stores/artifact.store.ts`                                  | FR-EDT-008, FR-EDT-010 | 4    |
| 23  | `EditorPanel` + TipTap init with all extensions                   | `components/editor/EditorPanel.tsx`, `src/lib/constants.ts` | FR-EDT-001–007         | 22   |
| 24  | `EditorToolbar`: formatting buttons wired to TipTap commands      | `components/editor/EditorToolbar.tsx`                       | FR-EDT-002             | 23   |
| 25  | Auto-save debounce + `onContentChange` action                     | `stores/artifact.store.ts`                                  | FR-EDT-008, NFR-003    | 23   |
| 26  | External file change detection + reload banner                    | `stores/artifact.store.ts`, `EditorPanel.tsx`               | FR-EDT-011             | 22   |
| 27  | `ArtifactTabs`: tab strip for multiple artifacts per conversation | `components/editor/ArtifactTabs.tsx`                        | FR-CHT-008             | 22   |

### Phase 6: AI Integration

| #   | Task                                                               | Files                                                      | Satisfies               | Deps   |
| --- | ------------------------------------------------------------------ | ---------------------------------------------------------- | ----------------------- | ------ |
| 28  | `sidecar.store.ts`: WebSocket connect/disconnect, message dispatch | `stores/sidecar.store.ts`                                  | INT-001                 | 6, 7   |
| 29  | Streaming message rendering: `StreamingMessage` component          | `components/chat/StreamingMessage.tsx`                     | FR-CHT-003              | 17, 28 |
| 30  | Full chat request flow: input → store → WS → stream → finalize     | `stores/sidecar.store.ts`, `stores/message.store.ts`       | FR-CHT-003, FR-CHT-006  | 28, 29 |
| 31  | `applyAiArtifact`: create new artifact version from AI response    | `stores/artifact.store.ts`                                 | FR-CHT-008, BR-CHT-001  | 22, 28 |
| 32  | `HitlConfirmation` dialog + HITL flow in sidecar store             | `components/chat/HitlConfirmation.tsx`, `sidecar.store.ts` | FR-AI-004, BR-AI-005    | 28     |
| 33  | Sidecar crash recovery: `_onSidecarCrash`, restart + reconnect     | `stores/app.store.ts`, `stores/sidecar.store.ts`           | FR-SYS-003, ERR-SYS-001 | 28     |

### Phase 7: LLM Settings

| #   | Task                                                         | Files                                   | Satisfies              | Deps |
| --- | ------------------------------------------------------------ | --------------------------------------- | ---------------------- | ---- |
| 34  | `settings.store.ts`: provider CRUD + model fetch             | `stores/settings.store.ts`              | FR-LLM-001–009         | 4    |
| 35  | `SettingsSheet` slide-over + `ProviderList` + `ProviderForm` | `components/settings/*`                 | FR-LLM-001, FR-LLM-005 | 34   |
| 36  | `ModelSelector` dropdown in `TopBar` or `ChatInput`          | `components/settings/ModelSelector.tsx` | FR-LLM-008             | 34   |
| 37  | `UserProfile` edit form in `SettingsSheet`                   | `components/settings/UserProfile.tsx`   | FR-SYS-001             | 34   |

### Phase 8: Polish & Tests

| #   | Task                                                        | Files                                  | Satisfies  | Deps       |
| --- | ----------------------------------------------------------- | -------------------------------------- | ---------- | ---------- |
| 38  | Theme toggle in settings; persist to `app_settings`         | `stores/app.store.ts`, `SettingsSheet` | FR-SYS-006 | 6          |
| 39  | Error boundaries + Toast notifications for all ERR-\* cases | `components/ui/Toast.tsx`              | ERR-\*     | All        |
| 40  | Unit tests for all stores                                   | `src/stores/__tests__/*`               | —          | All stores |
| 41  | Integration tests for DB helpers                            | `tests/integration/db/*`               | NFR-011    | 4          |
| 42  | E2E tests: first-run, create project, chat flow, theme      | `tests/e2e/flows/*`                    | —          | All        |
| 43  | Cross-platform build validation (macOS, Windows, Linux)     | CI config                              | NFR-007    | All        |

---

## 13. Requirement Traceability Matrix

| Requirement ID | SPEC.md Section(s)                                | Status                                                                    |
| -------------- | ------------------------------------------------- | ------------------------------------------------------------------------- |
| FR-PRJ-001     | 5.2, 6.1, 12 Ph3                                  | Covered                                                                   |
| FR-PRJ-002     | 5.2, 12 Ph3                                       | Covered                                                                   |
| FR-PRJ-003     | 5.2.3, 6.1                                        | Covered                                                                   |
| FR-PRJ-004     | 5.2.2, 5.2.4, 12 Ph3                              | Covered                                                                   |
| FR-PRJ-005     | 5.2, 7.1, 12 Ph3                                  | Covered                                                                   |
| FR-PRJ-006     | 6.1 (app_settings), 5.2.2                         | Covered                                                                   |
| FR-EDT-001     | 5.4.4                                             | Covered                                                                   |
| FR-EDT-002     | 5.4.5                                             | Covered                                                                   |
| FR-EDT-003     | 5.4.5                                             | Covered                                                                   |
| FR-EDT-004     | 5.4.5 (note)                                      | Deferred — Could priority, community extension                            |
| FR-EDT-005     | 5.4.5                                             | Covered                                                                   |
| FR-EDT-006     | 5.4.5                                             | Covered                                                                   |
| FR-EDT-007     | 5.4.5                                             | Covered                                                                   |
| FR-EDT-008     | 5.4.3, 5.4.2                                      | Covered                                                                   |
| FR-EDT-009     | 5.4.2 (`setActiveArtifact`), 5.4                  | Covered                                                                   |
| FR-EDT-010     | 5.4.3                                             | Covered                                                                   |
| FR-EDT-011     | 5.4.6                                             | Covered                                                                   |
| FR-EDT-012     | —                                                 | Deferred — Could priority; implement as TipTap `Decoration` after Phase 6 |
| FR-CHT-001     | 5.3, 7.1                                          | Covered                                                                   |
| FR-CHT-002     | 5.3.1, 5.3.3                                      | Covered                                                                   |
| FR-CHT-003     | 5.3.4, 5.5.3, 12 Ph6                              | Covered                                                                   |
| FR-CHT-004     | 5.3.4                                             | Covered                                                                   |
| FR-CHT-005     | 5.5.4 (TextHighlight), 12 Ph4                     | Covered                                                                   |
| FR-CHT-006     | 5.3.2, 6.1                                        | Covered                                                                   |
| FR-CHT-007     | 7.1 (chatRoute loader)                            | Covered                                                                   |
| FR-CHT-008     | 5.5.3 (`applyAiArtifact`), 5.4.2                  | Covered                                                                   |
| FR-CHT-009     | 5.3.2 (`create`)                                  | Covered                                                                   |
| FR-CHT-010     | 5.3.2 (`delete`)                                  | Covered                                                                   |
| FR-LLM-001     | 5.6.2                                             | Covered                                                                   |
| FR-LLM-002     | 5.6.1, 5.6.2                                      | Covered                                                                   |
| FR-LLM-003     | 5.6.2 (`apiKey: null`)                            | Covered                                                                   |
| FR-LLM-004     | 5.1.2, 12 Ph2                                     | Covered                                                                   |
| FR-LLM-005     | 5.6.2, 12 Ph7                                     | Covered                                                                   |
| FR-LLM-006     | 6.1 (`llm_providers`)                             | Covered                                                                   |
| FR-LLM-007     | 5.6.3                                             | Covered                                                                   |
| FR-LLM-008     | 5.6.2, 12 Ph7                                     | Covered                                                                   |
| FR-LLM-009     | 5.6.3                                             | Covered                                                                   |
| FR-AI-001      | 5.5.4 (`workingFolder`)                           | Covered (sidecar implements)                                              |
| FR-AI-002      | 5.5.4                                             | Covered (sidecar implements)                                              |
| FR-AI-003      | 5.5.4 (`knowledgeHubs`)                           | Covered (sidecar implements)                                              |
| FR-AI-004      | 5.5.5                                             | Covered                                                                   |
| FR-AI-005      | 5.5.4                                             | Covered (sidecar implements)                                              |
| FR-AI-006      | 5.5.4 (`knowledgeHubs`)                           | Covered (sidecar implements)                                              |
| FR-AI-007      | 5.5 (frontend is action-agnostic via WS protocol) | Covered                                                                   |
| FR-AI-008      | —                                                 | Sidecar responsibility; out of scope for this spec                        |
| FR-SYS-001     | 5.1.2, 8.4                                        | Covered                                                                   |
| FR-SYS-002     | 5.1.2, 8.2                                        | Covered                                                                   |
| FR-SYS-003     | 5.1.4                                             | Covered                                                                   |
| FR-SYS-004     | 5.1.2 (`pollSidecarHealth` throws)                | Covered                                                                   |
| FR-SYS-005     | 8.2 (port strategy)                               | Covered                                                                   |
| FR-SYS-006     | 5.1.6, 9.1                                        | Covered                                                                   |
| FR-SYS-007     | 5.1.2 (OS theme detection)                        | Covered                                                                   |
| NFR-001        | 7.3, 9.1                                          | Covered                                                                   |
| NFR-002        | 5.5.3 (streaming dispatch)                        | Covered (sidecar latency is external)                                     |
| NFR-003        | 5.4.3 (debounced save)                            | Covered                                                                   |
| NFR-004        | 9.4                                               | Covered                                                                   |
| NFR-005        | 9.2                                               | Covered                                                                   |
| NFR-006        | 9.2                                               | Covered                                                                   |
| NFR-007        | 3.0, 12 Ph8                                       | Covered                                                                   |
| NFR-008        | 3.1 (all MIT deps)                                | Covered                                                                   |
| NFR-009        | 5.4.5 (extension list, additive)                  | Covered                                                                   |
| NFR-010        | 5.1, 8.2                                          | Covered                                                                   |
| NFR-011        | 6.1 (WAL mode), 9.3                               | Covered                                                                   |
| INT-001        | 5.5                                               | Covered                                                                   |
| INT-002        | —                                                 | Sidecar internal; out of scope                                            |
| INT-003        | —                                                 | Sidecar internal; out of scope                                            |
| INT-004        | —                                                 | Sidecar responsibility                                                    |
| INT-005        | 8.3                                               | Covered                                                                   |
| INT-006        | 6.1, 8.1, `db.ts`                                 | Covered                                                                   |

---

## 14. Architectural Decision Records

### ADR-001: React Router v7 over TanStack Router

- **Context:** Need route-level data loading to eliminate `useEffect` for data fetching in components. Initial spec used TanStack Router for its type safety, but this app has only 5 routes with simple string params and loaders that return `null` (data lives in Zustand stores, not in loader return values). TanStack Router's type-inference advantage is only realized when components call `useLoaderData()` — which this architecture never does.
- **Decision:** React Router v7 with `loader` functions per route. Loaders call store actions and return `null`; components read state from Zustand stores. Navigation loading state exposed via `useNavigation()` for a progress indicator in `AppShell`. Per-route loading skeletons driven by store `isLoading` flags ("loading return node" pattern).
- **Alternatives considered:** TanStack Router v1 — superior TypeScript, but zero advantage given the store-centric data model. Manual `useEffect` fetch — rejected, introduces race conditions and loading state complexity in components.
- **Consequences:** Industry-standard API; lower learning curve for open-source contributors (OC-001); `useNavigation()` replaces TanStack's `pendingComponent` with equivalent capability.
- **Satisfies:** TC-002, NFR-001

### ADR-002: All DB access via `@tauri-apps/plugin-sql` JS API, not custom Rust commands

- **Context:** Tauri SQL plugin exposes a JS API directly. Wrapping every query in a Rust command adds boilerplate with no benefit for a local, trusted SQLite.
- **Decision:** `db.ts` typed helpers call the plugin directly; only schema migration uses a Rust command.
- **Consequences:** DB access is in JS layer only; Rust is only needed for sidecar, window, fs, system commands.
- **Satisfies:** INT-006

### ADR-003: Single WebSocket per session, not per request

- **Context:** Streaming requires a persistent connection. FastAPI WebSocket endpoint on sidecar is persistent.
- **Decision:** One WebSocket opened at app startup, kept alive; reconnects on sidecar restart.
- **Consequences:** Must handle multiplexing carefully if concurrent requests are ever needed (deferred).
- **Satisfies:** INT-001, NFR-001

### ADR-004: Markdown as canonical artifact format, TipTap `tiptap-markdown` for serialization

- **Context:** Artifacts must be loadable into the editor and optionally saved as `.md` files. TipTap's internal format is ProseMirror JSON.
- **Decision:** Store and sync markdown text; use `tiptap-markdown` extension to parse/serialize. TipTap JSON is ephemeral in the editor only.
- **Consequences:** Some TipTap features (e.g., fine-grained undo across sessions) not preserved; markdown round-trips may lose formatting edge cases.
- **Satisfies:** FR-EDT-010, TC-003

### ADR-005: `EditorPanel` is the only component using TipTap's `useEditor` hook

- **Context:** `useEditor` is a React hook that must be called in a component. But the artifact store needs to call editor commands (for AI-applied changes).
- **Decision:** `EditorPanel` owns the `useEditor` call and immediately registers the instance in `artifactStore` via `setEditorInstance`. Store actions then call `editorInstance.commands.*` directly.
- **Consequences:** Tight coupling between store and TipTap API; acceptable since TipTap is a fixed dependency.
- **Satisfies:** TC-003, TC-004

---

## 15. Appendices

### A. FastAPI WebSocket Contract

The sidecar communicates exclusively over WebSocket. The full schema is defined in `fastapi-schemas.py`. Summary for the frontend:

**Outbound frame (frontend → sidecar):**

```typescript
// Chat request
type OutboundMessage =
  | ChatCompletionRequest
  | { type: "confirmation"; payload: { approved: boolean } };

interface ChatCompletionRequest {
  message: string;
  chatHistory: Array<{
    role: "user" | "assistant" | "system";
    content: string;
  }>;
  workingFolder?: string;
  fileUploads?: string[];
  knowledgeHubs?: string[];
}
```

**Inbound frames (sidecar → frontend):**

```typescript
interface DefaultResponse {
  type:
    | "completion.chunk" // content: string token
    | "completion.chunk.thinking" // content: string (reasoning)
    | "completion.response" // content: full response; payload may include artifact
    | "completion.usage" // payload: { prompt_tokens, completion_tokens }
    | "completion.sources" // payload: source citations
    | "completion.hitl.request" // payload: HitlRequest (action requiring approval)
    | "event" // payload: EmbeddingProgress | generic event
    | "confirmation" // payload: confirmation echo
    | "error"; // content: error message
  payload?: unknown;
  content?: string | number;
}
```

### B. Default Configuration YAML

```yaml
# src-tauri/resources/default-config.yaml
settings:
  - key: theme
    value: '"system"'
  - key: approval_mode
    value: '"manual"'
  - key: editor_autosave_interval_ms
    value: "1000"
  - key: sidecar_health_timeout_ms
    value: "30000"
```

### C. Open Items

| Item       | Description                                                                             | Owner                         |
| ---------- | --------------------------------------------------------------------------------------- | ----------------------------- |
| OQ-001     | LlamaIndex workflow tool definitions for MVP sidecar                                    | Project Owner (sidecar scope) |
| FR-EDT-004 | LaTeX/math rendering: evaluate `prosemirror-math` + `katex` wrapper as TipTap extension | Developer                     |
| FR-EDT-012 | AI change highlighting: evaluate TipTap `Decoration` API for marking AI-modified ranges | Developer, after Phase 6      |
| Security   | OS keychain integration for API key storage (deferred per A-003)                        | Future release                |
