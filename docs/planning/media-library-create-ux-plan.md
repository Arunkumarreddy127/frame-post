# Plan: Consistent media browsing across Library and Create

## Goal

Make images and videos feel like the same media objects in Library and Create, with consistent
previews and actions, and an obvious way to inspect where media came from and what it was used to
create.

Keep the work focused on existing generation and library behavior. This plan does not add publishing,
scheduling, uploads, analytics, comments, webhooks, or dashboard functionality.

## Implementation status

Implemented in the current worktree:

- Library, Create results, and the Library picker use shared media tiles; Library and Create share a
  full-size viewer with details, keyboard navigation, URL-addressable selection, and prompt copying.
- Source inputs, parent results, and derived outputs can be followed from the viewer. The backend
  exposes a paginated, user- and page-scoped child-generation lookup.
- Library-to-Create links restore the selected output or source input, prompt, settings, and workflow
  inputs where supported.
- Library browsing combines inputs and outputs with role/type/source filters and optional grouping;
  generation-wide deletion is described and counted before confirmation.

## Current experience

- Library media is rendered by `frontend/src/components/library/LibraryMediaGrid.tsx` as fixed
  4:3 cards. `object-fit: cover` can crop previews. The card actions are always-visible text buttons.
- Create results are rendered by `frontend/src/components/generations/GenerationTile.tsx` and
  `GenerationArticle.tsx`. Their previews and hover actions use a different layout, with prompt and
  generation settings shown below the results.
- Full-size viewing is owned by `GenerationFeed`, so Library has no equivalent viewer.
- The generation model already carries `inputFiles`, `parentGenerationId`, and `parentResultKey`.
  The Create feed shows only a non-interactive "Edited from a previous image" label. The Library's
  "Open in generator" action navigates to a generator but does not select or restore the chosen item.
- The Library delete action is presented on a single media card, but deleting the item deletes its
  entire generation and associated files.

## Target experience

### Shared media presentation

- Create a shared media tile for Library, Create results, and the Library picker.
- Keep media-specific actions, type indicators, focus behavior, and preview rules consistent.
  Allow layout variants for the different contexts without duplicating interaction behavior.
- Preserve the full image composition: use consistent square preview frames with `contain` rather
  than cropping important parts of generated images.
- For video, show a preview/poster and clear play affordance. Keep playback controls in the viewer
  rather than covering card actions.
- Make actions discoverable on touch and keyboard as well as hover.

### Shared media viewer and details

- Extract a reusable viewer from `GenerationFeed` and make it available from both Library and Create.
- Provide previous/next navigation within the current result set, keyboard navigation, and Escape
  to close.
- Add a details panel for the selected item with its prompt, generation settings, date, and available
  file metadata.
- Show source inputs and parent media as clickable thumbnails under **Made from**. Where child
  generations exist, show them under **Used to make**. Selecting a related thumbnail opens it in
  the same viewer, allowing users to follow the lineage.
- Prefer a URL-addressable selected item (for example, a media query parameter) so opening,
  refreshing, and browser back/forward navigation behave predictably.

### Clear Library navigation and actions

- Replace the current split Inputs/Outputs landing experience with a browsable media collection.
  Offer filters for input/output, image/video, and media with source information.
- Add an optional **Group by generation** view that places inputs and outputs together.
- Show a compact lineage indicator on tiles, such as the number of inputs or that an item was made
  from another image. Make it open the viewer at the relevant source.
- Make **Open in generator** restore the selected media and its generation context, rather than only
  navigating to the generator. Reuse the existing Create edit/restoration flow where possible.
- Make destructive scope explicit: label the action and confirmation as deleting the generation
  and its associated files, including the number of affected files when available.

## Implementation phases

### Phase 1: Shared tile and viewer

1. Extract the full-size viewer behavior from `GenerationFeed` into a reusable component.
2. Introduce a shared media tile for the Library and generation results, preserving their existing
   layouts where needed through simple presentation variants.
3. Use the same tile in the Library picker with a selection affordance.
4. Add viewer entry points to Library and picker tiles.

**Acceptance criteria**

- Images and videos can be opened full-size from both Library and Create.
- Download, edit/open, and delete behavior still works in each existing context.
- Previews do not unexpectedly crop source content, and video controls do not obscure tile actions.
- Keyboard and touch users can access the same actions.

### Phase 2: Lineage details

1. Add the details panel to the shared viewer, using generation data already available to each
   surface.
2. Render input files and parent media as navigable source thumbnails.
3. Replace the static edited-from label with a link to the source item.
4. Determine whether the current API can efficiently find child generations. If not, add a
   user/page-scoped read-only lookup based on `parentGenerationId`; follow existing authorization
   and pagination conventions.
5. Add child media to the viewer's **Used to make** section.

**Acceptance criteria**

- When source/parent data exists, users can open it directly from the media details.
- When child data exists, users can see and navigate to derived items.
- Missing lineage is represented as unavailable/no source, not as an error or fabricated relation.
- Relationship lookups remain scoped to the current user and page.

### Phase 3: Restore context from Library

1. Pass a stable generation and result identifier when navigating from a Library item to Create.
2. Initialize the Create page from that identifier using the existing generation restoration/edit
   behavior.
3. Keep the currently selected media visible and make its role clear when it is being used as an
   input or edit source.

**Acceptance criteria**

- Opening an output from Library takes the user to the correct generator and restores the selected
  output's prompt/settings/source context where supported.
- Navigation remains correctly scoped to the item's page or the global workspace.
- Failed or unavailable restoration reports a useful error and does not silently discard the item.

### Phase 4: Library browsing and deletion clarity

1. Add unified browsing with input/output, media-type, and source-availability filters.
2. Add **Group by generation** as a way to inspect inputs and outputs together.
3. Add lineage indicators and update responsive card actions.
4. Update delete labels and confirmation to clearly describe generation-wide deletion and its
   impact.

**Acceptance criteria**

- Users can find images and videos without first guessing whether they are in Inputs or Outputs.
- Grouped view visibly connects each generation's inputs and outputs.
- Deletion scope is clear before the user confirms.
- Existing paging, empty, loading, and error states continue to work.

## Technical notes

- Shared UI lives in `frontend/src/components/media/MediaTile.tsx` and
  `MediaViewer.tsx`. Existing UI entry points include
  `frontend/src/components/generations/GenerationTile.tsx`,
  `GenerationArticle.tsx`, `GenerationFeed.tsx`, `frontend/src/components/library/LibraryMediaGrid.tsx`,
  `LibraryPicker.tsx`, and `frontend/src/pages/LibraryPage.tsx`.
- Existing `MediaItem` and `Generation` types are in `frontend/src/types.ts`. Prefer using these
  contracts; lineage metadata is returned by the generation API, including source counts for stored
  outputs.
- Child generations are available from the scoped `/generations/{id}/children` endpoint, with the
  page-scoped route under `/pages/{pageId}`.
- Keep the generation-scoped delete contract intact unless product requirements explicitly change.
- Avoid duplicating download, viewer, delete-confirmation, and selection interaction logic across
  Library and Create.

## Suggested delivery order

1. Phase 1 (shared tile and viewer)
2. Phase 2 (lineage details and any required scoped child lookup)
3. Phase 3 (restore Create context from Library)
4. Phase 4 (unified Library browsing and clearer deletion)

## Verification

- Add or update frontend tests for shared tile actions, viewer open/close/navigation, URL state,
  and selected-item restoration.
- Add backend tests for any new child lookup, including user/page authorization and empty results.
- Run the focused frontend tests and build, plus focused backend tests if the API changes.
- Manually verify desktop, narrow/mobile, keyboard-only, image, video, no-source, and derived-media
  flows.
