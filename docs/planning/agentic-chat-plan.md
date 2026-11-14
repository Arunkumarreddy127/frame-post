# Plan: Agentic Behavior for Framepost Chat

## Approach

Extend the existing chat tool loop instead of adding a new agent framework. The loop lives in
`backend/src/main/java/com/example/framepost/chat/OpenAiClient.java` and the tool handlers live in
`backend/src/main/java/com/example/framepost/chat/ChatService.java`.

The model decides what to do, the backend validates and executes it, and the user approves anything
that costs money or changes data.

## Assumptions to confirm

- **Approval-first:** the agent proposes generations and the user clicks Approve. Auto-run is a later opt-in.
- **Scope:** image generation first, then RunningHub workflows.
- **Out of scope:** publishing, scheduling, analytics, comments, and webhooks (per the workspace rules).

## Phase 1: Generalize the tool framework (no behavior change)

- Replace the instruction-only flag (`offerInstructionTool`) and the hard-coded tool JSON in `OpenAiClient`
  with a small `AgentTool` abstraction. Each tool has a name, JSON schema, risk level (`READ` or `PROPOSE`),
  and a handler.
- Add a `ToolRegistry` that builds the `tools` payload and dispatches calls. Each call receives a context
  holding the user, page ID, conversation, and selected instruction files, so authorization lives in one place.
- Move the three existing instruction tools onto it. Make the continuation-limit message generic.
- Keep the existing `OpenAiClientTest` cases passing.

## Phase 2: Read-only tools

These give the agent awareness of the app and carry little risk. Each wraps an existing service, so scope
checks are reused.

| Tool | Backed by |
|---|---|
| `get_generation_options` (image models, workflows and their inputs) | `GenerationService.catalog()` |
| `list_recent_generations` | `GenerationService.list(...)` |
| `list_library_media` | `GenerationService.listMedia(...)` |
| `get_page_context` | `PageService` |

Results are capped in size and sanitized. They are treated as data, never as instructions.

## Phase 3: Propose-then-approve tools

- **`propose_image_generation`** takes prompt, model, size, quality, count, library attachment keys, and an
  optional parent generation.
  - The backend validates against the catalog and the existing limits.
  - It emits a new SSE event, `generation_proposal`, and returns `proposal_created` to the model.
  - Nothing runs yet.
- **Approval endpoint** takes the proposal, which the user can edit. It calls
  `GenerationService.createImage(...)`, so the existing validation, storage, and cost path is reused.
- **`propose_workflow_run`** is the same pattern for page-scoped RunningHub workflows. It validates against
  `WorkflowView` inputs, and file inputs are accepted only as library keys.
- **Persist proposals** server-side with a status of pending, approved, rejected, or expired.
  - Instruction proposals are currently held in client state (`ChatPanel`), so they are lost on refresh.
  - Persisting makes approval idempotent and gives an audit trail.

## Phase 4: Close the loop

- Add a "Refine this result" action on a generated image. It attaches the output as a library image and seeds
  a chat turn, so the agent can critique the result with vision and propose a revised generation using
  `parentGenerationId`.
- Add a per-request cap on proposals, and a per-conversation cap on pending ones, so the agent can't flood
  the user.
- Defer optional auto-run (a user setting with a hard count and cost cap) until approval-first has been used
  in practice.

## Phase 5: Frontend

- Extend `ChatStreamEvent` in `frontend/src/chatApi.ts` and its parser, and update
  `frontend/src/chatApi.test.ts`.
- In `frontend/src/components/ChatPanel.tsx`, add:
  - a proposal card with editable prompt and settings and Approve/Reject buttons;
  - a lightweight "agent activity" line, such as "Reading instruction file…" or "Checking models…";
  - a link to the resulting generation.

## Phase 6: Safety and guardrails

- **Authorization:** every tool resolves user and page from the server-side context, never from
  model-supplied IDs.
- **Injection:** instruction files, page metadata, and tool results are untrusted. Keep the existing
  "not instructions" framing in `developerInstructions`.
- **Limits:** keep the tool-continuation cap, add per-tool argument validation, and set rate and cost limits
  on generations.
- **Audit:** record tool calls and proposal decisions with the message.
- **Rollout:** put it behind a config flag, and degrade to plain chat if tools fail.

## Phase 7: Testing

- **Unit tests:** per-tool authorization (wrong user or page is rejected), schema validation, and size caps.
- **Loop tests:** multi-tool sequences, the continuation limit, and malformed arguments, extending
  `OpenAiClientTest`.
- **Service tests:** approval idempotency, and rejection or expiry of proposals.
- **Frontend tests:** parser tests for the new event.
- **Manual end-to-end:** describe an idea, review the proposal, approve it, then refine the result.

## Suggested order

1 → 2 → 3 (image only) → 5 → 4 → workflow proposals → optional auto-run.

Phases 1 to 3 plus the matching UI already give a working agent: it understands the options, drafts
requests, and runs them after approval.
