# Framepost Workspace Instructions

- Keep this workspace focused on explicitly requested product features.
- Use React, TypeScript, and Vite for the frontend.
- Use Java 21, Spring Boot, and Maven for the backend.
- Keep secrets in environment variables; never commit `.env` or credentials.
- Use MongoDB for persistence and the `StorageService` abstraction for Cloudflare R2.
- Do not add Instagram, publishing, uploads, scheduling, analytics, comments, webhooks, or dashboard functionality without explicit approval.

## Terminology

- **GenerationComposer**: the Create-page prompt box (`.image-gen-prompt`) with the prompt textarea, attach button, labeled setting dropdowns (`.image-gen-control`), and the blue submit arrow (`.image-gen-prompt-actions`). It appears in `GptImageGenPage.tsx` and `RunningHubWorkflowPage.tsx` (`/create/gpt-image-gen`, `/create/rh/:workflowKey`). It is not the chat page's `.chat-composer`.
