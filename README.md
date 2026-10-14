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

To add a workflow, export it from RunningHub, copy the nodes' `nodeId` and `fieldName` values from its `*_api.json` export, and write a definition in the same format as the existing files. Then set its `workflowIdEnv` variable. No Java or frontend code changes are needed. Outputs are stored in R2 and kept in the `runninghub_generations` MongoDB collection. Old `video_generations` records are not read by the app. To copy them, run the one-off migration from `backend/` with the same `.env` values loaded. It only runs with its profile and exits when done. Add `--dry-run` to count without writing. It is safe to re-run.

```bash
mvn spring-boot:run -Dspring-boot.run.profiles=migrate-video-generations -Dspring-boot.run.arguments=--dry-run
mvn spring-boot:run -Dspring-boot.run.profiles=migrate-video-generations
```

Completion is driven by RunningHub webhooks when `RUNNINGHUB_WEBHOOK_BASE_URL` (for example `https://test1.oneappstore.in`) and `RUNNINGHUB_WEBHOOK_SECRET` are set. RunningHub is then given `{RUNNINGHUB_WEBHOOK_BASE_URL}/api/webhooks/runninghub/{RUNNINGHUB_WEBHOOK_SECRET}`. The handler reads the `taskId` from the callback, re-checks status, and finishes the generation. Status polling continues as a fallback. The browser gets updates over Server-Sent Events at `GET /api/pages/{pageId}/runninghub/{workflowKey}/generations/{id}/events`. The stream sends the current state on connect and closes after the final update. The public tunnel must route `/api/webhooks/*` to the backend. Keep the secret out of logs. The field names, the `video` upload type, the SeedVR2 resolution options, and the callback payload shape are not yet verified against a live RunningHub account.

Image generation at `/create/gpt-image-gen` reuses `OPENAI_API_KEY` and the `OPENAI_IMAGE_ALLOWED_MODELS` allowlist (default `gpt-image-2.5-sunburst,gpt-image-2.5-flare`). Generated images and attachments are stored in R2 and metadata is kept in the `image_generations` MongoDB collection.

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
