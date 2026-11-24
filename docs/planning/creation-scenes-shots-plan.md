# Creation → Scenes → Shots → Tool Invocations

## Goal

A Creation becomes a production project: an ordered list of **scenes**, each with an ordered list of **shots**, each shot holding an ordered history of **tool invocations** (Image, Video, Edit, Upscale, Chat). The UI follows the "The Lost City of 2150" mockup: Storyboard / Production / Preview tabs, scene cards, a shot list with status chips, and a selected-shot panel with the brief and tool cards.

```
Creation ─ Scene (position) ─ Shot (position) ─ Tool invocation (position, tool, parent)
```

## What exists today

- `Creation` (`creations`) and `CreationItem` (`creation_items`: `generationId`, `position`, `laneId`, `parentItemId`; `laneId` is retired, see Backend below) in `backend/.../creation/`. A unique index on (`creationId`, `generationId`) means one generation can belong to many creations, but only once in each.
- `CreationController` serves `/api/creations/**` and `/api/pages/{pageId}/creations/**`.
- `CreationDetailPage.tsx` has Feed / Grouped / Storyboard views, where "storyboard" is only lanes plus a parent link.
- Create pages (`GptImageGenPage`, `RunningHubWorkflowPage`) take `?creationId=` and call `addCreationItem` after a generation starts. `CreationTargetBanner` shows the target.
- `ContentGeneration` has `MediaType { IMAGE, VIDEO }`. Upscale is planned in `browser-video-upscaler-plan.md`.

A **tool invocation is a `CreationItem` that gains `shotId` and `tool`**. This reuses the generation link, the one-per-creation uniqueness rule, `parentItemId` (an invocation continues the previous one, e.g. video from image) and the existing reorder logic. No new generation concept is needed.
## Workspace responsibilities

The workspaces separate asset generation from shot organization:

| Level | Scope | Generate action |
|---|---|---|
| Creation | creation-wide assets | Generate assets for the creation together |
| Scene | organize the shots belonging to a scene | None |
| Shot | one shot | Per-tool "Generate" cards for that shot |

The creation detail opens on **Scenes & Shots** by default. This overview shows each shot's title and final media when set, keeping status, briefs, settings, and other generated invocations in the shot workspace. The creation workspace is the central place to generate and review assets. The scene workspace is for organizing shots; it does not generate assets. The shot workspace is where generations specific to an individual shot take place.

**Why this needs backend work.** A batch of steps has to keep running after the browser closes, so it cannot be a frontend loop over the single-generation calls. The plan adds a backend run that uses the same services as the single-generation endpoints:

- **`creation_generation_runs`** (new): `id`, `creationId`, `userId`, `scope` (`CREATION`/`SHOT`), `scopeId`, `status` (`QUEUED`/`RUNNING`/`PAUSED`/`COMPLETED`/`FAILED`/`CANCELLED`), `steps` (ordered list), `createdAt`, `updatedAt`.
- **Step:** `shotId`, `tool`, `status` (`PENDING`/`RUNNING`/`COMPLETED`/`FAILED`/`SKIPPED`/`BLOCKED`), `generationId?`, `itemId?`, `error?`.
- **Planning:** on start, the backend expands the scope into ordered steps: scenes by position, shots by position, and each shot's tools in the order of its plan.
- **Skip rule:** a step is skipped when its shot already has a completed invocation for that tool. A "Regenerate" option resets a step to `PENDING` instead.
- **Dependencies:** a VIDEO step uses the shot's latest completed IMAGE output as its input. If that IMAGE step failed, the VIDEO step is `SKIPPED` with the reason recorded.
- **Execution:** steps run one at a time in order by default, so cost and provider rate limits stay predictable. Parallel shots are an option, see open questions.
- **Failure:** a failed step sets the run to `PAUSED`. The user can retry the step, skip it, or cancel the run. Completed steps are kept.
- **Single active run:** a creation can have one active run at a time. A new run is rejected while another is `QUEUED` or `RUNNING`. The same rule stops a single-shot generate from overlapping a running batch on that shot.
- **Progress:** the frontend polls the run's status, similar to existing generation status polling. The outline endpoint includes the active run's progress.

**Limits to design for.**
- **Inputs must be derivable.** Batch generation only works when every input can come from shot data: the brief (prompt), `durationSeconds`, and the previous output. RunningHub workflows that need other user inputs cannot run in a batch. Those steps are marked `BLOCKED` with a message asking the user to generate them from the shot.
- **Cost:** the run shows the step count and the tools it will call before it starts. Confirmation is required above a step threshold (value to set).
- **Cancelling** stops future steps. Steps already sent to a provider are not cancelled.

**API additions** (also under `/api/pages/{pageId}`):
- `POST /creations/{id}/runs` with `{scope, scopeId?, mode: "MISSING" | "REGENERATE"}` starts a run and returns the planned steps.
- `GET /creations/{id}/runs/{runId}` returns status and steps.
- `POST /creations/{id}/runs/{runId}/steps/{stepId}/retry` and `/skip`, and `POST /creations/{id}/runs/{runId}/cancel`.
- Shot-level generation uses the same step execution code, so a single generation and a batch step behave the same way.

**Frontend.** Creation-wide and shot-specific generation show progress and retry actions. The scene workspace remains focused on organizing shots and has no generation action.

**Phase placement.** Shot-level generation stays in phase 3. Runs are a new phase after it (phase 3b), because they depend on the shot-level execution code and the derived shot status.

## Data model (MongoDB)

| Collection | Fields |
|---|---|
| `creations` (extend) | `status` (`DRAFT`/`IN_PROGRESS`/`DONE`), optional `brief` text |
| `creation_scenes` (new) | `id`, `creationId`, `userId`, `position`, `title` (e.g. "City reveal"), `description`, `coverItemId?`, timestamps |
| `creation_shots` (new) | `id`, `creationId`, `sceneId`, `position`, `title`, `shotSize?`, `shotTypes` (list), `movement?`, `durationSeconds?`, `brief`, `finalItemId?`, timestamps |

Shot fields (all optional, so a shot can be created with just a title):

| Field | Kind | Values |
|---|---|---|
| `shotSize` | single choice | **Close-ups:** Close-up, Medium Close-up, Extreme Close-up, Wide Close-up. **Medium shots:** Medium Shot, Close Shot, Medium Close Shot. **Long shots:** Wide Shot, Extreme Wide Shot, Full Shot, Medium Full Shot, Long Shot, Extreme Long Shot. Or a custom value. |
| `shotTypes` | multi choice (list of strings) | **Camera height:** Eye Level, Low Angle, High Angle, Overhead, Shoulder Level, Hip Level, Knee Level, Ground Level. **Dutch angle:** Dutch (left), Dutch (right). **Framing:** Single, Two Shot, Three Shot, Over-the-Shoulder, Over-the-Hip, Point of View. **Focus / DOF:** Rack Focus, Shallow Focus, Deep Focus, Tilt-Shift, Zoom. Plus custom values. |
| `movement` | single choice | Static, Pan, Tilt, Swish Pan, Swish Tilt, Tracking, or a custom value. |
| `durationSeconds` | integer | Whole seconds, matching the existing video workflows (`SecondsToFramesTransform`). Must be greater than 0 and at most 120 (assumed cap, adjust if needed). |

- The option lists live in one catalog per side, backend (`ShotOptions`) and frontend (`shotOptions.ts`), with a group per option so the UI can render the headings above. Keep the two catalogs in sync.
- Values are stored as plain strings, not enum keys. A value that is not in the catalog is a **custom** value: trimmed, non-blank, max 60 chars. `shotTypes` is capped at 10 entries, deduplicated case-insensitively, and keeps selection order.
- The title/subtitle of a shot row is built from these fields, for example "Extreme Wide Shot · Tracking · 5s".
| `creation_items` (extend) | `sceneId?`, `shotId?`, `tool` (`IMAGE`/`VIDEO`/`EDIT`/`UPSCALE`/`CHAT`), `position` scoped to the shot |

- Indexes: `(creationId, position)` on scenes, `(sceneId, position)` on shots, `(shotId, position)` on items. Keep the unique (`creationId`, `generationId`) index.
- Scene numbers (01, 02…) and "9 shots" counts are derived from position and are never stored.
- **Shot status is derived, not stored.** Rule to confirm:
  - Not started: no brief and no invocations.
  - Image needed: brief present, no completed IMAGE.
  - Image ready: completed IMAGE, no VIDEO.
  - Video generated: completed VIDEO.
  - Final: `finalItemId` set (an Upscale or an explicitly chosen output).
- **Backward compatibility:** existing items keep `shotId = null` and appear in an "Unassigned" bucket. The old Feed/Grouped views keep working and Unassigned items can be moved into a shot. No destructive migration.
- **Lanes are retired.** Shots and scenes replace them as the way to group items. `laneId` is removed from the model, the API and the UI:
  - `CreationItem.laneId` is removed. The `creation_items` documents keep their other fields, and a one-off migration unsets `laneId` on existing documents (same pattern as the `migrate-*` profiles, run through `ContentMediaMigration`-style runner, idempotent).
  - `CreationService`: drop `laneId` from `AddItemRequest`, `ItemPlacement` and `CreationItemResponse`, remove `MAX_LANE_LENGTH` and the lane checks in `addItem` and `reorder`. Reorder keeps its "every current item exactly once" validation, and `parentItemId` stays.
  - `creationApi.ts`: drop `laneId` from `addCreationItem` and `reorderCreationItems`. `types.ts` drops `CreationItem.laneId`.
  - `CreationDetailPage.tsx`: remove the storyboard "Lane" input and `saveLane`, the "Lane for new items" picker, the `creation-lane-options` datalist and `laneOptions`. Update the storyboard view description to match shots (see Frontend). The storyboard view is replaced by the scene/shot UI in phase 2, so the lane UI is deleted in that same phase.
  - `styles.css`: remove `.creation-lane` rules (around lines 4626, 4730, 5028).
  - Tests: remove the lane case in `creationApi.test.ts` (lines 50–62) and any lane assertions in `CreationServiceTest`.
  - Compatibility: the change is breaking for any client that sends `laneId`. Jackson should ignore unknown properties in requests. Confirm the app's ObjectMapper setting, and if it fails on unknown fields, accept `laneId` as ignored until the frontend ships. Existing stored `laneId` values are discarded by the migration; no lane data is converted to shots.
- **Phase placement:** the model and API removal lands in phase 1 together with the shot work, so the API never has two grouping systems at once. The UI removal lands in phase 2.

## Backend

1. Add `Scene`, `Shot`, their repositories and indexes (`CreationIndexes.ensure`, including the `migrate-*` profile exclusion pattern). Put scene/shot logic in a `SceneService`/`ShotService` or in `CreationService`, and share its ownership and page-scoping checks.
2. Extend `AddItemRequest` with `shotId` and `tool`. Validate that the shot belongs to the creation, set `sceneId` from the shot, and validate that `parentItemId` is in the same shot. Default `tool` from the generation's media type.
3. Endpoints, each also under `/api/pages/{pageId}`:
   - `GET /creations/{id}/outline` returns scenes → shots → invocation summaries (tool, status, output thumbnail, counts) in one call, with the derived shot status.
   - `POST/PUT/DELETE /creations/{id}/scenes[/{sceneId}]` and `PUT .../scenes/order`.
   - `POST/PUT/DELETE /creations/{id}/shots[/{shotId}]`, `PUT .../shots/order`, and moving a shot between scenes by changing `sceneId`.
   - `PUT /creations/{id}/shots/{shotId}/final` to set the final output.
   - `PUT /creations/{id}/items/{itemId}/shot` to move an item or assign an Unassigned one.
4. Deleting a scene removes its shots. Deleting a shot detaches its invocations to Unassigned and does not delete generations. Deleting a creation also removes scenes and shots.
5. Validate the shot fields on create and update: `shotSize`/`movement` trimmed (blank becomes null, max 60 chars), `shotTypes` capped and deduplicated, `durationSeconds` null or 1–120. Out-of-range values return 400.
6. Tests in `CreationServiceTest`: ordering and reorder validation, cross-user and cross-page isolation, shot/parent validation, shot field validation (catalog and custom values, duplicates, duration bounds), derived status, delete cascades, and legacy items.

## Frontend

1. Types and API: add `Scene`, `Shot`, `ToolInvocation` and `ShotStatus` to `types.ts`, and the new calls to `creationApi.ts` with tests in `creationApi.test.ts`.
2. Restructure `CreationDetailPage` (split into `components/creations/*`):
   - Header: title, status pill, and Storyboard / Production / Preview tabs.
   - `SceneStrip`: scene cards with cover, "Scene 01", title, "N shots". Add, rename and reorder scenes.
   - `ShotList`: compact shot rows with title, status, and only the selected final media preview; open a shot to see its brief, settings, and generated invocations. Support adding, editing, reordering, and opening shots.
   - `ShotSettings` (in the shot editor): Shot size and Movement as single-select popovers with grouped radio lists and a "Custom" text row; Shot types as a grouped multi-select with checkboxes (Camera height, Dutch angle, Framing, Focus / DOF) and a "Custom" row; Duration as a whole-seconds number input. Options come from `shotOptions.ts`.
   - `ShotWorkspace` (selected shot): brief card (editable), tool chips (Image, Video, Edit, Upscale, Chat), then an ordered invocation card per tool. Each card shows state (Not started, Processing, Completed, Failed), a preview, and a Generate / Regenerate action.
3. Tool launch: a tool→route registry (Image → `/create/gpt-image-gen`, Video → `/create/rh/:workflowKey`, Edit → image page with the previous output attached, Upscale → upscaler, Chat → chat with shot context). Links carry `?creationId=&shotId=&tool=&parentItemId=`. The brief prefills the prompt, and the previous invocation's output is the default input. For Video, `durationSeconds` prefills the workflow's seconds input when it has one, and shot size, shot types and movement are offered as optional prompt text the user can insert, not appended silently.
4. Create pages and `CreationTargetBanner`: read `shotId`/`tool`/`parentItemId`, show "Adding to Scene 01 · Shot 02 · Image", and pass them to `addCreationItem`. Return to the shot after generation with `onCreationItemAdded`.
5. Keep the existing Feed and Grouped views as an "All items" view, with Unassigned items surfaced for assignment.
6. Preview tab: play each shot's final (or latest) video in scene/shot order. This is read-only and uses existing media viewer components.
7. Styling in `styles.css`; mobile-first, matching the mockup.

## Phases

1. **Data and API:** scene/shot model, item extension, outline endpoint, tests.
2. **Storyboard UI:** scene strip, shot list, shot CRUD and reorder.
3. **Production UI:** shot workspace, tool cards, launch-and-return flow for Image and Video.
4. **Edit and Upscale:** wire these once their backing tool exists, and then Chat with shot context.
5. **Preview and polish:** Preview tab, final-output selection, empty and error states.

Each phase ships independently. Phase 1 leaves the current UI unchanged.

## Phase 1 implementation notes

- Shot option values are validated only for length (up to 60 characters). No backend `ShotOptions` catalog exists yet.
- Item `position` stays creation-scoped rather than per-shot, so the existing `reorder` endpoint keeps working.
- Scene and shot titles are required (1–120 characters). Duration is 1–120 seconds, or null.
- `Scene` does not store a cover item. The cover is derived from the outline.
- `laneId` is removed from the model and API. Run `migrate-creation-lanes` profile once to unset it on existing items (`--dry-run` supported).

## Phase 2 progress notes

- Done: `frontend/src/types.ts` and `frontend/src/creationApi.ts` match the phase 1 API (outline, scene, shot, final, move). Lane UI, lane CSS, and lane tests are removed from the Creation detail page.
- Done (phase 2b): the Production view in `CreationDetailPage.tsx` renders `components/creations/ProductionBoard.tsx`. It covers the scene strip, shot editor, invocation cards (set final, unassign, remove), and the Unassigned strip with assign-to-shot.
- Shot options live in `frontend/src/shotOptions.ts`, taken from the reference shot lists. Shot size and movement are single choices. Shot type is multi-choice (max 10). Each list allows a custom value.
- Est. time from the reference lists maps to `durationSeconds`. It is validated as whole seconds from 1 to 120 (confirmed maximum). The h/m source picker is simplified to seconds.
- Start Time and End Time are not stored (decided by the user).
- Mutations are typed as `void`. The UI reloads the outline after each mutation rather than merging responses.

## Phase 3 progress notes

- Done: the shot workspace opens from the board ("Open shot") through `?shot=<id>` in `CreationDetailPage.tsx`. `components/creations/ShotWorkspace.tsx` shows the settings, brief, and edit form, plus tool cards for Image, Video, Edit, Upscale, and Chat. Each card lists invocations with open, set/unset final, and remove.
- Done: Image and Video cards launch the Create page with `?shotId=&tool=`. The banner shows the target shot. Generator pages prefill the prompt from the brief and, for video, the seconds input and the shot's latest image. Results attach to the shot with the matching tool.
- Edit, Upscale, and Chat show "Coming soon" (phase 4).
- Batch run (phase 3b) is not started.

## Verification

- Backend: `mvn test` in `backend/`.
- Frontend: Vite build and `creationApi.test.ts`, plus a manual run of the Lost City example (3 scenes, 9 shots, multiple invocations per shot).

## Typed create actions

- Each workflow JSON declares a `tool` (`IMAGE`, `VIDEO`, `UPSCALE`, `EDIT`). `WorkflowRegistry` rejects workflows without one.
- The "New generation" button is replaced by one action per tool (`ACTION_TOOLS` in `frontend/src/creationTools.ts`): "Create Image", "Create Video", "Upscale Video". Actions with no workflows are hidden.
- The same actions appear on the Creation detail page and the `/create` page.
- Known gap: `backend` `ChatServiceTest.editingUserMessageDeletesFollowingMessagesAndPreservesItsAttachments` fails with an NPE on a null `ChatMessage.id()`. It predates this work.

## Open questions

- **Edit, Upscale and Chat:** Edit can reuse image generation with an attached input. The upscaler is only planned, so the card could appear as "coming soon". Chat needs a context hook into `ChatPanel`. What should phase 3 cover?
- **Shot status:** is the derived rule above right, or should users set it manually?
- **Scene/shot creation:** manual only, or also generated from a prompt or script by chat? This plan covers manual only.
- **Preview scope:** a simple sequential player, or stitched export? Export is out of scope here.
- **Shot field choices:** are the lists from your screenshots the full catalog? Is whole seconds with a 120 s cap right for duration? Should shot size, types and movement be added to generation prompts automatically, or only offered as optional text as the plan assumes?
- **Batch runs:** should steps run sequentially (as planned) or in parallel across shots? What is the confirmation threshold for a run? Should a run be allowed to continue past a failed step?
