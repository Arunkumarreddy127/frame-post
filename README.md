# Framepost

Full-stack foundation with basic username authentication and a simple homepage.

## Stack

- Frontend: React, TypeScript, Vite
- Backend: Java 21, Spring Boot, Maven
- Data: MongoDB
- Object storage: Cloudflare R2 through the S3-compatible AWS SDK

This workspace intentionally contains no Instagram or publishing features. It includes username/password authentication, user-owned pages, and private ChatGPT-style conversations in global or page-specific workspaces.

## Configuration

Copy `.env.example` to `.env` and replace the R2 placeholders when needed. The default local values use MongoDB database `framepost` and R2 bucket `framepost-assets`.

To enable chat, set `OPENAI_API_KEY` in `.env`. The backend sends all OpenAI requests; do not expose this key through `VITE_` variables or frontend code. The default `OPENAI_ALLOWED_MODELS` allowlist contains `gpt-6-luna`, `gpt-6.1-sol`, and `gpt-6-astra`; adjust it only when different models are available to the configured key.

RunningHub workflows are defined in `backend/src/main/resources/runninghub/workflows/*.json`. Each file describes one workflow: its inputs, the RunningHub node and field each input is written to, any derived-value transforms, and the output type. The app loads and validates all definitions at startup and renders one page per workflow at `/create/rh/{workflowKey}` (or `/pages/{pageId}/create/rh/{workflowKey}`). The current workflows are `minimax-h3-ff-image-to-video` and `seedvr2-video-upscale`.

Workflow IDs are never stored in the definitions. Each definition names the env var that holds its ID in `workflowIdEnv`. Set `RUNNINGHUB_API_KEY` plus one ID per workflow in `.env`:

- `RUNNINGHUB_WORKFLOW_ID_MINIMAX_H3_FF`
- `RUNNINGHUB_WORKFLOW_ID_SEEDVR2`

The workflow must already be saved on RunningHub. A workflow whose ID is missing is listed as not configured and its page reports it. Node IDs and field names are no longer read from env vars. **Breaking change:** the old `RUNNINGHUB_*_NODE_ID` and `RUNNINGHUB_*_FIELD_NAME` variables are ignored. Remove them from `.env`.

Input types are `image`, `video`, `text`, `textarea`, `select`, and `number`. Files are uploaded to RunningHub and the returned file name is written to the mapped node. Other values are written as strings. Transforms derive values: `secondsToFrames` (seconds × fps) and `aspectRatioDimensions` (width and height from the longest side and aspect ratio, snapped to multiples of 32). Server-side validation uses the definition: required, `maxLength`, select options, accepted content types, and `maxBytes`.

To add a workflow, export it from RunningHub, copy the nodes' `nodeId` and `fieldName` values from its `*_api.json` export, and write a definition in the same format as the existing files. Then set its `workflowIdEnv` variable. No Java or frontend code changes are needed. Outputs are stored in R2 and metadata is kept in the shared `content_generations` MongoDB collection. Old `video_generations` records are not read by the app. If those records are needed, run the historical video migration below **before** the shared-content migration. It copies them to the legacy `runninghub_generations` collection, not the new runtime collection. Run from `backend/` with the intended environment exported. Add `--dry-run` to count without writing.

```bash
mvn spring-boot:run -Dspring-boot.run.profiles=migrate-video-generations -Dspring-boot.run.arguments=--dry-run
mvn spring-boot:run -Dspring-boot.run.profiles=migrate-video-generations
```

Completion is driven by RunningHub webhooks when `RUNNINGHUB_WEBHOOK_BASE_URL` (for example `https://test1.oneappstore.in`) and `RUNNINGHUB_WEBHOOK_SECRET` are set. RunningHub is then given `{RUNNINGHUB_WEBHOOK_BASE_URL}/api/webhooks/runninghub/{RUNNINGHUB_WEBHOOK_SECRET}`. The handler reads the `taskId` from the callback, re-checks status, and finishes the generation. Status polling continues as a fallback. The browser gets updates over Server-Sent Events at `GET /api/pages/{pageId}/generations/{id}/events`. The stream sends the current state on connect and closes after the final update. The public tunnel must route `/api/webhooks/*` to the backend. Keep the secret out of logs. The field names, the `video` upload type, the SeedVR2 resolution options, and the callback payload shape are not yet verified against a live RunningHub account.

Image generation at `/create/gpt-image-gen` reuses `OPENAI_API_KEY` and the `OPENAI_IMAGE_ALLOWED_MODELS` allowlist (default `gpt-image-2.5-sunburst,gpt-image-2.5-flare`). Generated images and attachments are stored in R2 and metadata is kept in `content_generations` with provider `OPENAI`.

## Shared generation persistence

Both providers use `content_generations`, with each generation's files in `content_inputs` and `content_outputs` (linked by `inputIds`/`outputIds` and each file's `generationId`). All generation traffic goes through one API: `GET|POST /api/generations`, `GET|DELETE /api/generations/{id}`, `GET /api/generations/{id}/events` (SSE), `GET /api/generations/media/{inputs|outputs}`, `GET /api/generations/catalog` and `GET /api/generations/download?key=`, each also under `/api/pages/{pageId}`. Lists take `limit`, `before` (the previous `nextCursor`), `provider`, `workflowKey` and `globalOnly`, and return `{items, nextCursor}`. Provider-specific repository adapters keep the execution services separate while reading and writing through one store:

| Fields                                        | Meaning                                                                                                                                                          |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_id`, `userId`, `pageId`, `createdAt`        | Identity, ownership, optional page scope, creation time                                                                                                          |
| `schemaVersion`, `provider`, `generationType` | Version `1`, `OPENAI` or `RUNNINGHUB`, `IMAGE` or `VIDEO`                                                                                                        |
| `workflowKey`                                 | RunningHub workflow; absent for OpenAI                                                                                                                           |
| `inputs`                                      | String-valued text/configuration map; OpenAI includes `prompt`, `model`, `size`, `quality`, `count`, `outputFormat`, `background`, `moderation`, `partialImages` |
| `inputFileKeys`                               | Named R2 references; OpenAI uses numeric `attachment-1`, `attachment-2`, etc.; RunningHub retains workflow input names                                           |
| `outputs`                                     | Ordered `{key, type, contentType}` list, supporting multiple images                                                                                              |
| `providerMetadata`                            | RunningHub `runningHubTaskId` and `instanceType`                                                                                                                 |
| `status`, `error`                             | `PROCESSING`, `COMPLETED`, or `FAILED`, and optional error                                                                                                       |
| `parentGenerationId`, `parentResultKey`       | Image-edit lineage                                                                                                                                               |

URLs and binary media are not stored in this document. Provider queries always include the provider discriminator. Global image history reads only `pageId=null`; global Library reads every owned page and global scope. Indexes are explicitly initialized at normal application startup and after migration, including a partial unique RunningHub task-ID index.

### Migrate existing generations

Use a maintenance window. Back up MongoDB, prevent new submissions, allow all image/RunningHub requests to finish, and stop the old backend. The script does not stop the application for you. Never run two migration processes simultaneously. A `PROCESSING` source record blocks migration; resolve stale jobs before continuing.

From `backend/`, build the new backend with Java 21 and export **both** `MONGODB_URI` and `MONGODB_DATABASE` for the intended database. The script does not load `.env` automatically or print credentials. It invokes the packaged JAR in a non-web migration profile; no provider or R2 requests are made.

```bash
./mvnw package
./scripts/migrate-content-generations.sh --dry-run
./scripts/migrate-content-generations.sh
./scripts/migrate-content-generations.sh --verify-only
```

The runner scans `image_generations` and `runninghub_generations` in cursor batches of 500, preserves BSON IDs, timestamps, original asset keys, settings, output order, and lineage, and normalizes records into the shared schema. Missing legacy maps/lists become empty; meaningful nullable settings remain nullable. Missing RunningHub output type is resolved from the existing workflow definition. Unknown workflow/type mappings fail rather than guessing.

Dry-run checks mappings and conflicts without writes. Migration inserts only missing records, skips exact matches, verifies every source/target mapping and deserialization, and creates indexes. Verify-only requires every source to exist and match. ID collisions, duplicate task IDs, invalid data, target differences, and unexpected target IDs abort with nonzero exit. Existing dangling image-parent references are reported and preserved. Partial inserts remain available for diagnosis and a safe rerun; there is no automatic deletion rollback.

The legacy collections and R2 objects are never modified by this migration. Start the new backend only after verification, then check image creation/edit/delete, RunningHub history/completion, and both Library scopes. New writes go exclusively to `content_generations`. Once new writes occur, the copy/verification script intentionally refuses mixed target data; do not use it as continuous synchronization. Reverting to the old backend after new writes requires explicit reverse reconciliation.

Run any historical video migration before this cutover. The separate `migrate-storage-keys` profile now uses the shared collection when it exists, otherwise legacy collections; do not combine storage relocation with the content migration or run it on an incomplete target.

For real-Mongo migration tests, export `CONTENT_MIGRATION_TEST_URI` pointing to a disposable MongoDB server and run `./mvnw -Dtest=ContentGenerationsMigrationTest test`. Tests create uniquely named databases and drop only those databases afterward. Without that variable, the integration tests are skipped. Unit tests still run normally.

## Run locally

```bash
docker compose up -d mongodb

cd backend
./mvnw spring-boot:run

cd ../frontend
npm install
npm run dev
```

The frontend runs at `http://localhost:5173`. The backend actuator health endpoint is available at `http://localhost:8080/actuator/health`.

Register or log in from the frontend. User records, server-managed sessions, page records, conversations, and chat messages are stored in MongoDB. The session cookie is HttpOnly; set `AUTH_COOKIE_SECURE=true` when serving the backend over HTTPS.

`/chat` keeps conversations in the user workspace. `/pages/:pageId/chat` keeps separate conversations for that owned page and sends its name, description, and bio as OpenAI context. Instruction files (a name plus text, stored in MongoDB) can be created at user level (all chats) or page level (that page's chats) and are selected per conversation in the chat UI; initial requests send only the selected files' IDs and names. The assistant can retrieve the complete content of a selected file only when it is relevant to the user's request, so unneeded files are not attached to every prompt. Users can edit them manually, or ask the assistant in chat to change one, which shows a proposed diff that is only saved when the user applies it. Assistant responses stream into the browser, while the backend persists completed replies and retains user messages when a provider request fails.

## Validate

```bash
cd frontend
npm run lint
npm run build

cd ../backend
./mvnw test
./mvnw package
```
