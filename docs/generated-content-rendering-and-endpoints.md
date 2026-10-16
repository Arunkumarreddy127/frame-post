# Generated Content Rendering and API Endpoints

This document describes how generated content is displayed in GPT Image Generation, RunningHub Workflow, and Library, and which backend endpoints those pages call.

All browser requests use the configured API base URL and include the authenticated session cookie.

## GPT Image Generation

### Rendering

The page loads the user's image-generation history and renders one article per generation. Each article contains a tile for every result image, followed by generation settings and a truncated prompt. Failed generations show an error instead of the image grid.

The result URLs are included in the image API response; the page uses them directly for image previews and full-screen viewing. The backend maps stored R2 object keys to URLs. Attachments have local browser previews. Editing a previous result displays its thumbnail, restores the prompt/settings, and reloads the generation's original input images.

Each result supports full view, edit, download, and deletion. Downloads and reloading original inputs use the authenticated download endpoint. New generations are added to the top of the current history after the request completes.

### Endpoints called

| When                                      | Method and path                             | Purpose                                            |
| ----------------------------------------- | ------------------------------------------- | -------------------------------------------------- |
| Page load                                 | `GET /api/images/models`                    | Load available image models.                       |
| Page load, global workspace               | `GET /api/images`                           | Load global image-generation history.              |
| Page load, page workspace                 | `GET /api/pages/{pageId}/images`            | Load history for that page.                        |
| Generate, global workspace                | `POST /api/images/generate`                 | Submit a multipart generation request.             |
| Generate, page workspace                  | `POST /api/pages/{pageId}/images/generate`  | Submit a multipart page-scoped generation request. |
| Delete, global workspace                  | `DELETE /api/images/{id}`                   | Delete a generation.                               |
| Delete, page workspace                    | `DELETE /api/pages/{pageId}/images/{id}`    | Delete a page-scoped generation.                   |
| Download result or reload original inputs | `GET /api/images/download?key={storageKey}` | Fetch the stored media as a download.              |

The generate request includes the prompt, model, size, quality, count, optional attachment files, and optional parent generation/result identifiers when editing.

## RunningHub Workflow

### Rendering

The page loads the workflow definition selected by the route key and builds its input form from that definition. Its result panel displays a placeholder before a generation is selected, a progress state while the selected generation is processing, an error when it fails, and the completed output as an image or controlled video according to the result type.

The history list is scoped to the current page and workflow. Selecting an entry changes the result shown in the main panel. While generations are processing, the page subscribes to their Server-Sent Events (SSE) streams and updates the corresponding history items; the stream is closed when a generation reaches a final state. Result URLs arrive in the API responses.

### Endpoints called

| When                                              | Method and path                                                            | Purpose                                            |
| ------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------- |
| Page load                                         | `GET /api/runninghub/workflows`                                            | Load workflow definitions and configuration state. |
| Page load, when a page and workflow are available | `GET /api/pages/{pageId}/runninghub/{workflowKey}/generations`             | Load history for that page and workflow.           |
| Generate                                          | `POST /api/pages/{pageId}/runninghub/{workflowKey}/generations`            | Submit workflow inputs as multipart form data.     |
| While a generation is processing                  | `GET /api/pages/{pageId}/runninghub/{workflowKey}/generations/{id}/events` | Receive status and result updates over SSE.        |

The generate request's multipart fields are named after workflow inputs and also include `instanceType`.

The backend also defines `GET /api/pages/{pageId}/runninghub/{workflowKey}/generations/{id}`, but this page does not call it directly. The backend uses it while validating and sending the initial SSE snapshot. `POST /api/webhooks/runninghub/{secret}` is a server-to-server callback, not a browser request from this page.

## Library

### Rendering

The Library page fetches a combined list of stored inputs and outputs, then presents them in two folders. Choosing Inputs or Outputs only filters the already-fetched data in the browser; it does not make another request.

Each file card renders an image preview for `image/*`, a controlled video preview for `video/*`, or the filename for other content types. Cards show the filename and offer a download action. The backend builds Library entries from shared generation records, includes provider/source metadata, derives a content type when needed, maps storage keys to URLs, and sorts each folder newest-first. The current cards do not visibly display the source/provider label.

Global Library includes the user's files across global and page scopes. Page Library includes only files associated with that page.

### Endpoints called

| When                        | Method and path                             | Purpose                                           |
| --------------------------- | ------------------------------------------- | ------------------------------------------------- |
| Page load, global workspace | `GET /api/library`                          | Load the user's inputs and outputs across scopes. |
| Page load, page workspace   | `GET /api/pages/{pageId}/library`           | Load inputs and outputs for one page.             |
| Download a file             | `GET /api/images/download?key={storageKey}` | Fetch the stored media as a download.             |

## Backend route references

- Image routes: `backend/src/main/java/com/example/framepost/image/ImageGenerationController.java`
- RunningHub routes: `backend/src/main/java/com/example/framepost/runninghub/RunningHubController.java`
- Library routes: `backend/src/main/java/com/example/framepost/library/LibraryController.java`
- Library aggregation and URL construction: `backend/src/main/java/com/example/framepost/library/LibraryService.java`
