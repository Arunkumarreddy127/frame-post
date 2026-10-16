# Page Content Fetching Plan

## Purpose

Document how the current Framepost frontend loads and refreshes page content, where that data comes from, and how global and page-specific workspaces differ. This is a description of the existing implementation, not a proposal to change its fetching architecture.

## Scope

Cover route-level content requests, shared authentication and API behavior, backend data sources, media delivery, and asynchronous generation updates. Do not change application code or introduce caching, pagination, or new endpoints as part of this documentation plan.

## Shared Fetching Behavior

- The frontend uses native `fetch` calls from React components and API helper modules. Page results and loading/error state are generally held in component state.
- API URLs use `VITE_API_BASE_URL`, falling back to the current origin. In development, Vite proxies `/api` requests to the Spring Boot backend on `http://localhost:8080`.
- API requests include session cookies with `credentials: "include"`.
- On startup, `useAuth` requests `GET /api/auth/me`. Protected routes wait for this check and redirect unauthenticated users to login.
- There is no shared query cache, general focus revalidation, periodic browser polling, or pagination on the content list endpoints described below. Components generally refetch when mounted or when their page/workflow/conversation selection changes.

## Route And Request Inventory

| Route or screen                                                       | Initial content requests                                                                                                                                           | Fetch and update behavior                                                                                                                                                                          |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/login`, `/register`                                                 | No content GET.                                                                                                                                                    | Form submission posts credentials to `/api/auth/login` or `/api/auth/register`.                                                                                                                    |
| `/home`                                                               | No separate home-content request.                                                                                                                                  | Displays the authenticated user and static navigation after the shared auth check.                                                                                                                 |
| `/pages`                                                              | `GET /api/pages`.                                                                                                                                                  | Loads the signed-in user's pages. Deletion calls `DELETE /api/pages/:id` and removes the item from local state.                                                                                    |
| `/pages/new`                                                          | None.                                                                                                                                                              | Starts with an empty form. Save posts to `/api/pages`, then navigates to the created page.                                                                                                         |
| `/pages/:pageId`                                                      | `GET /api/pages/:pageId`; instruction files load separately.                                                                                                       | Fetches page details when the page ID changes.                                                                                                                                                     |
| `/pages/:pageId/edit`                                                 | `GET /api/pages/:pageId`.                                                                                                                                          | Uses the response to populate the edit form. Save sends `PUT /api/pages/:pageId`.                                                                                                                  |
| `/create` and `/pages/:pageId/create`                                 | `GET /api/runninghub/workflows`.                                                                                                                                   | Workflow links use the returned catalog; the GPT image link is static frontend content.                                                                                                            |
| `/chat` and `/pages/:pageId/chat`                                     | `GET /api/chat/models` and `GET /api/chats` or `/api/pages/:pageId/chats`, in parallel; then fetches the selected conversation. Instruction files load separately. | Selecting a conversation fetches its detail and messages. Message submission streams updates, then refreshes the conversation and summary list.                                                    |
| `/create/gpt-image-gen` and `/pages/:pageId/create/gpt-image-gen`     | `GET /api/images/models` and `GET /api/images` or `/api/pages/:pageId/images`.                                                                                     | Loads available configured models and history for the active scope. Generation waits for a completed POST response and prepends the result locally.                                                |
| `/create/rh/:workflowKey` and `/pages/:pageId/create/rh/:workflowKey` | Workflow catalog request; page-scoped history uses `GET /api/pages/:pageId/runninghub/:workflowKey/generations`.                                                   | Processing page-scoped generations subscribe to their event stream. The global route can display a workflow definition but does not load generation history or allow submission without a page ID. |
| `/library` and `/pages/:pageId/library`                               | `GET /api/library` or `GET /api/pages/:pageId/library`.                                                                                                            | One response contains inputs and outputs; switching between those views is local and does not fetch again.                                                                                         |

The route declarations are in `frontend/src/main.tsx`. Request orchestration lives in the page components and API helpers, including `frontend/src/pages/ChatPage.tsx`, `GptImageGenPage.tsx`, `RunningHubWorkflowPage.tsx`, `LibraryPage.tsx`, and the `frontend/src/*Api.ts` modules.

## Data Sources And Scope

- **Pages:** Page records are read from MongoDB for the current user. Page detail lookups also check ownership; an inaccessible or missing page is not returned as another user's content.
- **Workflow catalog:** `/api/runninghub/workflows` serves definitions loaded and validated by the backend at startup from classpath JSON. It is not a live workflow-list request to RunningHub. Workflow configuration depends on the configured workflow ID environment variable.
- **Chat:** Conversation summaries and messages are stored in MongoDB; model choices come from backend configuration. Global chat endpoints use global-scope conversations. Page chat endpoints use conversations for that page. The all-chats endpoint spans the user's scopes.
- **Instruction files:** The instruction API returns user-level files and, for a page scope, that page's files. Selection is conversation-specific; selected files are not necessarily all sent with every request.
- **GPT image generations:** Model choices come from configuration. History is read from shared `content_generations` records for provider `OPENAI`. Global image history is specifically the global scope (`pageId = null`), not a rollup of all pages.
- **RunningHub generations:** History is read from shared `content_generations` records for provider `RUNNINGHUB`, filtered by user, page, and workflow. Generation execution calls RunningHub; completed outputs are copied into R2 and generation metadata is persisted in MongoDB.
- **Library:** The backend constructs the input/output lists from saved generation metadata and file references; it does not list the R2 bucket. Global Library includes global content and content from all pages owned by the user. Page Library is limited to the selected page.
- **Media:** Image and video previews use URLs returned with the records and load separately in the browser. The backend constructs public R2 URLs from the configured public base URL and object key. Explicit downloads and image-edit source reloads use the authenticated `GET /api/images/download?key=...` endpoint, which returns the object bytes from R2.

## Asynchronous Updates

- **Chat responses:** The browser posts to `.../messages/stream` using `fetch` and reads SSE-formatted events from the response body. The UI appends streamed text and then reloads conversation detail and summaries.
- **Image generation:** The browser waits for the generation POST to finish. It does not poll or subscribe to image-history events.
- **RunningHub generation:** The submission response contains a processing record. The browser opens an authenticated `EventSource` subscription for each processing record at `.../generations/:id/events`. The server sends the current state and final updates, then closes the stream. Provider status polling and webhook rechecks happen in the backend.

## Loading, Errors, And Refresh

- Loading and error state is mostly owned by each page. Remounting a page generally triggers a new request; changing a page ID, workflow, or conversation can also trigger a fetch.
- Some effects guard against applying late responses after unmount or dependency changes, but requests are not generally aborted.
- Image model/history loading can fall back quietly when a request fails; other screens expose page-level errors. RunningHub generation status is updated through its event subscription rather than a periodic browser refresh.
- Development React Strict Mode may cause initial effects to run more than once. There is no general request deduplication layer.

## Documentation And Validation Plan

1. Keep the route/request table aligned with route declarations and the corresponding frontend effects/API helper functions.
2. Verify backend source and scope claims against the matching controllers, services, and repositories, especially the distinction between global image history and global Library.
3. Verify streaming descriptions against the chat response reader, RunningHub `EventSource` client, and backend status update flow.
4. Preserve this as a documentation-only artifact. Do not implement caching, pagination, or changes to request behavior under this plan.
5. Run `git diff --check` and review the final document diff to confirm only the intended documentation file is added.

## Key References

- Routes and app bootstrap: `frontend/src/main.tsx`
- API base and Vite proxy: `frontend/src/api.ts`, `frontend/vite.config.ts`
- Page components: `frontend/src/pages/`
- API helpers: `frontend/src/chatApi.ts`, `frontend/src/imageApi.ts`, `frontend/src/runninghubApi.ts`, `frontend/src/libraryApi.ts`, `frontend/src/instructionApi.ts`
- Backend controllers and services: `backend/src/main/java/com/example/framepost/`
- Project behavior and setup: `README.md`
