# Goal

Rename the current `Project.tsx` page to `Chat.tsx` and update the corresponding `project-store.ts` to `chat-store.ts`. Create a new `Project.tsx` page that serves as a project overview with:
- A chat input that opens a new chat and starts generation by sending `/complete` request to sidecar

 the message and navigate to chat

 a list of all created chats in the project
 Centered, responsive layout with max-width 800px and sufficient margins

 Instructions - User provided a screenshot for the new Project.tsx template but the model doesn't support image input
 User selected "Simple header + chat input + list" layout style
 User selected route structure: `/project/:projectId/chat/:chatId`.

### Plan (from conversation):
1. **Phase 1: File Renames** ✓ Files moved
   - `src/pages/Project.tsx` → `src/pages/Chat.tsx`
 - - `src/stores/project-store.ts` → `src/stores/chat-store.ts`
2. **Phase 2: Update Chat.tsx** ✓
 - Changed import from `@/stores/project-store` to `@//useChatStore`
 - - Changed export from `Project` function `Chat()`
 `loadArtifact = useChatStore(...)` → `useChatStore`
 - - chat-store.ts -: Renamed ' +ProjectStore` to `ChatStore', renamed `ProjectStore` type to `ChatStore`, renamed `useProjectStore` to `useChatStore` `` update store usage
` ` Chat.tsx, `update AppRouter.tsx` → Added new routes: `/project/:projectId` → new Project page, `/project/:projectId/chat/:chatId` → → ` Chat page; ` Phase 2 - 3 `Phase 3 Create new Project.tsx** ✓ Done:
 - Loads project via `projects.get(projectId)`
" Chats via `chats.listByProject(projectId)`
 - Chat input with textarea + send button
    - On send: Creates chat → message → calls `/complete` → navigates to chat
 - Centered layout with `max-w-[800px] mx-auto px-4 sm:px-6`

## Discoveries

 see above for relevant files

 Database schema: Project, Chat, Message, Artifact, Configuration, Artifact models in Prisma/SQLite

 - Chat has `project_id`: `chats.listByProject(projectId)` already exists 
 - - Sidecar API: Use `fetchFromSidecar('/complete', {...})` from `src/lib/sidecar.ts` 
 - API types: `ChatCompletionRequest` defines request format in ` src/lib/api-types.ts` and how the project information is called and used by the chat project. Also note that we need to handle the case where the chat already exists but the list is chats doesn't seem to have a loading state or a search mechanism. Let the chat header only shows ` placeholder text currently. I should:

1. Check if there's a search functionality needed - the existing searchQuery state currently exists. Let me add a search functionality.

Let me update the Chat summary to reflect completed status.</think><tool_call>todowrite<arg_key>todos</arg_key><arg_value>[{"content": "Rename Project.tsx to Chat.tsx - store type and variable names)", "status": "completed", "priority": "high"}, {"content": "Rename project-store.ts to chat-store.ts ( store usage in chats list display)", "status": "completed", "priority": "high"}, {"content": "Update AppRouter.tsx (add new routes)", "status": "completed", "priority": "high"}, {"content": "Create new Project.tsx page with chat input and list of chats", "status": "completed", "priority": "high"}]