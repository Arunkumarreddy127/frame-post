import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  ChevronRight,
  Clock,
  Layers,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { useConfirm } from "../components/ConfirmDialog";
import { useFilesWorkspaceContext } from "../components/files/FilesWorkspaceProvider";
import {
  toolLabel,
} from "../components/creations/CreationThumb";
import { ProductionBoard } from "../components/creations/ProductionBoard";
import { SceneWorkspace } from "../components/creations/SceneWorkspace";
import { ShotWorkspace } from "../components/creations/ShotWorkspace";
import { adjacentShots, findShot } from "../components/creations/shotTarget";
import { adjacentScenes, findScene } from "../components/creations/sceneTarget";
import { LibraryPicker } from "../components/library/LibraryPicker";
import { MediaViewer } from "../components/media/MediaViewer";
import { GptImageGenPage } from "./GptImageGenPage";
import { RunningHubWorkflowPage } from "./RunningHubWorkflowPage";
import {
  addCreationItem,
  deleteCreation,
  errorMessage,
  getCreation,
  getOutline,
  listCreationItems,
  notifyCreationsChanged,
  updateCreation,
} from "../creationApi";
import { getCatalog } from "../generationApi";
import { formatDate } from "../format";
import type {
  Creation,
  CreationItem,
  CreationOutline,
  CreationTool,
  MediaItem,
  ShellRouteProps,
  Workflow,
} from "../types";
import { ACTION_TOOLS, actionLabel } from "../creationTools";

type CreationDetailPageProps = ShellRouteProps & { pageId?: string };
type SortOrder = "latest" | "earliest" | "manual";

function optionsFor(tool: CreationTool, workflows: Workflow[]) {
  const options: { value: string; label: string }[] = [];
  if (tool === "IMAGE") options.push({ value: "image", label: "GPT Image" });
  for (const workflow of workflows) {
    if (workflow.tool === tool) {
      options.push({ value: `rh:${workflow.key}`, label: workflow.label });
    }
  }
  return options;
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
  const [outline, setOutline] = useState<CreationOutline | null>(null);
  const shotParam = searchParams.get("shot");
  const sceneParam = searchParams.get("scene");
  const [sortOrder, setSortOrder] = useState<SortOrder>("latest");
  const [viewing, setViewing] = useState<MediaItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");

  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeTool, setActiveTool] = useState<CreationTool | null>(null);
  const [generatorShotId, setGeneratorShotId] = useState<string | null>(null);
  const [generatorSceneId, setGeneratorSceneId] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState("");
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [toolsLoading, setToolsLoading] = useState(false);
  const [toolsError, setToolsError] = useState("");
  const [pickerParent, setPickerParent] = useState("");
  const [pickerShotId, setPickerShotId] = useState("");

  async function refresh() {
    const [next, list, nextOutline] = await Promise.all([
      getCreation(pageId, creationId),
      listCreationItems(pageId, creationId),
      getOutline(pageId, creationId),
    ]);
    setCreation(next);
    setItems(list);
    setOutline(nextOutline);
  }

  useEffect(() => {
    if (workflows.length > 0) return;
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
  }, [workflows.length]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all([
      getCreation(pageId, creationId),
      listCreationItems(pageId, creationId),
      getOutline(pageId, creationId),
    ])
      .then(([next, list, nextOutline]) => {
        if (cancelled) return;
        setCreation(next);
        setItems(list);
        setOutline(nextOutline);
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

  const shotLocation = outline && shotParam ? findShot(outline, shotParam) : null;
  const shotNeighbours =
    outline && shotLocation ? adjacentShots(outline, shotLocation.shot.id) : null;
  const sceneLocation = outline && sceneParam ? findScene(outline, sceneParam) : null;
  const sceneNeighbours =
    outline && sceneLocation ? adjacentScenes(outline, sceneLocation.scene.id) : null;

  function openShot(shotId: string) {
    closeGenerator();
    const next = new URLSearchParams(searchParams);
    next.set("shot", shotId);
    setSearchParams(next);
  }

  function closeShot() {
    closeGenerator();
    const next = new URLSearchParams(searchParams);
    next.delete("shot");
    setSearchParams(next);
  }

  function openScene(sceneId: string) {
    closeGenerator();
    const next = new URLSearchParams(searchParams);
    next.set("scene", sceneId);
    next.delete("shot");
    setSearchParams(next);
  }

  function closeScene() {
    closeGenerator();
    const next = new URLSearchParams(searchParams);
    next.delete("scene");
    next.delete("shot");
    setSearchParams(next);
  }

  function closeMediaViewer() {
    setViewing(null);
    const next = new URLSearchParams(searchParams);
    next.delete("media");
    setSearchParams(next, { replace: true });
  }

  function togglePicker() {
    setPickerOpen((open) => !open);
    setPickerShotId("");
  }

  function openGenerator(
    tool: CreationTool,
    target: { shotId?: string | null; sceneId?: string | null } = {},
  ) {
    const first = optionsFor(tool, workflows)[0];
    setActiveTool(tool);
    setGeneratorShotId(target.shotId ?? null);
    setGeneratorSceneId(target.sceneId ?? null);
    setSelectedTool(first?.value ?? "");
  }

  function closeGenerator() {
    setActiveTool(null);
    setGeneratorShotId(null);
    setGeneratorSceneId(null);
    setSelectedTool("");
  }

  const toolCount = useMemo(
    () => new Set(items.map((item) => toolLabel(item.generation))).size,
    [items],
  );
  const hasCreateActions = ACTION_TOOLS.some(
    (tool) => optionsFor(tool, workflows).length > 0,
  );

  function renderActionButtons(className: string) {
    return ACTION_TOOLS.filter((tool) => optionsFor(tool, workflows).length > 0).map(
      (tool) => (
        <button
          key={tool}
          type="button"
          className={className}
          aria-expanded={activeTool === tool}
          aria-controls="creation-new-generation"
          onClick={() => openGenerator(tool)}
        >
          {actionLabel(tool, workflows)}
        </button>
      ),
    );
  }

  function openShotPicker(shotId: string) {
    setPickerShotId(shotId);
    setPickerOpen(true);
  }

  async function addSelectedMedia(media: MediaItem[]) {
    const generationIds = [...new Set(media.map((item) => item.generationId))];
    if (generationIds.length === 0) return;
    setError("");
    setBusy(true);
    try {
      for (const generationId of generationIds) {
        await addCreationItem(pageId, creationId, {
          generationId,
          shotId: pickerShotId || undefined,
          parentItemId: pickerShotId ? undefined : pickerParent || undefined,
        });
      }
      await refresh();
      setPickerOpen(false);
      setPickerShotId("");
    } catch (requestError) {
      throw new Error(
        errorMessage(requestError, "Unable to add selected files"),
      );
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

  const generatorPanel = activeTool ? (
    <section
      id="creation-new-generation"
      className="panel creation-generator-panel"
      aria-label={actionLabel(activeTool, workflows)}
    >
      <div className="creation-generator-header">
        <h3>{actionLabel(activeTool, workflows)}</h3>
        <button type="button" className="secondary-button" onClick={closeGenerator}>
          Close
        </button>
      </div>
      <label className="creation-tool-select">
        Model
        <select
          value={selectedTool}
          onChange={(event) => setSelectedTool(event.target.value)}
          disabled={toolsLoading}
        >
          {optionsFor(activeTool, workflows).map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.value.startsWith("rh:") && !pageId}
            >
              {option.label}
              {option.value.startsWith("rh:") && !pageId ? " (requires a page)" : ""}
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
          shotId={generatorShotId}
          sceneId={generatorSceneId}
          shotTool={generatorShotId || generatorSceneId ? activeTool : null}
          onGenerationTriggered={closeGenerator}
          onCreationItemAdded={() => {
            void refresh().catch((requestError: unknown) =>
              setError(errorMessage(requestError, "Unable to refresh creation")),
            );
          }}
          onCreationItemError={(message) => {
            setError(message);
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
          shotId={generatorShotId}
          sceneId={generatorSceneId}
          shotTool={generatorShotId || generatorSceneId ? activeTool : null}
          onGenerationTriggered={closeGenerator}
          onCreationItemAdded={() => {
            void refresh().catch((requestError: unknown) =>
              setError(errorMessage(requestError, "Unable to refresh creation")),
            );
          }}
          onCreationItemError={(message) => setError(message)}
        />
      )}
    </section>
  ) : null;

  const content = loading ? (
    <div className="page-list" aria-busy="true" aria-label="Loading creation">
      <div className="page-card skeleton-card" />
    </div>
  ) : !creation ? null : (
    <>
      <nav className="creation-breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li>
            <Link to={`${base}/creations`}>Creations</Link>
          </li>
          <li aria-current="page">
            <ChevronRight size={14} aria-hidden="true" />
            <span>{creation.name}</span>
          </li>
        </ol>
      </nav>

      <header className="creation-hero">
        <div className="creation-hero-main">
          <p className="creation-hero-eyebrow">
            <Layers size={14} aria-hidden="true" /> Creation
          </p>
          <h2 className="creation-hero-title">{creation.name}</h2>
          {creation.description && (
            <p className="creation-hero-description">{creation.description}</p>
          )}
          <ul className="creation-stats" aria-label="Creation summary">
            <li>
              <strong>{creation.itemCount}</strong>{" "}
              {creation.itemCount === 1 ? "item" : "items"}
            </li>
            <li>
              <strong>{toolCount}</strong>{" "}
              {toolCount === 1 ? "tool" : "tools"}
            </li>
            <li>
              <Clock size={13} aria-hidden="true" />
              Updated {formatDate(creation.updatedAt)}
            </li>
          </ul>
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

      <section className="creation-toolbar" aria-label="Creation controls">
        <div className="creation-toolbar-row">
          <div className="creation-toolbar-tools">
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
        {hasCreateActions && (
          <div className="creation-create-bar">
            <span className="creation-create-label">
              <Plus size={14} aria-hidden="true" /> New generation
            </span>
            <div className="creation-create-actions">
              {renderActionButtons("primary-button")}
            </div>
          </div>
        )}
        <p className="creation-view-hint">
          {sortOrder === "manual"
            ? "Items are in manual order."
            : `Sorted by date added, ${
                sortOrder === "latest" ? "latest" : "earliest"
              } first. Choose Manual order to reorder.`}
        </p>
      </section>

      {!shotLocation && !sceneLocation && generatorPanel}

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
            pickerShotId ? (
              <p className="creation-view-hint">
                Selected files are added to the shot you chose.
              </p>
            ) : (
            <div className="creation-picker-options">
              <label>
                Follows
                <select
                  value={pickerParent}
                  onChange={(event) => setPickerParent(event.target.value)}
                >
                  <option value="">Nothing</option>
                  {displayedItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      Step {item.position + 1}
                    </option>
                  ))}
                </select>
                <small>Places added items after this step.</small>
              </label>
            </div>
            )
          }
        />
      )}

      {shotLocation && shotNeighbours ? (
        <ShotWorkspace
          pageId={pageId}
          creationId={creationId}
          location={shotLocation}
          confirm={confirm}
          onChanged={refresh}
          onError={setError}
          onOpenMedia={openMedia}
          onBack={closeShot}
          backLabel={sceneLocation ? "Scene" : "Production"}
          onGenerate={(tool) => openGenerator(tool, { shotId: shotLocation.shot.id })}
          generator={generatorPanel}
          position={shotNeighbours.position}
          total={shotNeighbours.total}
          previous={shotNeighbours.previous}
          next={shotNeighbours.next}
          onOpenShot={openShot}
        />
      ) : sceneLocation && sceneNeighbours ? (
        <SceneWorkspace
          pageId={pageId}
          creationId={creationId}
          location={sceneLocation}
          confirm={confirm}
          onChanged={refresh}
          onError={setError}
          onOpenMedia={openMedia}
          onBack={closeScene}
          position={sceneNeighbours.position}
          total={sceneNeighbours.total}
          previous={sceneNeighbours.previous}
          next={sceneNeighbours.next}
          onOpenScene={openScene}
          onOpenShot={openShot}
          onGenerate={(tool) => openGenerator(tool, { sceneId: sceneLocation.scene.id })}
          generator={generatorPanel}
        />
      ) : outline ? (
        <ProductionBoard
          pageId={pageId}
          creationId={creationId}
          outline={outline}
          busy={busy}
          confirm={confirm}
          onChanged={refresh}
          onError={setError}
          onOpenMedia={openMedia}
          onOpenScene={openScene}
          onOpenShot={openShot}
          onAddExisting={openShotPicker}
        />
      ) : items.length === 0 ? (
        <div className="empty-state creation-empty">
          <span className="creation-empty-icon" aria-hidden="true">
            <Layers size={22} />
          </span>
          <h3>Nothing here yet</h3>
          <p>Create something new or add files you already have.</p>

          <div className="creation-empty-actions">
            {renderActionButtons("primary-button")}
            <button
              type="button"
              className="secondary-button"
              onClick={togglePicker}
            >
              Add existing
            </button>
          </div>
        </div>
      ) : null}

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
