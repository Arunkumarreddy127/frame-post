import {
  useEffect,
  useMemo,
  useState,
  type DragEvent,
  type FormEvent,
} from "react";
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Pencil,
  Play,
  Trash2,
} from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { useConfirm } from "../components/ConfirmDialog";
import { useFilesWorkspaceContext } from "../components/files/FilesWorkspaceProvider";
import { LibraryPicker } from "../components/library/LibraryPicker";
import { MediaViewer } from "../components/media/MediaViewer";
import { GptImageGenPage } from "./GptImageGenPage";
import { RunningHubWorkflowPage } from "./RunningHubWorkflowPage";
import {
  addCreationItem,
  deleteCreation,
  errorMessage,
  getCreation,
  groupedGenerationIds,
  listCreationItems,
  notifyCreationsChanged,
  removeCreationItem,
  reorderCreationItems,
  updateCreation,
} from "../creationApi";
import { getCatalog } from "../generationApi";
import { formatDate } from "../format";
import type {
  Creation,
  CreationItem,
  Generation,
  MediaItem,
  ShellRouteProps,
  Workflow,
} from "../types";

type CreationDetailPageProps = ShellRouteProps & { pageId?: string };
type View = "feed" | "grouped" | "storyboard";
type SortOrder = "latest" | "earliest" | "manual";

const VIEWS: { value: View; label: string }[] = [
  { value: "feed", label: "Feed" },
  { value: "grouped", label: "Grouped by tool" },
  { value: "storyboard", label: "Storyboard" },
];

const VIEW_HINTS: Record<View, string> = {
  feed: "All items in order. Drag cards or use the arrows to reorder.",
  grouped: "Items grouped by the tool that made them. Order is not editable here.",
  storyboard: "Ordered steps with lanes and links to the step they follow.",
};

function toolLabel(generation: Generation) {
  if (generation.provider === "OPENAI") return "GPT Image";
  return generation.workflowKey
    ? `RunningHub · ${generation.workflowKey}`
    : "RunningHub";
}

function Thumb({
  generation,
  onOpen,
}: {
  generation: Generation;
  onOpen: (item: MediaItem) => void;
}) {
  const output = generation.outputs[0];
  if (!output) {
    return (
      <div className="creation-thumb creation-thumb-empty">
        {generation.status === "FAILED" ? "Failed" : "Pending"}
      </div>
    );
  }
  if (output.mediaType === "video") {
    return (
      <button
        type="button"
        className="creation-thumb creation-thumb-button"
        aria-label={`View video: ${output.name}`}
        onClick={() => onOpen(output)}
      >
        <video src={output.url} muted playsInline preload="metadata" />
        <span className="creation-thumb-play" aria-hidden="true">
          <Play size={16} fill="currentColor" />
        </span>
      </button>
    );
  }
  return (
    <button
      type="button"
      className="creation-thumb creation-thumb-button"
      aria-label={`View image: ${output.name}`}
      onClick={() => onOpen(output)}
    >
      <img src={output.url} alt="" loading="lazy" />
    </button>
  );
}

export function CreationDetailPage({
  user,
  onLogout,
  pageId,
}: CreationDetailPageProps) {
  const { creationId = "" } = useParams<{ creationId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { closePageTab, setCreationTabLabel } = useFilesWorkspaceContext();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const base = pageId ? `/pages/${pageId}` : "";

  const [creation, setCreation] = useState<Creation | null>(null);
  const [items, setItems] = useState<CreationItem[]>([]);
  const [view, setView] = useState<View>("feed");
  const [sortOrder, setSortOrder] = useState<SortOrder>("latest");
  const [viewing, setViewing] = useState<MediaItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");

  const [pickerOpen, setPickerOpen] = useState(false);
  const [newGenerationOpen, setNewGenerationOpen] = useState(false);
  const [selectedTool, setSelectedTool] = useState("");
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [toolsLoading, setToolsLoading] = useState(false);
  const [toolsError, setToolsError] = useState("");
  const [pickerLane, setPickerLane] = useState("");
  const [pickerParent, setPickerParent] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);

  async function refresh() {
    const [next, list] = await Promise.all([
      getCreation(pageId, creationId),
      listCreationItems(pageId, creationId),
    ]);
    setCreation(next);
    setItems(list);
  }

  useEffect(() => {
    if (!newGenerationOpen || workflows.length > 0) return;
    let cancelled = false;
    setToolsLoading(true);
    setToolsError("");
    getCatalog()
      .then(({ runningHubWorkflows }) => {
        if (!cancelled) setWorkflows(runningHubWorkflows);
      })
      .catch((requestError: unknown) => {
        if (!cancelled) {
          setToolsError(errorMessage(requestError, "Unable to load create tools"));
        }
      })
      .finally(() => {
        if (!cancelled) setToolsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [newGenerationOpen, workflows.length]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all([
      getCreation(pageId, creationId),
      listCreationItems(pageId, creationId),
    ])
      .then(([next, list]) => {
        if (cancelled) return;
        setCreation(next);
        setItems(list);
      })
      .catch((requestError: unknown) => {
        if (!cancelled) {
          setError(errorMessage(requestError, "Unable to load creation"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pageId, creationId]);

  useEffect(() => {
    if (creation) setCreationTabLabel(creationId, creation.name);
  }, [creation?.name, creationId, setCreationTabLabel]);

  const displayedItems = useMemo(() => {
    if (sortOrder === "manual") return items;
    const direction = sortOrder === "latest" ? -1 : 1;
    return [...items].sort((first, second) => {
      const dateOrder =
        (Date.parse(first.addedAt) - Date.parse(second.addedAt)) * direction;
      return dateOrder || first.position - second.position;
    });
  }, [items, sortOrder]);

  const viewerItems = useMemo(
    () => displayedItems.flatMap((item) => item.generation.outputs),
    [displayedItems],
  );
  const mediaId = searchParams.get("media");

  const itemIndexById = useMemo(
    () => new Map(displayedItems.map((item, index) => [item.id, index])),
    [displayedItems],
  );

  useEffect(() => {
    if (!mediaId) {
      setViewing(null);
      return;
    }
    setViewing(viewerItems.find((item) => item.id === mediaId) ?? null);
  }, [mediaId, viewerItems]);

  function showMedia(item: MediaItem, replace = true) {
    setViewing(item);
    const next = new URLSearchParams(searchParams);
    next.set("media", item.id);
    setSearchParams(next, { replace });
  }

  function openMedia(item: MediaItem) {
    showMedia(item, false);
  }

  function closeMediaViewer() {
    setViewing(null);
    const next = new URLSearchParams(searchParams);
    next.delete("media");
    setSearchParams(next, { replace: true });
  }

  function togglePicker() {
    setPickerOpen((open) => !open);
  }

  async function addSelectedMedia(media: MediaItem[]) {
    const generationIds = [...new Set(media.map((item) => item.generationId))];
    if (generationIds.length === 0) return;
    setError("");
    setBusy(true);
    try {
      const grouped = new Set(
        await groupedGenerationIds(pageId, generationIds),
      );
      if (grouped.size > 0) {
        throw new Error(
          `${grouped.size} selected ${
            grouped.size === 1 ? "generation is" : "generations are"
          } already in a creation. Deselect ${
            grouped.size === 1 ? "that file" : "those files"
          } and try again.`,
        );
      }
      for (const generationId of generationIds) {
        await addCreationItem(pageId, creationId, {
          generationId,
          laneId: pickerLane.trim() || undefined,
          parentItemId: pickerParent || undefined,
        });
      }
      await refresh();
      setPickerOpen(false);
    } catch (requestError) {
      throw new Error(
        errorMessage(requestError, "Unable to add selected files"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function persistOrder(next: CreationItem[]) {
    setBusy(true);
    setError("");
    try {
      const saved = await reorderCreationItems(
        pageId,
        creationId,
        next.map((item) => ({ itemId: item.id, laneId: item.laneId })),
      );
      setItems(saved);
    } catch (requestError) {
      setError(errorMessage(requestError, "Unable to save order"));
    } finally {
      setBusy(false);
    }
  }

  function moveTo(from: number, to: number) {
    if (from === to || to < 0 || to >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    void persistOrder(next);
  }

  function move(index: number, delta: number) {
    moveTo(index, index + delta);
  }

  function dragProps(index: number) {
    if (sortOrder !== "manual") return {};
    return {
      draggable: !busy,
      onDragStart: (event: DragEvent<HTMLLIElement>) => {
        setDragId(items[index].id);
        event.dataTransfer.effectAllowed = "move";
      },
      onDragOver: (event: DragEvent<HTMLLIElement>) => {
        if (dragId) event.preventDefault();
      },
      onDrop: (event: DragEvent<HTMLLIElement>) => {
        event.preventDefault();
        const from = items.findIndex((entry) => entry.id === dragId);
        setDragId(null);
        if (from >= 0) moveTo(from, index);
      },
      onDragEnd: () => setDragId(null),
    };
  }

  function saveLane(item: CreationItem, lane: string) {
    const trimmed = lane.trim() || null;
    if (trimmed === item.laneId) return;
    void persistOrder(
      items.map((entry) =>
        entry.id === item.id ? { ...entry, laneId: trimmed } : entry,
      ),
    );
  }

  async function removeItem(item: CreationItem) {
    const accepted = await confirm({
      title: "Remove from creation?",
      message: "The generation and its files are kept.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (!accepted) return;
    setBusy(true);
    setError("");
    try {
      await removeCreationItem(pageId, creationId, item.id);
      await refresh();
    } catch (requestError) {
      setError(errorMessage(requestError, "Unable to remove generation"));
    } finally {
      setBusy(false);
    }
  }

  function startEditing() {
    setDraftName(creation?.name ?? "");
    setDraftDescription(creation?.description ?? "");
    setEditing(true);
  }

  async function saveDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = draftName.trim();
    if (!trimmed) {
      setError("Give the creation a name.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const updated = await updateCreation(pageId, creationId, {
        name: trimmed,
        description: draftDescription.trim(),
      });
      setCreation(updated);
      notifyCreationsChanged();
      setEditing(false);
    } catch (requestError) {
      setError(errorMessage(requestError, "Unable to save creation"));
    } finally {
      setBusy(false);
    }
  }

  async function removeCreation() {
    const accepted = await confirm({
      title: `Delete “${creation?.name ?? "creation"}”?`,
      message:
        "The creation will be removed. Its generations and files are kept.",
      confirmLabel: "Delete creation",
      danger: true,
    });
    if (!accepted) return;
    setBusy(true);
    try {
      await deleteCreation(pageId, creationId);
      notifyCreationsChanged();
      closePageTab(`creation:${pageId ?? "global"}:${creationId}`);
      navigate(`${base}/creations`);
    } catch (requestError) {
      setError(errorMessage(requestError, "Unable to delete creation"));
      setBusy(false);
    }
  }

  function renderFeed() {
    return (
      <ol className="creation-list">
        {displayedItems.map((item, index) => (
          <li
            className={`panel creation-card${dragId === item.id ? " is-dragging" : ""}`}
            key={item.id}
            {...dragProps(index)}
          >
            <span className="creation-drag-handle" aria-hidden="true">
              <GripVertical size={16} />
            </span>
            <Thumb generation={item.generation} onOpen={openMedia} />
            <div className="creation-card-body">
              <p className="creation-card-prompt">
                {item.generation.inputs.prompt || "No prompt"}
              </p>
              <small>
                {toolLabel(item.generation)} · Added {formatDate(item.addedAt)}
              </small>
            </div>
            <CardActions
              busy={busy}
              index={index}
              total={items.length}
              reorderable={sortOrder === "manual"}
              onMove={(delta) => move(index, delta)}
              onRemove={() => void removeItem(item)}
            />
          </li>
        ))}
      </ol>
    );
  }

  function renderGrouped() {
    const groups = new Map<string, CreationItem[]>();
    displayedItems.forEach((item) => {
      const label = toolLabel(item.generation);
      groups.set(label, [...(groups.get(label) ?? []), item]);
    });
    return (
      <div className="creation-groups">
        {[...groups.entries()].map(([label, group]) => (
          <section className="creation-group" key={label}>
            <h3>
              {label} <span className="creation-count">{group.length}</span>
            </h3>
            <ul className="creation-grid">
              {group.map((item) => (
                <li className="creation-grid-item" key={item.id}>
                  <Thumb generation={item.generation} onOpen={openMedia} />
                  <p>{item.generation.inputs.prompt || "No prompt"}</p>
                  <button
                    type="button"
                    className="secondary-button danger-button creation-grid-remove"
                    disabled={busy}
                    onClick={() => void removeItem(item)}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    );
  }

  function renderStoryboard() {
    return (
      <ol className="creation-steps">
        {displayedItems.map((item, index) => {
          const parentIndex = item.parentItemId
            ? itemIndexById.get(item.parentItemId)
            : undefined;
          return (
            <li
              className={`creation-step${dragId === item.id ? " is-dragging" : ""}`}
              key={item.id}
              {...dragProps(index)}
            >
              <span className="creation-drag-handle" aria-hidden="true">
                <GripVertical size={16} />
              </span>
              <span className="creation-step-number">{index + 1}</span>
              <Thumb generation={item.generation} onOpen={openMedia} />
              <div className="creation-card-body">
                <p className="creation-card-prompt">
                  {item.generation.inputs.prompt || "No prompt"}
                </p>
                <small>
                  {parentIndex !== undefined
                    ? `Follows step ${parentIndex + 1} · `
                    : ""}
                  {toolLabel(item.generation)}
                </small>
                <label className="creation-lane">
                  Lane
                  <input
                    key={`${item.id}:${item.laneId ?? ""}`}
                    defaultValue={item.laneId ?? ""}
                    maxLength={64}
                    list="creation-lane-options"
                    placeholder="e.g. Reel A"
                    disabled={busy}
                    onBlur={(event) => saveLane(item, event.target.value)}
                  />
                </label>
              </div>
              <CardActions
                busy={busy}
                index={index}
                total={items.length}
                reorderable={sortOrder === "manual"}
                onMove={(delta) => move(index, delta)}
                onRemove={() => void removeItem(item)}
              />
            </li>
          );
        })}
      </ol>
    );
  }


  const laneOptions = [
    ...new Set(
      items
        .map((item) => item.laneId)
        .filter((lane): lane is string => Boolean(lane)),
    ),
  ];

  const content = loading ? (
    <div className="page-list" aria-busy="true" aria-label="Loading creation">
      <div className="page-card skeleton-card" />
    </div>
  ) : !creation ? null : (
    <>
      <header className="app-page-header creation-detail-header">
        <div>
          <p className="eyebrow">Creation</p>
          <h2 className="app-page-title">{creation.name}</h2>
          {creation.description && (
            <p className="app-page-description">{creation.description}</p>
          )}
          <small>
            {creation.itemCount}{" "}
            {creation.itemCount === 1 ? "item" : "items"} · Updated{" "}
            {formatDate(creation.updatedAt)}
          </small>
        </div>
        <div className="creation-header-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={startEditing}
            disabled={busy}
          >
            <Pencil size={14} aria-hidden="true" /> Edit
          </button>
          <button
            type="button"
            className="secondary-button danger-button"
            onClick={() => void removeCreation()}
            disabled={busy}
          >
            <Trash2 size={14} aria-hidden="true" /> Delete
          </button>
        </div>
      </header>

      {editing && (
        <form className="panel creation-form" onSubmit={saveDetails}>
          <label>
            Name
            <input
              value={draftName}
              maxLength={120}
              onChange={(event) => setDraftName(event.target.value)}
              required
            />
          </label>
          <label>
            Description
            <textarea
              value={draftDescription}
              maxLength={2000}
              rows={2}
              onChange={(event) => setDraftDescription(event.target.value)}
            />
          </label>
          <div className="creation-form-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
            <button className="primary-button" type="submit" disabled={busy}>
              Save
            </button>
          </div>
        </form>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div className="creation-toolbar">
        <div className="creation-toolbar-main">
          <div className="creation-view-controls">
            <div className="creation-view-switch" role="group" aria-label="View">
              {VIEWS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={view === option.value ? "is-active" : ""}
                  aria-pressed={view === option.value}
                  onClick={() => setView(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <label className="creation-sort-control">
              Sort
              <select
                value={sortOrder}
                onChange={(event) =>
                  setSortOrder(event.target.value as SortOrder)
                }
              >
                <option value="latest">Latest</option>
                <option value="earliest">Earliest</option>
                <option value="manual">Manual order</option>
              </select>
            </label>
          </div>
          <p className="creation-view-hint">
            {sortOrder === "manual"
              ? VIEW_HINTS[view]
              : `Items sorted by when they were added, ${
                  sortOrder === "latest" ? "latest" : "earliest"
                } first. Select Manual order to reorder them.`}
          </p>
        </div>
        <div className="creation-toolbar-actions">
          <button
            type="button"
            className="primary-button"
            aria-expanded={newGenerationOpen}
            aria-controls="creation-new-generation"
            onClick={() => {
              setNewGenerationOpen((open) => !open);
              setSelectedTool("");
            }}
          >
            {newGenerationOpen ? "Close generator" : "New generation"}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={togglePicker}
            aria-expanded={pickerOpen}
          >
            {pickerOpen ? "Close picker" : "Add existing"}
          </button>
        </div>
      </div>

      {newGenerationOpen && (
        <section
          id="creation-new-generation"
          className="panel creation-generator-panel"
          aria-label="Create a generation"
        >
          <label className="creation-tool-select">
            Create tool
            <select
              value={selectedTool}
              onChange={(event) => setSelectedTool(event.target.value)}
              disabled={toolsLoading}
            >
              <option value="">
                {toolsLoading ? "Loading tools…" : "Select a create tool"}
              </option>
              <option value="image">GPT Image</option>
              {workflows.map((workflow) => (
                <option
                  key={workflow.key}
                  value={`rh:${workflow.key}`}
                  disabled={!pageId}
                >
                  {workflow.label}
                  {!pageId ? " (requires a page)" : ""}
                </option>
              ))}
            </select>
          </label>
          {toolsError && (
            <p className="error" role="alert">
              {toolsError}
            </p>
          )}
          {selectedTool === "image" && (
            <GptImageGenPage
              user={user}
              onLogout={onLogout}
              pageId={pageId}
              embedded
              creationId={creationId}
              onCreationItemAdded={() => {
                void refresh().catch((requestError: unknown) =>
                  setError(errorMessage(requestError, "Unable to refresh creation")),
                );
              }}
            />
          )}
          {selectedTool.startsWith("rh:") && (
            <RunningHubWorkflowPage
              key={selectedTool}
              user={user}
              onLogout={onLogout}
              pageId={pageId}
              workflowKey={selectedTool.slice(3)}
              embedded
              creationId={creationId}
              onCreationItemAdded={() => {
                void refresh().catch((requestError: unknown) =>
                  setError(errorMessage(requestError, "Unable to refresh creation")),
                );
              }}
            />
          )}
        </section>
      )}

      {pickerOpen && (
        <LibraryPicker
          pageId={pageId}
          accept={["image/*", "video/*"]}
          limit={24}
          excludeGenerationIds={new Set(items.map((item) => item.generation.id))}
          title="Add existing files"
          actionLabel="Add selected"
          onSelect={addSelectedMedia}
          onClose={togglePicker}
          beforeGrid={
            <div className="creation-picker-options">
              <label>
                Lane for new items
                <input
                  value={pickerLane}
                  maxLength={64}
                  placeholder="Optional"
                  list="creation-lane-options"
                  onChange={(event) => setPickerLane(event.target.value)}
                />
                <small>Applied to the items you add now.</small>
              </label>
              <label>
                Follows
                <select
                  value={pickerParent}
                  onChange={(event) => setPickerParent(event.target.value)}
                >
                  <option value="">Nothing</option>
                  {displayedItems.map((item, index) => (
                    <option key={item.id} value={item.id}>
                      Step {index + 1}
                    </option>
                  ))}
                </select>
                <small>Places added items after this step in the storyboard.</small>
              </label>
            </div>
          }
        />
      )}

      <datalist id="creation-lane-options">
        {laneOptions.map((lane) => (
          <option key={lane} value={lane} />
        ))}
      </datalist>

      {items.length === 0 ? (
        <div className="empty-state creation-empty">
          <p>This creation is empty. Start a new generation or add existing ones.</p>
          <div className="creation-empty-actions">
            <button
              type="button"
              className="primary-button"
              onClick={() => {
                setNewGenerationOpen(true);
                setSelectedTool("");
              }}
            >
              New generation
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={togglePicker}
            >
              Add existing
            </button>
          </div>
        </div>
      ) : view === "feed" ? (
        renderFeed()
      ) : view === "grouped" ? (
        renderGrouped()
      ) : (
        renderStoryboard()
      )}

    </>
  );

  return (
    <AppShell
      user={user}
      onLogout={onLogout}
      pageTitle={creation?.name ?? "Creation"}
      sidebar={pageId ? "page" : "global"}
      pageId={pageId}
      backTo={`${base}/creations`}
    >
      {!loading && !creation && error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : (
        content
      )}
      {confirmDialog}
      {viewing && (
        <MediaViewer
          item={viewing}
          items={viewerItems}
          alt={
            displayedItems
              .map((entry) => entry.generation)
              .find((generation) =>
                generation.outputs.some((output) => output.id === viewing.id),
              )?.inputs.prompt
          }
          onSelect={(item) => showMedia(item)}
          onClose={closeMediaViewer}
        />
      )}
    </AppShell>
  );
}

function CardActions({
  busy,
  index,
  total,
  reorderable,
  onMove,
  onRemove,
}: {
  busy: boolean;
  index: number;
  total: number;
  reorderable: boolean;
  onMove: (delta: number) => void;
  onRemove: () => void;
}) {
  return (
    <div className="creation-card-actions">
      {reorderable && (
        <>
          <button
            type="button"
            className="icon-button"
            aria-label="Move up"
            title="Move up"
            disabled={busy || index === 0}
            onClick={() => onMove(-1)}
          >
            <ChevronUp size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Move down"
            title="Move down"
            disabled={busy || index === total - 1}
            onClick={() => onMove(1)}
          >
            <ChevronDown size={16} aria-hidden="true" />
          </button>
        </>
      )}
      <button
        type="button"
        className="secondary-button danger-button creation-card-remove"
        disabled={busy}
        onClick={onRemove}
      >
        <Trash2 size={14} aria-hidden="true" />
        Remove
      </button>
    </div>
  );
}
