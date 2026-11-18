# Browser Video Upscaler Plan

Status: approved direction, not started. Phase 1 is awaiting approval.

## Goal

Add a Create tool at `/create/browser-upscale` that upscales a video or image in the user's browser using WebGPU, then saves the result to R2 through the backend so it appears in the Library.

## Decisions

- **Approach:** client + R2. Processing runs in the browser, and the backend stores the finished output.
- **Route and label:** `/create/browser-upscale`, labeled "Upscale (browser)". It is listed in the Create page under a new section, separate from the RunningHub `seedvr2-video-upscale` workflow, which stays unchanged.
- **Model:** Anime4K CNN 2x (MIT, from [bloc97/Anime4K](https://github.com/bloc97/Anime4K)). Port the algorithm to WGSL. Do not copy weights or code from third-party sites.
- **Output scale:** 2x as one pass. 4x as two chained 2x passes. Both are supported.
- **Fallback:** WebGL2 when WebGPU is unavailable. Show an "Unsupported" message when neither is available.

## Pipeline (browser)

1. Demux the MP4/MOV input with MP4Box.js.
2. Decode frames with WebCodecs `VideoDecoder`.
3. Upscale each frame with the Anime4K CNN on WebGPU compute shaders.
4. Encode frames with WebCodecs `VideoEncoder`. Pick the codec with `VideoEncoder.isConfigSupported`.
5. Mux the output with mediabunny.

## Backend (client + R2)

- Add `BROWSER` to `ContentGeneration.Provider` in `backend/src/main/java/com/example/framepost/generation/ContentGeneration.java`.
- Add an upload endpoint that accepts the processed file and metadata. It stores the object through `StorageService` and records a completed generation with `ContentOutput` rows in `content_generations`.
- Keep the existing `OPENAI` and `RUNNINGHUB` provider paths unchanged.
- Use the existing per-user key scoping (`StorageKeys.ownedBy`) for access checks.

## Frontend

- New page for `/create/browser-upscale`, with the same route wiring as `GptImageGenPage` and `RunningHubWorkflowPage`.
- Entry in `frontend/src/pages/CreatePage.tsx`.
- Library support for the `BROWSER` provider in `frontend/src/pages/LibraryPage.tsx`.

## Phases

1. **Prototype (no app integration):** Anime4K CNN 2x on WebGPU for a single image, with a side-by-side visual comparison against bicubic.
2. **Video pipeline and page:** WebCodecs decode, upscale, and encode with mediabunny. Download only.
3. **Backend and Library:** `BROWSER` provider, R2 upload, Library rendering, and tests.

## Risks

- **Port correctness:** the CNN port must match the reference output. Validate frame by frame against the MIT reference.
- **Performance:** 4x doubles per-frame cost. Long or high-resolution videos may be slow or exhaust GPU memory.
- **Browser support:** Chromium-based browsers are the most reliable for WebGPU and WebCodecs. Firefox and Safari may need the WebGL2 path.
- **Upload size:** large processed videos need the same size limits as existing uploads. Confirm the limits before Phase 3.

## Open questions

- Confirm the upload size limit for processed videos.
- Decide whether 4x should be offered by default or only as an advanced option.
