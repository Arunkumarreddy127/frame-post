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

`/chat` keeps conversations in the user workspace. `/pages/:pageId/chat` keeps separate conversations for that owned page and sends its name, description, and bio as OpenAI context. Instruction files (a name plus text, stored in MongoDB) can be created at user level (all chats) or page level (that page's chats) and are selected per conversation in the chat UI; selected files are appended to the developer message after the page context. Users can edit them manually, or ask the assistant in chat to change one, which shows a proposed diff that is only saved when the user applies it. Assistant responses stream into the browser, while the backend persists completed replies and retains user messages when a provider request fails.

## Validate

```bash
cd frontend
npm run lint
npm run build

cd ../backend
./mvnw test
./mvnw package
```
