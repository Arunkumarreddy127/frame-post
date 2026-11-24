import {
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { ArrowLeft, ArrowRight, Check, Pencil, Trash2 } from "lucide-react";
import {
  errorMessage,
  removeCreationItem,
  setShotFinal,
  updateShot,
  type ShotDraft,
} from "../../creationApi";
import type { Confirm } from "../ConfirmDialog";
import type { CreationItem, CreationTool, MediaItem } from "../../types";
import { CreationBreadcrumbs } from "./CreationBreadcrumbs";
import { CreationThumb, toolLabel } from "./CreationThumb";
import { STATUS_LABELS, ShotForm } from "./ProductionBoard";
import { formatShotLabel, type ShotLocation } from "./shotTarget";

const TOOL_CARDS: {
  tool: CreationTool;
  label: string;
  description: string;
  generatable: boolean;
}[] = [
  {
    tool: "IMAGE",
    label: "Image",
    description: "Generate the still for this shot.",
    generatable: true,
  },
  {
    tool: "VIDEO",
    label: "Video",
    description: "Animate the shot with a video workflow.",
    generatable: true,
  },
  {
    tool: "EDIT",
    label: "Edit",
    description: "Refine an existing output.",
    generatable: false,
  },
  {
    tool: "UPSCALE",
    label: "Upscale",
    description: "Increase the resolution of an output.",
    generatable: false,
  },
  {
    tool: "CHAT",
    label: "Chat",
    description: "Iterate on the shot in conversation.",
    generatable: false,
  },
];

type ShotWorkspaceProps = {
  pageId?: string;
  creationId: string;
  creationName: string;
  creationsPath: string;
  location: ShotLocation;
  confirm: Confirm;
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
  onOpenMedia: (item: MediaItem) => void;
  onOpenCreation: () => void;
  onOpenScenes: () => void;
  onOpenScene: (sceneId: string) => void;
  onGenerate: (tool: CreationTool) => void;
  onAddExisting: (tool: CreationTool) => void;
  generator?: ReactNode;
  position: number;
  total: number;
  previous: ShotLocation | null;
  next: ShotLocation | null;
  onOpenShot: (shotId: string) => void;
};

export function ShotWorkspace({
  pageId,
  creationId,
  creationName,
  creationsPath,
  location,
  confirm,
  onChanged,
  onError,
  onOpenMedia,
  onOpenCreation,
  onOpenScenes,
  onOpenScene,
  onGenerate,
  onAddExisting,
  generator,
  position,
  total,
  previous,
  next,
  onOpenShot,
}: ShotWorkspaceProps) {
  const { shot, scene } = location;
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingBrief, setEditingBrief] = useState(false);
  const [titleDraft, setTitleDraft] = useState(shot.title);
  const [titleError, setTitleError] = useState("");
  const [working, setWorking] = useState(false);

  // Moving between shots should reset any open inline editors.
  useEffect(() => {
    setEditingTitle(false);
    setEditingBrief(false);
    setTitleDraft(shot.title);
    setTitleError("");
  }, [shot.id]);

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

  async function saveShot(draft: Omit<ShotDraft, "sceneId">) {
    await run(async () => {
      await updateShot(pageId, creationId, shot.id, {
        ...draft,
        sceneId: shot.sceneId,
      });
      setEditingTitle(false);
      setEditingBrief(false);
    }, "Unable to save shot");
  }

  function saveTitle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = titleDraft.trim();
    if (!title) {
      setTitleError("Shot title is required.");
      return;
    }
    setTitleError("");
    void saveShot({
      title,
      brief: shot.brief,
      shotSize: shot.shotSize,
      shotTypes: shot.shotTypes,
      movement: shot.movement,
      durationSeconds: shot.durationSeconds,
    });
  }

  async function removeInvocation(item: CreationItem) {
    const accepted = await confirm({
      title: "Remove output?",
      message: "It will move to Unassigned. The generation itself is kept.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (!accepted) return;
    void run(
      () => removeCreationItem(pageId, creationId, item.id),
      "Unable to remove output",
    );
  }

  const settings = [
    shot.shotSize,
    ...shot.shotTypes,
    shot.movement,
    shot.durationSeconds !== null ? `${shot.durationSeconds}s` : null,
  ].filter((value): value is string => Boolean(value));

  return (
    <section
      className="shot-workspace"
      aria-label={`${formatShotLabel(location)} workspace`}
    >
      <div className="shot-workspace-nav">
        <CreationBreadcrumbs
          items={[
            { label: "Creations", to: creationsPath },
            { label: creationName, onSelect: onOpenCreation },
            { label: "Scenes & Shots", onSelect: onOpenScenes },
            {
              label: `Scene ${String(location.sceneNumber).padStart(2, "0")} · ${scene.title}`,
              onSelect: () => onOpenScene(scene.id),
            },
            {
              label: `Shot ${String(location.shotNumber).padStart(2, "0")} · ${shot.title}`,
              current: true,
            },
          ]}
        />
        <header className="shot-workspace-header">
          <div>
            <p className="eyebrow">{formatShotLabel(location)}</p>
            {editingTitle ? (
              <form
                className="shot-workspace-title-editor"
                onSubmit={saveTitle}
              >
                <input
                  aria-label="Shot title"
                  aria-invalid={Boolean(titleError)}
                  aria-describedby={titleError ? "shot-title-error" : undefined}
                  value={titleDraft}
                  maxLength={120}
                  autoFocus
                  onChange={(event) => {
                    setTitleDraft(event.target.value);
                    setTitleError("");
                  }}
                  required
                />
                <div className="shot-workspace-title-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={working || editingBrief}
                    onClick={() => {
                      setTitleDraft(shot.title);
                      setTitleError("");
                      setEditingTitle(false);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="primary-button"
                    disabled={working}
                  >
                    Save
                  </button>
                </div>
                {titleError && (
                  <p id="shot-title-error" className="error" role="alert">
                    {titleError}
                  </p>
                )}
              </form>
            ) : (
              <div className="shot-workspace-title-row">
                <h2 className="app-page-title">{shot.title}</h2>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={working || editingTitle}
                  onClick={() => {
                    setTitleDraft(shot.title);
                    setTitleError("");
                    setEditingTitle(true);
                  }}
                >
                  <Pencil size={14} aria-hidden="true" /> Edit title
                </button>
              </div>
            )}
            <span
              className={`production-status status-${shot.status.toLowerCase()}`}
            >
              {STATUS_LABELS[shot.status]}
            </span>
          </div>
        </header>
        <div className="shot-workspace-nav-actions">
          <button
            type="button"
            className="secondary-button workspace-back-button"
            onClick={() => onOpenScene(scene.id)}
          >
            <ArrowLeft size={16} strokeWidth={1.8} aria-hidden="true" />
            Back to Shots List
          </button>
          <div className="shot-stepper">
            <button
              type="button"
              className="secondary-button"
              disabled={!previous}
              title={
                previous
                  ? `${formatShotLabel(previous)} · ${previous.shot.title}`
                  : undefined
              }
              onClick={() => previous && onOpenShot(previous.shot.id)}
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
              title={
                next
                  ? `${formatShotLabel(next)} · ${next.shot.title}`
                  : undefined
              }
              onClick={() => next && onOpenShot(next.shot.id)}
            >
              Next
              <ArrowRight size={16} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <section
        className="shot-workspace-brief"
        aria-labelledby="shot-workspace-brief-title"
      >
        <div className="shot-workspace-brief-heading">
          <h3 id="shot-workspace-brief-title">Shot brief</h3>
          {!editingBrief && (
            <button
              type="button"
              className="secondary-button"
              disabled={working}
              onClick={() => setEditingBrief(true)}
            >
              <Pencil size={14} aria-hidden="true" /> Edit brief
            </button>
          )}
        </div>
        {editingBrief ? (
          <ShotForm
            initial={shot}
            disabled={working}
            mode="details"
            onCancel={() => setEditingBrief(false)}
            onSave={(draft) => void saveShot(draft)}
          />
        ) : (
          <>
          {settings.length > 0 ? (
            <ul className="shot-workspace-settings">
              {settings.map((setting) => (
                <li key={setting}>{setting}</li>
              ))}
            </ul>
            ) : null}
            <p>{shot.brief || "No brief yet."}</p>
            </>
        )}
      </section>

      <div className="shot-workspace-tools">
        {TOOL_CARDS.map((card) => {
          const outputs = shot.invocations.filter(
            (item) => item.tool === card.tool,
          );
          return (
            <article className="shot-tool-card" key={card.tool}>
              <header>
                <h3>{card.label}</h3>
                <p>{card.description}</p>
              </header>
              {outputs.length === 0 ? (
                <p className="creation-view-hint">
                  No {card.label.toLowerCase()} outputs yet.
                </p>
              ) : (
                <ul className="shot-tool-outputs">
                  {outputs.map((item) => {
                    const isFinal = shot.finalItemId === item.id;
                    return (
                      <li className="shot-output" key={item.id}>
                        <CreationThumb
                          generation={item.generation}
                          onOpen={onOpenMedia}
                        />
                        <div className="shot-output-meta">
                          <span>{toolLabel(item.generation)}</span>
                          {isFinal ? (
                            <span className="production-status status-final">
                              <Check size={12} aria-hidden="true" /> Final
                            </span>
                          ) : null}
                          <div className="shot-output-actions">
                            <button
                              type="button"
                              className="secondary-button"
                              disabled={working}
                              onClick={() =>
                                void run(
                                  () =>
                                    setShotFinal(
                                      pageId,
                                      creationId,
                                      shot.id,
                                      isFinal ? null : item.id,
                                    ),
                                  "Unable to set final output",
                                )
                              }
                            >
                              {isFinal ? "Unset final" : "Set as final"}
                            </button>
                            <button
                              type="button"
                              className="icon-button danger-icon"
                              aria-label="Remove output"
                              disabled={working}
                              onClick={() => void removeInvocation(item)}
                            >
                              <Trash2 size={16} aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {card.generatable ? (
                <>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => onGenerate(card.tool)}
                  >
                    Generate {card.label.toLowerCase()}
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => onAddExisting(card.tool)}
                  >
                    Add existing
                  </button>
                </>
              ) : (
                <button type="button" className="secondary-button" disabled>
                  Coming soon
                </button>
              )}
            </article>
          );
        })}
      </div>
      {generator}
    </section>
  );
}
