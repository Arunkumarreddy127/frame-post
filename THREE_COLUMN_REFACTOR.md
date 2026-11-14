# Plan: Chat as a right-side panel in the app shell

## What exists today

- `frontend/src/components/AppShell.tsx` is wrapped by each page separately. It renders `Header`, then `.app-body` as a two-column grid of `Sidebar` or `PageSidebar` and `<main class="app-main">`.
- `frontend/src/pages/ChatPage.tsx` is a 932-line routed page. It mounts at `/chat` and `/pages/:pageId/chat`, and wraps itself in `AppShell`. Its own `.chat-page` grid holds `.chat-sidebar` (history, New chat, All chats toggle, `InstructionFiles` with per-chat selection checkboxes and create/edit/delete) and `.chat-workspace` (title, model, transcript, composer, proposals).
- Chat state is local to `ChatPage`. On load it auto-selects `?conversation=` or the first chat. Selecting a chat in "All chats" mode navigates to `/pages/:id/chat`.
- `InstructionFiles` (`components/InstructionFiles.tsx`, API in `instructionApi.ts`) is used in two places: the chat sidebar and `PageDetailPage` (`variant="overview"`). It does two jobs: **managing** files (list, create, edit, delete, user vs page scope) and **selecting** which files a conversation uses (`selectedFileIds`, saved via `updateConversationInstructions`; `withSelection` applies it to new chats). Accepted AI proposals also write through `updateInstructionFile`.
- There's no layout route. Every route in `frontend/src/main.tsx` wraps its own page in `ProtectedRoute`.

## Target layout

`Header` on top, then three columns: **left** `Sidebar` or `PageSidebar` (with a new **Files** link), **middle** the page content (including a new Files workspace), **right** a `ChatPanel`.

The right panel has two views:

1. **List view** (the default). It shows New chat, the All chats toggle and the history list. Instruction files are no longer managed here.
2. **Conversation view**. It shows a top-left back arrow (lucide `ArrowLeft`), the title, and the model, rename and delete controls. Below those are the transcript and the composer.

Clicking a chat opens the conversation view, and the back arrow returns to the list (like the GitHub Copilot chat view in VS Code).

### Files in the sidebar and middle column

Instruction-file management moves out of the chat. `Sidebar` and `PageSidebar` get a **Files** navigation link. Clicking it shows the files in the middle column in a VS Code-style editor:

- **Explorer** (nested under the **Files** link inside `Sidebar` / `PageSidebar`, which shows a chevron that rotates when expanded; clicking Files on the Files route toggles it, so the editor area fills the whole middle column): a file tree with sections such as "Global" (user scope) and "This page" (page scope, only under `/pages/:pageId/files`), a New file button, and per-file rename and delete actions.
- **Tab bar** across the top of the editor area: open files as tabs, with the active tab highlighted, a close button, and a dot for unsaved changes.
- **Editor area**: a styled monospace `textarea` with a line-number gutter (no new dependency, no syntax highlighting), and Save (Cmd/Ctrl+S). An empty state shows when no file is open.
- Routes: `/files` and `/pages/:pageId/files`, both rendered in `AppShell`. Files are shown according to the route's scope: `/files` lists only global (user-scope) files; `/pages/:pageId/files` lists that page's files under "This page", plus the global files under "Global" (the existing `listInstructionFiles(pageId)` already returns both).

## Steps

1. **Extract the chat into a panel component.**
   - Create `components/ChatPanel.tsx` and move the `ChatPage` body into it. The state, handlers, `LocalAttachmentPreview` and helpers go with it.
   - It takes `pageId?: string` and no `AppShell` or `user`.
   - Add `view: "list" | "conversation"` state. Selecting a chat, creating one (`startConversation`), or opening via `?conversation=` switches to conversation view. The back arrow returns to the list.
   - Stop auto-selecting `loaded[0]` on load, so the panel starts on the list. Keep `?conversation=` deep-linking, which opens that chat directly.
   - After `removeConversation`, go back to the list instead of loading the next chat.
   - Remove `InstructionFiles` from the panel. Keep only a small per-chat "Instructions" picker (see step 6) so a conversation can still choose its files.
   - Keep the existing `sending` guards: disable back and selection while a response is streaming.

2. **Make `AppShell` three-column.**
   - Render `<ChatPanel pageId={pageId} />` as a third grid item after `.app-main`.
   - Change `.app-body` to `12.5rem minmax(0,1fr) <chat width>`.
   - Make the panel sticky to the viewport height under the header, with the transcript scrolling inside it.
   - Add a prop to turn the panel off (`chatPanel?: boolean`, default on). The `pageId` already passed for the page sidebar scopes the chat to that page, so chats stay page-scoped inside `/pages/:id/*` and global elsewhere.
   - Widen `.app-body`. It is currently capped at `min(100%, 76rem)`.

3. **Remove the standalone chat page.**
   - Delete the `/chat` and `/pages/:pageId/chat` routes and the `ChatPage` export. Then either remove the "Chat" entry from `Sidebar` or `PageSidebar`, or turn it into a toggle that opens the panel.
   - Add redirects so old links and bookmarks still work. For example, `/chat` could go to `/home?chat=open` and `/pages/:id/chat` to `/pages/:id`.
   - Change the "All chats" cross-page navigation (`navigate('/pages/${pageId}/chat?...')`) to go to `/pages/:id?conversation=...`.

4. **Build the Files workspace (new).**
   - Add `pages/FilesPage.tsx`, wrapped in `AppShell`. It reads `pageId` from the route and calls the existing `listInstructionFiles(pageId)`.
   - Split `InstructionFiles.tsx`: management moves into new components (`FileExplorer`, `EditorTabs`, `FileEditor`), and the selection checkboxes are removed from them.
   - Reuse `createInstructionFile`, `updateInstructionFile` and `deleteInstructionFile` unchanged. No backend changes are needed, since the file and scope model stays the same.
   - Open-tabs state: `openIds[]`, `activeId`, and a draft per file (so dirty tabs keep their edits). Warn on closing a dirty tab or leaving the route.
   - New file starts as an untitled tab. Saving prompts for a name and a scope (Global or This page) using the existing create call. Changing scope uses the existing `scope` and `pageId` fields on update.
   - Add the **Files** link to `Sidebar` (`/files`) and `PageSidebar` (`/pages/:id/files`).
   - Update `PageDetailPage`'s overview use of `InstructionFiles`: either link to the Files page or show a read-only list.
   - Reload files after an accepted AI proposal. The chat panel and the Files page both write files, so share a small store or a refresh callback so an open tab doesn't go stale.

5. **Update the CSS in `frontend/src/styles.css`.**
   - Replace `.chat-page` and `.chat-sidebar` with a single `.chat-panel`: a flex column, full height, with a left border.
   - Add `.chat-panel-header` for the back arrow and title.
   - Restyle `.chat-workspace`, `.chat-toolbar`, `.chat-message` and `.chat-composer` for a narrow column. The toolbar controls need to wrap or compact.
   - Collapse the layout at the existing mobile breakpoint (~line 1864). The panel could stack below the main content or become a toggled drawer.

6. **Handle the narrow-width problem and chat instruction selection.** `.chat-page` currently has ~34rem of room, and the right panel will be roughly 22–26rem. That is tight for the composer, attachment tray, model select, and instruction-file proposals. Plan a compact toolbar (the model select moves into the composer toolbar or a menu).

   Because the checkboxes leave the chat, add a compact "Instructions" control in the conversation view, for example a button in the composer toolbar that opens a small checklist popover. It lists the same files (loaded via `listInstructionFiles`) and keeps `changeSelection` and `withSelection` working as before. Selecting files for a chat stays in the chat; creating and editing them lives on the Files page.

7. **Verify.**
   - Run `npm run build` and the lint/tests in `frontend/` (e.g. `chatApi.test.ts`).
   - Open it in the browser and check these cases:
     - The list view shows first.
     - Opening a chat, going back, creating a chat and deleting a chat work.
     - Sending a message streams correctly.
     - Page-scoped chats and All chats behave correctly.
     - `?conversation=` deep links open the chat.
     - Files link appears in both sidebars and opens `/files` or `/pages/:id/files` in the middle column.
     - Create, edit, save, rename, delete and scope change work. Multiple tabs keep their unsaved edits. Closing a dirty tab warns.
     - Chats still use selected instruction files, and accepted AI proposals show up in the Files page.
     - The mobile breakpoint looks right.

## Decided

- **Editor technology:** a styled `textarea` with a line-number gutter. No Monaco.
- **Files scope:** files are shown according to the route's scope, as described under "Files in the sidebar and middle column".
- **Chat visibility:** collapsible via a header toggle, with the state remembered in `localStorage` (`framepost.chatPanelOpen`).
- **The "Chat" nav link:** removed. The header toggle replaces it, and `/chat` redirects to `/home`.
- **Chat on Create pages:** hidden on `GptImageGenPage` and `RunningHubWorkflowPage` (`chatPanel={false}`).
- **Chat state while navigating:** per-page `AppShell`, so the panel remounts on navigation.

## Status

Implemented. Known limitation: unsaved Files edits warn on tab close and browser reload, but not on in-app navigation (the app uses `BrowserRouter`, which has no navigation blocker).
