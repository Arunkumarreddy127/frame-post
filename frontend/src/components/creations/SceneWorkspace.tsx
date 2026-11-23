import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import {
  createShot,
  deleteScene,
  errorMessage,
  reorderShots,
  updateScene,
  type ShotDraft,
} from "../../creationApi";
import type { Confirm } from "../ConfirmDialog";
import type { CreationTool, MediaItem, Shot } from "../../types";
import { CreationThumb } from "./CreationThumb";
import { STATUS_LABELS, SceneForm, ShotForm } from "./ProductionBoard";
import type { SceneLocation } from "./sceneTarget";
import { shotCoverItem } from "./sceneTarget";

type SceneWorkspaceProps = {
  pageId?: string;
  creationId: string;
  location: SceneLocation;
  confirm: Confirm;
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
  onOpenMedia: (item: MediaItem) => void;
  onBack: () => void;
  position: number;
  total: number;
  previous: SceneLocation | null;
  next: SceneLocation | null;
  onOpenScene: (sceneId: string) => void;
  onOpenShot: (shotId: string) => void;
  onGenerate: (tool: CreationTool) => void;
  generator?: ReactNode;
};

const GENERATE_TOOLS: { tool: CreationTool; label: string }[] = [
  { tool: "IMAGE", label: "image" },
  { tool: "VIDEO", label: "video" },
];

export function SceneWorkspace({
  pageId,
  creationId,
  location,
  confirm,
  onChanged,
  onError,
  onOpenMedia,
  onBack,
  position,
  total,
  previous,
  next,
  onOpenScene,
  onOpenShot,
  onGenerate,
  generator,
}: SceneWorkspaceProps) {
  const { scene, sceneNumber } = location;
  const [renaming, setRenaming] = useState(false);
  const [addingShot, setAddingShot] = useState(false);
  const [sceneTitle, setSceneTitle] = useState("");
  const [working, setWorking] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const sceneLabel = `Scene ${String(sceneNumber).padStart(2, "0")}`;
  const finalCount = scene.shots.filter((shot) => shot.status === "FINAL").length;

  // Moving between scenes should land at the top of the new scene and drop any open form.
  useEffect(() => {
    setRenaming(false);
    setAddingShot(false);
    rootRef.current?.scrollIntoView({ block: "start" });
  }, [scene.id]);

  async function run(action: () => Promise<unknown>, fallback: string) {
    setWorking(true);
    try {
      await action();
      await onChanged();
    } catch (requestError) {
      onError(errorMessage(requestError, fallback));
    } finally {
      setWorking(false);
    }
  }

  function saveTitle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = sceneTitle.trim();
    if (!title) return;
    setRenaming(false);
    void run(
      () => updateScene(pageId, creationId, scene.id, { title, description: scene.description }),
      "Unable to save scene",
    );
  }

  async function removeScene() {
    const shotCount = scene.shots.length;
    const accepted = await confirm({
      title: "Delete scene?",
      message: `Delete "${scene.title}" and its ${shotCount} ${
        shotCount === 1 ? "shot" : "shots"
      }? Their invocations move to Unassigned.`,
      confirmLabel: "Delete scene",
      danger: true,
    });
    if (!accepted) return;
    void run(async () => {
      await deleteScene(pageId, creationId, scene.id);
      onBack();
    }, "Unable to delete scene");
  }

  function moveShot(shot: Shot, delta: number) {
    const index = scene.shots.findIndex((entry) => entry.id === shot.id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= scene.shots.length) return;
    const ids = scene.shots.map((entry) => entry.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    void run(
      () => reorderShots(pageId, creationId, scene.id, ids),
      "Unable to reorder shots",
    );
  }

  function saveNewShot(draft: Omit<ShotDraft, "sceneId">) {
    setAddingShot(false);
    void run(
      () => createShot(pageId, creationId, { ...draft, sceneId: scene.id }),
      "Unable to add shot",
    );
  }

  return (
    <section
      ref={rootRef}
      className="panel shot-workspace scene-workspace"
      aria-label={`${sceneLabel} workspace`}
    >
      <nav className="shot-workspace-nav" aria-label="Scene navigation">
        <ol className="shot-breadcrumb">
          <li>
            <button type="button" className="shot-breadcrumb-link" onClick={onBack}>
              <ArrowLeft size={14} strokeWidth={1.8} aria-hidden="true" />
              Production
            </button>
          </li>
          <li aria-current="page">
            <ChevronRight size={14} aria-hidden="true" />
            <span>
              {sceneLabel} · {scene.title}
            </span>
          </li>
        </ol>
        <div className="shot-stepper">
          <button
            type="button"
            className="secondary-button"
            disabled={!previous}
            title={previous ? `Scene ${String(previous.sceneNumber).padStart(2, "0")} · ${previous.scene.title}` : undefined}
            onClick={() => previous && onOpenScene(previous.scene.id)}
          >
            <ArrowLeft size={16} strokeWidth={1.8} aria-hidden="true" />
            Previous
          </button>
          <span className="shot-stepper-position" aria-live="polite">
            {position} of {total}
          </span>
          <button
            type="button"
            className="secondary-button"
            disabled={!next}
            title={next ? `Scene ${String(next.sceneNumber).padStart(2, "0")} · ${next.scene.title}` : undefined}
            onClick={() => next && onOpenScene(next.scene.id)}
          >
            Next
            <ArrowRight size={16} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>
      </nav>

      <header className="shot-workspace-header">
        <div>
          <p className="eyebrow">{sceneLabel}</p>
          <h2 className="app-page-title">{scene.title}</h2>
          <small>
            {scene.shots.length} {scene.shots.length === 1 ? "shot" : "shots"} · {finalCount} final
          </small>
        </div>
        <div className="scene-workspace-actions">
          <button
            type="button"
            className="secondary-button"
            disabled={working}
            onClick={() => {
              setSceneTitle(scene.title);
              setRenaming(true);
            }}
          >
            <Pencil size={14} aria-hidden="true" /> Rename
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={working}
            onClick={() => void removeScene()}
          >
            <Trash2 size={14} aria-hidden="true" /> Delete scene
          </button>
        </div>
      </header>

      {renaming && (
        <SceneForm
          title={sceneTitle}
          onTitle={setSceneTitle}
          onSubmit={saveTitle}
          onCancel={() => setRenaming(false)}
          disabled={working}
        />
      )}

      <section className="scene-generate" aria-label="Generate in scene">
        <div className="scene-generate-buttons">
          {GENERATE_TOOLS.map((card) => (
            <button
              key={card.tool}
              type="button"
              className="primary-button"
              disabled={working}
              onClick={() => onGenerate(card.tool)}
            >
              Generate {card.label}
            </button>
          ))}
        </div>
        {generator}
      </section>

      {scene.outputs.length > 0 && (
        <section className="scene-outputs" aria-label="Scene outputs">
          <p className="eyebrow">Scene outputs</p>
          <ul className="scene-output-list">
            {scene.outputs.map((item) => (
              <li key={item.id}>
                <CreationThumb generation={item.generation} onOpen={onOpenMedia} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {scene.shots.length === 0 && !addingShot && (
        <div className="empty-state production-empty">
          <p>No shots in this scene yet. Add a shot to start planning it.</p>
        </div>
      )}

      {scene.shots.length > 0 && (
        <ol className="scene-shot-list">
          {scene.shots.map((shot, shotIndex) => {
            const cover = shotCoverItem(shot);
            const settings = [
              shot.shotSize,
              ...shot.shotTypes,
              shot.movement,
              shot.durationSeconds !== null ? `${shot.durationSeconds}s` : null,
            ].filter((value): value is string => Boolean(value));
            return (
              <li className="scene-shot-card" key={shot.id}>
                {cover ? (
                  <CreationThumb generation={cover.generation} onOpen={onOpenMedia} />
                ) : (
                  <div className="scene-shot-empty">No output yet</div>
                )}
                <div className="scene-shot-body">
                  <p className="eyebrow">Shot {String(shotIndex + 1).padStart(2, "0")}</p>
                  <strong>{shot.title}</strong>
                  <span
                    className={`production-status status-${shot.status.toLowerCase().replace(/_/g, "-")}`}
                  >
                    {STATUS_LABELS[shot.status]}
                  </span>
                  {settings.length > 0 && (
                    <ul className="shot-workspace-settings">
                      {settings.map((setting) => (
                        <li key={setting}>{setting}</li>
                      ))}
                    </ul>
                  )}
                  <small>
                    {shot.invocations.length}{" "}
                    {shot.invocations.length === 1 ? "invocation" : "invocations"}
                  </small>
                </div>
                <div className="scene-shot-actions">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => onOpenShot(shot.id)}
                  >
                    Open shot
                  </button>
                  <div className="creation-card-actions">
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="Move shot up"
                      title="Move shot up"
                      disabled={working || shotIndex === 0}
                      onClick={() => moveShot(shot, -1)}
                    >
                      <ChevronUp size={16} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="Move shot down"
                      title="Move shot down"
                      disabled={working || shotIndex === scene.shots.length - 1}
                      onClick={() => moveShot(shot, 1)}
                    >
                      <ChevronDown size={16} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {addingShot ? (
        <ShotForm
          disabled={working}
          onCancel={() => setAddingShot(false)}
          onSave={saveNewShot}
        />
      ) : (
        <button
          type="button"
          className="secondary-button production-add-shot"
          disabled={working}
          onClick={() => setAddingShot(true)}
        >
          <Plus size={14} aria-hidden="true" /> Add shot
        </button>
      )}
    </section>
  );
}
