# Requirements Specification: AI CoLab

**Version:** 1.1
**Date:** 2026-03-15
**Status:** Draft
**Author:** System Requirements Analyst (AI-assisted)

---

## 1. Overview

### 1.1 Purpose

AI CoLab is a cross-platform desktop application that brings AI-assisted cowork capabilities — currently available only in developer-oriented CLI tools — to knowledge workers managing textual information. It combines a powerful rich-text markdown editor with an AI assistant that can read, analyze, generate, and modify documents within user-defined project folders. By pairing the interaction model of OpenAI Canvas (editor + chat with artifacts) with the agentic file-access capabilities of coding tools like Claude Code, AI CoLab provides a superior environment for textual data management and information processing with AI.

### 1.2 Stakeholders

| Stakeholder Role | Interest / Concern | Involvement Level |
|-----------------|-------------------|-------------------|
| Solo Knowledge Worker (Primary User) | Efficient text/knowledge management with AI assistance | Daily user, primary feedback source |
| Project Owner / Developer | Product vision, architecture decisions, open-source community | Decision maker, implementer |
| Open-Source Contributors | Code quality, extensibility, documentation | Future contributors under MIT license |

### 1.3 Scope

#### In Scope

- Desktop application built on Tauri v2 + React
- TipTap-based rich-text markdown editor with extensible plugin support
- AI chat assistant with real-time streaming responses
- Project management (create, rename, delete projects; assign folders)
- Artifact model: AI-generated documents within conversations, loadable into editor
- Document persistence in local SQLite DB with optional sync to `.md` files on disk
- LLM provider configuration (multi-provider via LlamaIndex, Ollama-first)
- Python sidecar (PyInstaller-bundled) running FastAPI + LlamaIndex workflow
- ChromaDB for indexing non-markdown files (PDF, EPUB, etc.) via LlamaIndex readers; markdown files accessed directly via search/read tools
- Light and dark theme support
- AI tool access: file read/write, system commands, web access
- Cross-platform support: macOS, Windows, Linux
- First-run setup wizard (LLM provider, username detection)
- MIT-licensed open-source distribution

#### Out of Scope

- Multi-user collaboration or real-time co-editing
- Cloud sync or cloud-hosted backend
- Mobile platforms (iOS, Android)
- Conversation branching / forking
- Prompt templates / saved instructions
- Paid or proprietary TipTap plugins
- User authentication or account system
- Telemetry or analytics collection

### 1.4 Definitions & Acronyms

| Term | Definition |
|------|-----------|
| Artifact | A document generated or edited within a conversation, stored in SQLite and optionally linked to a file on disk. Equivalent to "artifact" in OpenCanvas. |
| Conversation | A chat session within a project containing user messages, AI responses, and artifacts. |
| Project | A user-created workspace associated with a filesystem folder, containing conversations and settings. |
| Sidecar | A bundled Python binary (built with PyInstaller) that runs alongside the main Tauri application, hosting the FastAPI server and LlamaIndex workflow. |
| LlamaIndex Workflow | An orchestration layer in the Python sidecar that manages AI actions, tool calls, and RAG retrieval. |
| RAG | Retrieval-Augmented Generation — a technique where relevant documents are retrieved from a vector store and provided as context to the LLM. |
| ChromaDB | A local vector database used for semantic search and RAG over project folder contents. |
| TipTap | An open-source rich-text editor framework for the web, based on ProseMirror. |
| Provider | An LLM service endpoint (e.g., Ollama, OpenAI API, or any compatible API) configured with a base URL and optional API key. |

---

## 2. Users & Personas

### 2.1 Solo Knowledge Worker

- **Description:** An individual who manages personal notes, research, writing, and analytical work. Not primarily a developer. Uses AI to assist with text generation, analysis, summarization, and information processing across document collections.
- **Access Level:** Full access to all application features. Single-user application with no access restrictions.
- **Primary Workflows:**
  1. Create a new project and assign a folder containing working documents
  2. Open a conversation and ask the AI to analyze, summarize, or generate content from project files
  3. Edit AI-generated artifacts in the rich-text editor, refining them iteratively through chat
  4. Save finalized artifacts as `.md` files into the project folder
  5. Return to previous conversations and continue work from where it was left
  6. Configure and switch between LLM providers based on task needs (local Ollama for privacy, cloud API for capability)

---

## 3. Functional Requirements

### 3.1 Project Management

| ID | Requirement | Priority | Acceptance Criteria |
|----|------------|----------|---------------------|
| FR-PRJ-001 | The system shall allow users to create new projects with a user-defined name. | Must | User can create a project, and it appears in the project list. |
| FR-PRJ-002 | The system shall allow users to rename existing projects. | Must | Project name updates in the project list and all references. |
| FR-PRJ-003 | The system shall allow users to delete projects. | Must | Deleted project and its conversations/artifacts are removed from SQLite. Files on disk are not deleted. |
| FR-PRJ-004 | The system shall allow users to assign a filesystem folder to each project. | Must | User can browse and select a folder; the path is stored with the project. |
| FR-PRJ-005 | The system shall display a list of all projects and allow switching between them. | Must | User sees all projects and can switch; the active project's conversations load. |
| FR-PRJ-006 | The system shall support storing project-specific settings in SQLite, with optional export to a dot-directory in the project folder for sharing. | Should | Settings persist across sessions; if exported, a config file exists in `.<appname>/` in the project folder. |

**Business Rules:**

- BR-PRJ-001: A project folder path must point to an existing, accessible directory on the filesystem.
- BR-PRJ-002: Deleting a project shall not delete any files from the associated folder on disk.
- BR-PRJ-003: Each project shall have a unique name within the application.

**Error Handling:**

- ERR-PRJ-001: When a project's assigned folder is no longer accessible (moved, deleted, permissions changed), the system shall display a warning and allow the user to reassign the folder.
- ERR-PRJ-002: When the user attempts to create a project with a duplicate name, the system shall display an error message and prevent creation.

---

### 3.2 Editor

| ID | Requirement | Priority | Acceptance Criteria |
|----|------------|----------|---------------------|
| FR-EDT-001 | The system shall provide a TipTap-based rich-text editor as the primary document editing interface. | Must | Editor renders and allows editing of markdown content with WYSIWYG formatting. |
| FR-EDT-002 | The editor shall support standard markdown formatting: headings (H1–H6), bold, italic, strikethrough, links, images, ordered and unordered lists, blockquotes, and horizontal rules. | Must | All listed formatting types render correctly and can be toggled via toolbar or keyboard shortcuts. |
| FR-EDT-003 | The editor shall support tables with add/remove rows and columns. | Should | User can insert, edit, and delete tables with arbitrary dimensions. |
| FR-EDT-004 | The editor shall support LaTeX/math rendering (inline and block). | Should | LaTeX expressions render as formatted math in the editor. |
| FR-EDT-005 | The editor shall support syntax-highlighted code blocks with language selection. | Should | Code blocks display with syntax highlighting for common languages. |
| FR-EDT-006 | The editor shall support task lists (checkboxes). | Should | Checkboxes render and are toggleable within the editor. |
| FR-EDT-007 | The editor shall support text highlighting (background color). | Should | User can apply and remove highlight to selected text. |
| FR-EDT-008 | The editor shall auto-save content to the SQLite database periodically and on significant changes. | Must | Content is persisted without explicit user action; no data loss on unexpected close. |
| FR-EDT-009 | The editor shall load any artifact from the conversation history when the user clicks on it. | Must | Clicking an artifact in the conversation loads its content into the editor. |
| FR-EDT-010 | The editor shall support optionally linking an artifact to a `.md` file on disk. When linked, saving the artifact updates both the SQLite DB and the file on disk. | Must | Changes to a linked artifact are reflected in both SQLite and the `.md` file. |
| FR-EDT-011 | When opening a linked artifact, the system shall detect if the disk file has been modified externally and prompt the user to reload the newer version. | Should | If the file on disk differs from the DB version, a prompt appears offering to load the disk version. |
| FR-EDT-012 | The editor shall support highlighting changes made by the AI (using free TipTap plugin capabilities). | Could | AI-modified text regions are visually distinguishable from user-written text. |

**Business Rules:**

- BR-EDT-001: Auto-save shall not block or freeze the editor UI.
- BR-EDT-002: Editor plugins (TipTap extensions) shall be MIT-compatible and addable incrementally without architectural changes.
- BR-EDT-003: When an artifact is linked to a disk file, the file path shall be relative to the project folder.

**Error Handling:**

- ERR-EDT-001: When auto-save fails (e.g., DB locked), the system shall retry and display a non-intrusive warning if failures persist.
- ERR-EDT-002: When a linked file cannot be written (permissions, disk full), the system shall display an error and continue saving to SQLite only.

---

### 3.3 Conversations & Chat

| ID | Requirement | Priority | Acceptance Criteria |
|----|------------|----------|---------------------|
| FR-CHT-001 | Each project shall support multiple conversations. | Must | User can create new conversations and see a list of existing ones within a project. |
| FR-CHT-002 | Each conversation shall contain an ordered sequence of messages (user and AI) and zero or more artifacts. | Must | Messages display in chronological order with clear sender attribution. |
| FR-CHT-003 | AI responses shall stream token-by-token in real-time into the chat interface. | Must | User sees progressive text rendering as the AI generates the response. |
| FR-CHT-004 | Each new conversation shall start with an empty artifact loaded in the editor. | Must | Opening a new conversation shows a blank document in the editor. |
| FR-CHT-005 | The user shall be able to select text in the editor and send an instruction to the AI referencing that selection. | Must | Selected text is included as context in the AI request; the AI can act on it. |
| FR-CHT-006 | All conversations, messages, and artifacts shall be persisted in the local SQLite database. | Must | Data survives application restart; user sees the same state as when they left. |
| FR-CHT-007 | Users shall be able to revisit and continue previous conversations. | Must | Selecting a past conversation loads its full message history and last active artifact. |
| FR-CHT-008 | AI-generated artifacts shall be linked to the message that created or modified them. | Must | Each artifact-producing message has a clickable reference to the artifact. |
| FR-CHT-009 | Users shall be able to create new conversations within a project. | Must | A "new conversation" action is available and creates a fresh conversation with an empty artifact. |
| FR-CHT-010 | Users shall be able to delete conversations. | Should | Deleted conversations and their messages/artifacts are removed from SQLite. |

**Business Rules:**

- BR-CHT-001: When an artifact is generated or modified by the AI, a new artifact version is created and linked to the producing message. Previous versions remain accessible via their original messages.
- BR-CHT-002: The currently active artifact in the editor is always sent as context to the AI along with the user's message.
- BR-CHT-003: Conversations shall be listed in reverse chronological order (most recent first) within each project.

**Error Handling:**

- ERR-CHT-001: When the AI response stream is interrupted (sidecar crash, network error), the system shall display the partial response received and show an error message allowing the user to retry.
- ERR-CHT-002: When a message fails to persist to SQLite, the system shall retry and warn the user if the failure persists.

---

### 3.4 AI & LLM Configuration

| ID | Requirement | Priority | Acceptance Criteria |
|----|------------|----------|---------------------|
| FR-LLM-001 | The system shall allow users to configure LLM providers by specifying a base URL and an optional API key. | Must | User can add a provider with URL and key; the configuration is saved and usable. |
| FR-LLM-002 | The system shall support multiple LLM providers simultaneously via the LlamaIndex LLM abstraction. | Must | User can configure more than one provider and select which to use. |
| FR-LLM-003 | The system shall support Ollama as a first-class provider, requiring only a base URL (no API key). | Must | User can configure Ollama by entering its URL; AI requests succeed against a running Ollama instance. |
| FR-LLM-004 | On first run, the system shall present a setup wizard for LLM provider configuration. | Must | First launch shows a setup flow; the user cannot proceed to the main app until at least one provider is configured. |
| FR-LLM-005 | The system shall provide a settings UI to add, edit, and remove LLM providers after initial setup. | Must | Users can modify provider configurations at any time from settings. |
| FR-LLM-006 | LLM provider configurations (base URL, API key, provider type) shall be stored in the local SQLite database. | Must | Configurations persist across sessions. |
| FR-LLM-007 | The system shall query each configured provider's available models (via OpenAI-compatible `/models` endpoint or equivalent) at startup in the background. | Must | Available models are fetched without blocking app startup. |
| FR-LLM-008 | The system shall display available models in a selection UI, allowing the user to choose a specific model from a provider. | Must | User can select e.g., a specific Ollama model or OpenAI model, not just a provider. |
| FR-LLM-009 | The model list shall refresh periodically and on-demand (e.g., when the user opens the model selector or changes provider configuration). | Should | Newly available models appear without app restart. |

**Business Rules:**

- BR-LLM-001: At least one LLM provider must be configured before the application is usable.
- BR-LLM-002: The provider type determines which LlamaIndex LLM class is instantiated (e.g., `llama_index.llms.openai`, `llama_index.llms.ollama`).
- BR-LLM-003: API keys are stored in plaintext in the local SQLite database.

**Error Handling:**

- ERR-LLM-001: When a configured LLM provider is unreachable, the system shall display an error in the chat indicating the provider cannot be contacted.
- ERR-LLM-002: When an API key is invalid or expired, the system shall display the provider's error message to the user.

---

### 3.5 AI Capabilities (LlamaIndex Workflow)

| ID | Requirement | Priority | Acceptance Criteria |
|----|------------|----------|---------------------|
| FR-AI-001 | The AI shall be able to read files from the project's assigned folder. | Must | AI can retrieve and reference content from files in the project folder during conversation. |
| FR-AI-002 | The AI shall be able to write and create files in the project's assigned folder. | Must | AI can create new files or modify existing files in the project folder as instructed. |
| FR-AI-003 | The AI shall be able to cross-reference and synthesize information from multiple documents in the project folder. | Must | AI can answer questions that require information from more than one file. |
| FR-AI-004 | The AI shall be able to execute system commands on the user's machine, subject to the user's chosen approval mode. | Should | AI can run shell commands; user can choose between auto-accept-all mode or approve-one-by-one mode. |
| FR-AI-005 | The AI shall be able to access the internet for web search and URL fetching. | Should | AI can retrieve web content and incorporate it into responses. |
| FR-AI-006 | The system shall maintain a ChromaDB vector store for indexing non-markdown files in the project folder (PDF, EPUB, and other complex formats) using LlamaIndex document readers. Markdown files shall not be vectorized; they shall be accessed via direct file read and search tools. | Must | Non-markdown files are automatically indexed into ChromaDB; AI can query them via semantic search. Markdown files are read/searched directly. |
| FR-AI-007 | The application shall be action-agnostic: AI capabilities are defined by the LlamaIndex workflow and its registered tool calls, not hardcoded in the application. | Must | Adding new AI capabilities requires only changes to the Python sidecar workflow, not the frontend or Tauri backend. |
| FR-AI-008 | The system shall automatically index new or modified non-markdown files in the project folder into ChromaDB. | Should | When a non-markdown file is added or changed in the project folder, it is indexed without manual user action. |

**Business Rules:**

- BR-AI-001: The ChromaDB vector store shall be persisted as a file in the OS-specific application data directory (e.g., `~/Library/Application Support/` on macOS).
- BR-AI-002: Each project shall have its own isolated ChromaDB collection.
- BR-AI-003: File read/write operations by the AI shall be restricted to the project's assigned folder and its subdirectories.
- BR-AI-004: ChromaDB shall only index non-markdown files (PDF, EPUB, DOCX, etc.). Markdown files shall be accessed via direct read and grep/search tools, which are more effective for structured text.
- BR-AI-005: The user shall be able to choose an AI action approval mode: (a) auto-accept all actions, or (b) approve each action individually. This setting applies to file writes, system commands, and other side-effecting actions.

**Error Handling:**

- ERR-AI-001: When the AI attempts to access a file that does not exist or is inaccessible, the workflow shall return an error to the AI so it can inform the user.
- ERR-AI-002: When a system command execution fails, the error output shall be returned to the AI for interpretation and user communication.

---

### 3.6 System & Application Lifecycle

| ID | Requirement | Priority | Acceptance Criteria |
|----|------------|----------|---------------------|
| FR-SYS-001 | The system shall auto-detect the user's name from OS information via Tauri plugins on first run. | Should | The detected username is pre-filled during first-run setup. |
| FR-SYS-002 | The Python sidecar shall start automatically when the application launches. | Must | The sidecar process is running and the FastAPI server is accepting connections before the main UI becomes interactive. |
| FR-SYS-003 | If the Python sidecar crashes during a session, the system shall automatically attempt to restart it. | Must | After a sidecar crash, the system restarts the sidecar and resumes normal operation without requiring app restart. |
| FR-SYS-004 | If the Python sidecar fails to start on application launch, the system shall display an error message to the user. | Must | A clear error message is shown explaining the sidecar failed to initialize. |
| FR-SYS-005 | The sidecar shall use a dynamically assigned port in production builds and a fixed port in development mode. | Must | Production builds avoid port conflicts; development builds use a predictable port. |
| FR-SYS-006 | The application shall support light and dark themes. | Must | User can switch between light and dark mode; the selected theme persists across sessions. |
| FR-SYS-007 | The application should detect the OS theme preference and default to it on first run. | Should | App launches in dark mode if the OS is set to dark mode, and vice versa. |

**Error Handling:**

- ERR-SYS-001: When the sidecar fails to restart after a crash, the system shall display an error and disable AI-dependent features while keeping the editor functional.
- ERR-SYS-002: When the sidecar port is in use (development mode), the system shall display an error with the conflicting port number.

---

## 4. Non-Functional Requirements

| ID | Category | Requirement | Target / Metric |
|----|----------|------------|-----------------|
| NFR-001 | Performance | The application UI shall feel fast and responsive to user interactions. | UI interactions (typing, clicking, scrolling) shall have < 100ms perceived latency. |
| NFR-002 | Performance | AI response streaming shall begin promptly after the user sends a message. | First token visible within 2 seconds of request submission. [ASSUMPTION] |
| NFR-003 | Performance | Auto-save operations shall not degrade editor responsiveness. | Auto-save completes without perceivable UI stutter or input delay. |
| NFR-004 | Availability | The application shall function fully offline when using a local LLM provider (e.g., Ollama). | All features except cloud LLM calls work without internet connectivity. |
| NFR-005 | Security | API keys shall be stored locally in the SQLite database. | Keys are accessible only to the local user via the application's DB file. [ASSUMPTION: OS keychain integration deferred to future version.] |
| NFR-006 | Privacy | All user data shall remain on the local machine. No telemetry, analytics, or cloud synchronization shall be implemented. | Zero network requests except explicit LLM API calls and user-initiated web access. |
| NFR-007 | Platform | The application shall support macOS, Windows, and Linux. | Application builds and runs on all three platforms via Tauri v2. |
| NFR-008 | Licensing | The application and all runtime dependencies shall be compatible with the MIT license. | No GPL, AGPL, or other copyleft runtime dependencies. |
| NFR-009 | Extensibility | The editor plugin architecture (TipTap extensions) shall allow incremental addition of new formatting capabilities without architectural changes. | New TipTap plugins can be added by installing the package and registering the extension. |
| NFR-010 | Startup | The application shall be ready for user interaction within a reasonable time after launch. | Main window visible and editor usable within 5 seconds on modern hardware. [ASSUMPTION] |
| NFR-011 | Data Integrity | The application shall not lose user data (conversations, artifacts, settings) under normal operation, including unexpected application termination. | Auto-saved data is recoverable after crash; SQLite WAL mode or equivalent durability mechanism. |

---

## 5. Data Requirements

### 5.1 Entity Definitions

#### Project

| Attribute | Type | Required | Constraints | Description |
|-----------|------|----------|-------------|-------------|
| id | UUID | Yes | Primary key, system-generated | Unique project identifier. |
| name | String | Yes | Unique, max 255 chars, non-empty | User-defined project name. |
| folder_path | String | Yes | Valid filesystem path | Absolute path to the assigned project folder. |
| created_at | Timestamp | Yes | System-generated | When the project was created. |
| updated_at | Timestamp | Yes | System-generated, auto-updated | When the project was last modified. |

#### Conversation

| Attribute | Type | Required | Constraints | Description |
|-----------|------|----------|-------------|-------------|
| id | UUID | Yes | Primary key, system-generated | Unique conversation identifier. |
| project_id | UUID | Yes | Foreign key → Project | The project this conversation belongs to. |
| title | String | No | Max 255 chars | User-editable or auto-generated conversation title. |
| created_at | Timestamp | Yes | System-generated | When the conversation was created. |
| updated_at | Timestamp | Yes | System-generated, auto-updated | When the conversation was last active. |

#### Message

| Attribute | Type | Required | Constraints | Description |
|-----------|------|----------|-------------|-------------|
| id | UUID | Yes | Primary key, system-generated | Unique message identifier. |
| conversation_id | UUID | Yes | Foreign key → Conversation | The conversation this message belongs to. |
| role | Enum | Yes | "user" or "assistant" | Who sent the message. |
| content | Text | Yes | Non-empty | The message text content. |
| sequence_order | Integer | Yes | Unique within conversation | Position in the conversation. |
| created_at | Timestamp | Yes | System-generated | When the message was sent/received. |

#### Artifact

| Attribute | Type | Required | Constraints | Description |
|-----------|------|----------|-------------|-------------|
| id | UUID | Yes | Primary key, system-generated | Unique artifact identifier. |
| conversation_id | UUID | Yes | Foreign key → Conversation | The conversation this artifact belongs to. |
| message_id | UUID | No | Foreign key → Message | The message that produced this artifact (null for initial empty artifact). |
| title | String | No | Max 255 chars | User-editable artifact title. |
| content | Text | Yes | — | The markdown content of the artifact. |
| file_path | String | No | Relative to project folder | Path to the linked `.md` file on disk, if any. |
| file_hash | String | No | — | Hash of the file content at last sync, for external change detection. |
| version | Integer | Yes | Auto-incremented per conversation | Artifact version number within the conversation. |
| created_at | Timestamp | Yes | System-generated | When the artifact was created. |
| updated_at | Timestamp | Yes | System-generated, auto-updated | When the artifact was last modified. |

#### LLM Provider

| Attribute | Type | Required | Constraints | Description |
|-----------|------|----------|-------------|-------------|
| id | UUID | Yes | Primary key, system-generated | Unique provider identifier. |
| name | String | Yes | Non-empty, max 255 chars | User-defined display name (e.g., "Local Ollama", "OpenAI"). |
| provider_type | String | Yes | Must match a supported LlamaIndex LLM class identifier | The LlamaIndex provider type (e.g., "ollama", "openai"). |
| base_url | String | Yes | Valid URL | The API endpoint URL. |
| api_key | String | No | — | API key for authenticated providers. Null for local providers like Ollama. |
| is_default | Boolean | Yes | Only one provider can be default | Whether this is the default provider for new conversations. |
| created_at | Timestamp | Yes | System-generated | When the provider was configured. |

#### App Settings

| Attribute | Type | Required | Constraints | Description |
|-----------|------|----------|-------------|-------------|
| key | String | Yes | Primary key, unique | Setting identifier. |
| value | Text | Yes | — | Setting value (JSON-encoded for complex values). |

### 5.2 Entity Relationships

- **Project** 1 → N **Conversation**: A project contains multiple conversations.
- **Conversation** 1 → N **Message**: A conversation contains an ordered sequence of messages.
- **Conversation** 1 → N **Artifact**: A conversation contains zero or more artifacts.
- **Message** 1 → 0..N **Artifact**: A message may produce one or more artifacts; an artifact may have no producing message (initial empty artifact).
- **LLM Provider** is independent: globally configured, not project-scoped.
- **App Settings** is independent: key-value store for application-wide settings (e.g., username, theme).

### 5.3 Data Lifecycle

**Project:**
Created → Active → Deleted (soft or hard delete from DB; folder on disk untouched)

**Conversation:**
Created (with empty artifact) → Active (messages and artifacts accumulate) → Deleted (cascade deletes messages and artifacts from DB)

**Artifact:**
Created (empty or AI-generated) → Edited (via editor or AI) → Optionally Linked to disk file → Updated (synced to DB and optionally disk)

**LLM Provider:**
Created (first-run or settings) → Active → Edited → Deleted

---

## 6. Integration Requirements

| ID | External System | Direction | Protocol / Format | Frequency | Error Handling |
|----|----------------|-----------|-------------------|-----------|----------------|
| INT-001 | Python Sidecar (FastAPI) | Bidirectional | WebSocket (React ↔ FastAPI on localhost) | Real-time, persistent connection | Detect disconnection; attempt sidecar restart; show error if restart fails. [ERR-SYS-001] |
| INT-002 | LlamaIndex Workflow | Internal (within sidecar) | Python function calls | Per AI request | Errors propagated to frontend via WebSocket as error messages. |
| INT-003 | ChromaDB | Internal (within sidecar) | Python library (persistent local storage) | On indexing and RAG queries | If ChromaDB is corrupted, re-index from project folder files. |
| INT-004 | Ollama / LLM APIs | Outbound (from sidecar) | HTTP REST (provider-specific) | Per AI request, streaming | Timeout and connection errors reported to user via chat. [ERR-LLM-001, ERR-LLM-002] |
| INT-005 | Local Filesystem | Both (from sidecar and Tauri) | OS file system APIs | On-demand (file read/write) | File access errors reported to user. [ERR-AI-001, ERR-PRJ-001] |
| INT-006 | SQLite Database | Both (from Tauri backend) | Tauri SQLite plugin | On every data mutation and query | DB errors trigger retry and user warning. [ERR-EDT-001, ERR-CHT-002] |

---

## 7. Constraints

### 7.1 Technical Constraints

- **TC-001**: The application shall be built with Tauri v2 (Rust backend, webview frontend).
- **TC-002**: The frontend shall be built with React.
- **TC-003**: The rich-text editor shall be built with TipTap (open-source, MIT-compatible plugins only).
- **TC-004**: Frontend state management shall use Zustand.
- **TC-005**: The AI orchestration layer shall use LlamaIndex workflows running in a Python sidecar.
- **TC-006**: The Python sidecar shall be bundled as a PyInstaller binary and communicate via FastAPI over WebSocket.
- **TC-007**: Local data storage shall use SQLite via the Tauri SQLite plugin.
- **TC-008**: Vector storage for RAG shall use ChromaDB with local file persistence.
- **TC-009**: All dependencies shall be compatible with the MIT license.

### 7.2 Organizational Constraints

- **OC-001**: This is an open-source project (MIT license).
- **OC-002**: Development follows the OpenSpec methodology: REQUIREMENTS.md → SPEC.md → Implementation.
- **OC-003**: No budget for paid services, plugins, or APIs (the app itself is free; users provide their own LLM API keys or use local models).

---

## 8. Assumptions & Dependencies

| ID | Type | Description | Impact if Wrong |
|----|------|-------------|-----------------|
| A-001 | Assumption | The Python sidecar binary (PyInstaller) can be reliably bundled and distributed with the Tauri application on all three target platforms. | Distribution strategy needs rework; may need to require Python installation or use a different sidecar approach. |
| A-002 | Assumption | ChromaDB persistent storage in the OS application data directory is reliable and performant for project-sized document collections (hundreds to low thousands of documents). | May need alternative vector store or indexing strategy. |
| A-003 | Assumption | Storing API keys in plaintext in the local SQLite database is acceptable for MVP. OS keychain integration is deferred. | If users report security concerns, keychain integration must be prioritized. |
| A-004 | Assumption | No user authentication is needed — the application is single-user and trusts the OS-level user session. | If multi-user or shared-machine scenarios arise, authentication must be added. |
| A-005 | Assumption | Zustand is the chosen state management library for the React frontend. | Alternative state management would require frontend architecture changes. |
| A-006 | Assumption | Only free, MIT-compatible TipTap plugins are used. | Some advanced editor features (e.g., advanced collaboration, diff view) may not be available. |
| A-007 | Assumption | The NFR-002 target of first token within 2 seconds is achievable and depends primarily on the LLM provider's response time, not application overhead. | If application overhead is significant, optimization of the sidecar communication path is needed. |
| A-008 | Assumption | NFR-010 target of 5 seconds startup time is achievable with PyInstaller sidecar initialization on modern hardware. | May need lazy sidecar initialization or loading indicators. |
| D-001 | Dependency | Tauri v2 stable release with SQLite plugin support. | Must wait for stable release or use beta/RC with risk of breaking changes. |
| D-002 | Dependency | LlamaIndex Python library and its LLM provider integrations. | LlamaIndex API changes could break the sidecar workflow. |
| D-003 | Dependency | ChromaDB Python library for local vector storage. | ChromaDB API changes or bugs could affect RAG functionality. |
| D-004 | Dependency | TipTap open-source editor and its plugin ecosystem. | Plugin availability and compatibility affect editor feature set. |
| D-005 | Dependency | PyInstaller for bundling the Python sidecar. | PyInstaller compatibility issues on specific platforms could block distribution. |

---

## 9. Open Questions

| ID | Question | Owner | Due Date | Resolution |
|----|---------|-------|----------|------------|
| OQ-001 | What specific LlamaIndex workflow steps and tool definitions should be included in the MVP sidecar? | Project Owner | Before SPEC.md | — |
| OQ-002 | Should system command execution by the AI require explicit user confirmation per command, or is blanket consent acceptable? | Project Owner | Before SPEC.md | Resolved: User chooses between auto-accept-all mode or approve-one-by-one mode (same as code assistants). See FR-AI-004, BR-AI-005. |
| OQ-003 | What is the ChromaDB re-indexing strategy — automatic on project open, manual trigger, or file-watcher-based incremental? | Project Owner | Before SPEC.md | Resolved: ChromaDB indexes only non-markdown files (PDF, EPUB, etc.) automatically. Markdown files are accessed via direct read/search tools. See FR-AI-006, FR-AI-008, BR-AI-004. |
| OQ-004 | Should the application support theming (light/dark mode) in the MVP? | Project Owner | Before SPEC.md | Resolved: Yes, light and dark themes in MVP. See FR-SYS-006, FR-SYS-007. |
| OQ-005 | What model selection UX is needed? Can the user pick a specific model from a provider (e.g., choose between different Ollama models), or just select a provider? | Project Owner | Before SPEC.md | Resolved: Query providers via OpenAI-compatible `/models` endpoint at startup, show all models in selection UI. See FR-LLM-007, FR-LLM-008, FR-LLM-009. |

---

## 10. Appendices

### A. Reference Projects

- **OpenCanvas** (LangChain): Open-source implementation of the canvas/artifact interaction pattern. Reference for the chat + editor + artifact UX model.
- **Claude Code CLI**: Reference for the "cowork" interaction model — AI with full filesystem access, tool calls, and agentic behavior.
- **Tauri v2 Documentation**: Framework reference for desktop application architecture.
- **TipTap Documentation**: Editor framework reference for plugin architecture and capabilities.
- **LlamaIndex Workflows Documentation**: Reference for AI orchestration layer design.
