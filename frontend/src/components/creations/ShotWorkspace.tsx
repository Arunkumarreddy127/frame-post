import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronRight, Trash2 } from "lucide-react";
import {
  errorMessage,
  removeCreationItem,
  setShotFinal,
  updateShot,
  type ShotDraft,
} from "../../creationApi";
import type { Confirm } from "../ConfirmDialog";
import type { CreationItem, CreationTool, MediaItem } from "../../types";
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
  location: ShotLocation;
  confirm: Confirm;
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
  onOpenMedia: (item: MediaItem) => void;
  onBack: () => void;
  backLabel?: string;
  onGenerate: (tool: CreationTool) => void;
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
  location,
  confirm,
  onChanged,
  onError,
  onOpenMedia,
  onBack,
  backLabel = "Production",
  onGenerate,
  generator,
  position,
  total,
  previous,
  next,
  onOpenShot,
}: ShotWorkspaceProps) {
  const { shot, scene } = location;
  const [editing, setEditing] = useState(false);
  const [working, setWorking] = useState(false);
  const rootRef = useRef<HTMLElement>(null);

  // Moving between shots should land at the top of the new shot, and drop any open edit form.
  useEffect(() => {
    setEditing(false);
    rootRef.current?.scrollIntoView({ block: "start" });
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
      await updateShot(pageId, creationId, shot.id, draft);
      setEditing(false);
    }, "Unable to save shot");
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
      ref={rootRef}
      className="panel shot-workspace"
      aria-label={`${formatShotLabel(location)} workspace`}
    >
      <nav className="shot-workspace-nav" aria-label="Shot navigation">
        <ol className="shot-breadcrumb">
          <li>
            <button type="button" className="shot-breadcrumb-link" onClick={onBack}>
              <ArrowLeft size={14} strokeWidth={1.8} aria-hidden="true" />
              {backLabel}
            </button>
          </li>
          <li>
            <ChevronRight size={14} aria-hidden="true" />
            <span>
              Scene {String(location.sceneNumber).padStart(2, "0")} · {scene.title}
            </span>
          </li>
          <li aria-current="page">
            <ChevronRight size={14} aria-hidden="true" />
            <span>Shot {String(location.shotNumber).padStart(2, "0")}</span>
          </li>
        </ol>
        <div className="shot-stepper">
          <button
            type="button"
            className="secondary-button"
            disabled={!previous}
            title={previous ? `${formatShotLabel(previous)} · ${previous.shot.title}` : undefined}
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
            title={next ? `${formatShotLabel(next)} · ${next.shot.title}` : undefined}
            onClick={() => next && onOpenShot(next.shot.id)}
          >
            Next
            <ArrowRight size={16} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>
      </nav>
      <header className="shot-workspace-header">
        <div>
          <p className="eyebrow">{formatShotLabel(location)}</p>
          <h2 className="app-page-title">{shot.title}</h2>
          <span className={`production-status status-${shot.status.toLowerCase()}`}>
            {STATUS_LABELS[shot.status]}
          </span>
        </div>
      </header>

      {editing ? (
        <ShotForm
          initial={shot}
          disabled={working}
          onCancel={() => setEditing(false)}
          onSave={(draft) => void saveShot(draft)}
        />
      ) : (
        <div className="shot-workspace-brief">
          {settings.length > 0 ? (
            <ul className="shot-workspace-settings">
              {settings.map((setting) => (
                <li key={setting}>{setting}</li>
              ))}
            </ul>
          ) : null}
          <p>{shot.brief || "No brief yet."}</p>
          <button
            type="button"
            className="secondary-button"
            disabled={working}
            onClick={() => setEditing(true)}
          >
            Edit shot
          </button>
        </div>
      )}

      <div className="shot-workspace-tools">
        {TOOL_CARDS.map((card) => {
          const outputs = shot.invocations.filter((item) => item.tool === card.tool);
          return (
            <article className="shot-tool-card" key={card.tool}>
              <header>
                <h3>{card.label}</h3>
                <p>{card.description}</p>
              </header>
              {outputs.length === 0 ? (
                <p className="creation-view-hint">No {card.label.toLowerCase()} outputs yet.</p>
              ) : (
                <ul className="shot-tool-outputs">
                  {outputs.map((item) => {
                    const isFinal = shot.finalItemId === item.id;
                    return (
                      <li className="shot-output" key={item.id}>
                        <CreationThumb generation={item.generation} onOpen={onOpenMedia} />
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
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => onGenerate(card.tool)}
                >
                  Generate {card.label.toLowerCase()}
                </button>
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
