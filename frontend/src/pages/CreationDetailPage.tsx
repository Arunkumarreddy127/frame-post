import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  Clock,
  Layers,
  Pencil,
  Trash2,
} from "lucide-react";
import { useParams, useSearchParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { useFilesWorkspaceContext } from "../components/files/FilesWorkspaceProvider";
import {
  CreationThumb,
  toolLabel,
} from "../components/creations/CreationThumb";
import { CreationBreadcrumbs } from "../components/creations/CreationBreadcrumbs";
import { ProductionBoard } from "../components/creations/ProductionBoard";
import { SceneWorkspace } from "../components/creations/SceneWorkspace";
import { ShotWorkspace } from "../components/creations/ShotWorkspace";
import { adjacentShots, findShot } from "../components/creations/shotTarget";
import {
  adjacentScenes,
  findScene,
  outlineFinalVideoItems,
  sceneFinalVideoItems,
} from "../components/creations/sceneTarget";
import { LibraryPicker } from "../components/library/LibraryPicker";
import { MediaViewer } from "../components/media/MediaViewer";
import { GptImageGenPage } from "./GptImageGenPage";
import { RunningHubWorkflowPage } from "./RunningHubWorkflowPage";
import {
  addCreationItem,
  errorMessage,
  getCreation,
  getOutline,
  listCreationItems,
  notifyCreationsChanged,
  removeCreationItem,
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
type CreationTab = "assets" | "scenes";
type PickerTarget = {
  shotId?: string;
  tool?: CreationTool;
  accept: string[];
};

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
  const [searchParams, setSearchParams] = useSearchParams();
  const { setCreationTabLabel } = useFilesWorkspaceContext();
  const base = pageId ? `/pages/${pageId}` : "";

  const [creation, setCreation] = useState<Creation | null>(null);
  const [items, setItems] = useState<CreationItem[]>([]);
  const [outline, setOutline] = useState<CreationOutline | null>(null);
  const shotParam = searchParams.get("shot");
  const sceneParam = searchParams.get("scene");
  const [tab, setTab] = useState<CreationTab>("scenes");
  const [viewing, setViewing] = useState<MediaItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");

  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);
  const pickerOpen = pickerTarget !== null;
  const [activeTool, setActiveTool] = useState<CreationTool | null>(null);
  const [generatorShotId, setGeneratorShotId] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState("");
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [toolsLoading, setToolsLoading] = useState(false);
  const [toolsError, setToolsError] = useState("");
  const [pickerParent, setPickerParent] = useState("");

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

  const viewerItems = useMemo(
    () => items.flatMap((item) => item.generation.outputs),
    [items],
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
  const finalVideosInView = sceneLocation
    ? sceneFinalVideoItems(sceneLocation.scene)
    : !shotLocation && tab === "scenes" && outline
      ? outlineFinalVideoItems(outline)
      : [];
  const viewerNavigationItems =
    viewing && finalVideosInView.some((item) => item.id === viewing.id)
      ? finalVideosInView
      : viewerItems;
  const workspaceLabel = shotLocation
    ? "Shot workspace"
    : sceneLocation
      ? "Scene workspace"
      : "Creation workspace";

  function openShot(shotId: string) {
    closeGenerator();
    const next = new URLSearchParams(searchParams);
    next.set("shot", shotId);
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
    setPickerTarget((current) =>
      current ? null : { accept: ["image/*", "video/*"] },
    );
  }

  function openShotPicker(shotId: string, tool: CreationTool) {
    setPickerTarget({
      shotId,
      tool,
      accept: [tool === "VIDEO" ? "video/*" : "image/*"],
    });
  }

  function openGenerator(
    tool: CreationTool,
    target: { shotId?: string | null } = {},
  ) {
    const first = optionsFor(tool, workflows)[0];
    setActiveTool(tool);
    setGeneratorShotId(target.shotId ?? null);
    setSelectedTool(first?.value ?? "");
  }

  function closeGenerator() {
    setActiveTool(null);
    setGeneratorShotId(null);
    setSelectedTool("");
  }

  const sceneCount = outline?.scenes.length ?? 0;
  const shotCount =
    outline?.scenes.reduce((total, scene) => total + scene.shots.length, 0) ??
    0;
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

  async function removeAsset(itemId: string) {
    setError("");
    setBusy(true);
    try {
      await removeCreationItem(pageId, creationId, itemId);
      await refresh();
    } catch (requestError) {
      setError(errorMessage(requestError, "Unable to remove asset"));
    } finally {
      setBusy(false);
    }
  }

  async function addSelectedMedia(media: MediaItem[]) {
    const generationIds = [...new Set(media.map((item) => item.generationId))];
    if (generationIds.length === 0) return;
    setError("");
    setBusy(true);
    try {
      for (const generationId of generationIds) {
        const placement = pickerTarget?.shotId
          ? { shotId: pickerTarget.shotId, tool: pickerTarget.tool }
          : { parentItemId: pickerParent || undefined };
        await addCreationItem(pageId, creationId, {
          generationId,
          ...placement,
        });
      }
      await refresh();
      setPickerTarget(null);
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
          shotTool={generatorShotId ? activeTool : null}
          onGenerationTriggered={closeGenerator}
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
          shotId={generatorShotId}
          shotTool={generatorShotId ? activeTool : null}
          onGenerationTriggered={closeGenerator}
          onCreationItemAdded={() => {
            void refresh().catch((requestError: unknown) =>
              setError(errorMessage(requestError, "Unable to refresh creation")),
            );
          }}
        />
      )}
    </section>
  ) : null;

  function selectTab(next: CreationTab) {
    const params = new URLSearchParams(searchParams);
    params.delete("scene");
    params.delete("shot");
    setSearchParams(params);
    setTab(next);
  }

  const activeTab: CreationTab = shotLocation || sceneLocation ? "scenes" : tab;
  const tabBar = (
    <div className="creation-tabs" role="tablist" aria-label="Creation sections">
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === "assets"}
        className={activeTab === "assets" ? "active" : ""}
        onClick={() => selectTab("assets")}
      >
        Assets
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === "scenes"}
        className={activeTab === "scenes" ? "active" : ""}
        onClick={() => selectTab("scenes")}
      >
        Scenes &amp; Shots
      </button>
    </div>
  );

  const content = loading ? (
    <div className="page-list" aria-busy="true" aria-label="Loading creation">
      <div className="page-card skeleton-card" />
    </div>
  ) : !creation ? null : (
    <>
      <header className="creation-hero">
        <CreationBreadcrumbs
          items={[
            { label: "Creations", to: `${base}/creations` },
            { label: creation.name, current: true },
          ]}
        />
        <div className="creation-hero-main">
          <p className="creation-hero-eyebrow">
            <Layers size={14} aria-hidden="true" /> {workspaceLabel}
          </p>
          {editing ? (
            <form
              className="creation-inline-edit"
              onSubmit={saveDetails}
            >
              <label>
                Name
                <input
                  value={draftName}
                  maxLength={120}
                  onChange={(event) => setDraftName(event.target.value)}
                  required
                  autoFocus
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
                  disabled={busy}
                >
                  Cancel
                </button>
                <button className="primary-button" type="submit" disabled={busy}>
                  Save
                </button>
              </div>
            </form>
          ) : (
            <>
              <h2 className="creation-hero-title">{creation.name}</h2>
              {creation.description && (
                <p className="creation-hero-description">{creation.description}</p>
              )}
            </>
          )}
          <ul className="creation-stats" aria-label="Creation summary">
            <li>
              <strong>{sceneCount}</strong>{" "}
              {sceneCount === 1 ? "scene" : "scenes"}
            </li>
            <li>
              <strong>{shotCount}</strong>{" "}
              {shotCount === 1 ? "shot" : "shots"}
            </li>
            <li>
              <Clock size={13} aria-hidden="true" />
              Updated {formatDate(creation.updatedAt)}
            </li>
          </ul>
        </div>
        <div className="creation-header-actions">
          {!editing && (
            <button
              type="button"
              className="secondary-button"
              onClick={startEditing}
              disabled={busy}
            >
              <Pencil size={14} aria-hidden="true" /> Edit
            </button>
          )}
        </div>
      </header>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {pickerOpen && (
        <LibraryPicker
          pageId={pageId}
          accept={pickerTarget.accept}
          limit={24}
          excludeGenerationIds={new Set(items.map((item) => item.generation.id))}
          title="Add existing files"
          actionLabel="Add selected"
          onSelect={addSelectedMedia}
          onClose={togglePicker}
          beforeGrid={
            !pickerTarget.shotId && (
            <div className="creation-picker-options">
              <label>
                Follows
                <select
                  value={pickerParent}
                  onChange={(event) => setPickerParent(event.target.value)}
                >
                  <option value="">Nothing</option>
                  {items.map((item) => (
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

      <div className="creation-tabs-shell">
        {tabBar}
        <div className="creation-tabs-body">
          {!shotLocation && !sceneLocation && (
            <CreationBreadcrumbs
              items={[
                { label: "Creations", to: `${base}/creations` },
                {
                  label: creation.name,
                  onSelect: () => selectTab("scenes"),
                },
                {
                  label: activeTab === "assets" ? "Assets" : "Scenes & Shots",
                  current: true,
                },
              ]}
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
          creationName={creation.name}
          creationsPath={`${base}/creations`}
          onOpenCreation={closeScene}
          onOpenScenes={() => selectTab("scenes")}
          onOpenScene={openScene}
          onGenerate={(tool) => openGenerator(tool, { shotId: shotLocation.shot.id })}
          onAddExisting={(tool) => openShotPicker(shotLocation.shot.id, tool)}
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
          creationName={creation.name}
          creationsPath={`${base}/creations`}
          onOpenCreation={closeScene}
          onOpenScenes={() => selectTab("scenes")}
          position={sceneNeighbours.position}
          total={sceneNeighbours.total}
          previous={sceneNeighbours.previous}
          next={sceneNeighbours.next}
          onOpenScene={openScene}
          onOpenShot={openShot}
        />
      ) : tab === "scenes" && outline ? (
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
            />
          ) : tab === "assets" ? (
            <>
              {items.length > 0 && (
                <section className="creation-toolbar" aria-label="Creation controls">
                  <div className="creation-toolbar-row">
                    <div className="creation-toolbar-tools">
                      {hasCreateActions && renderActionButtons("primary-button")}
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
                </section>
              )}

              {generatorPanel}

              {items.length > 0 ? (
                <div className="creation-assets-grid">
                  {items.map((item) => (
                    <div className="creation-asset-card" key={item.id}>
                      <CreationThumb generation={item.generation} onOpen={openMedia} />
                      <div className="creation-card-body">
                        <p className="creation-card-prompt">
                          {item.generation.inputs.prompt || "No prompt"}
                        </p>
                        <small>{toolLabel(item.generation)}</small>
                      </div>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label="Remove asset"
                        title="Remove asset"
                        disabled={busy}
                        onClick={() => void removeAsset(item.id)}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
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
              )}
            </>
          ) : null}
        </div>
      </div>

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
      {viewing && (
        <MediaViewer
          item={viewing}
          items={viewerNavigationItems}
          alt={
            items
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
