import { useState, type FormEvent, type ReactNode } from "react";
import {
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import {
  createScene,
  createShot,
  deleteScene,
  errorMessage,
  reorderScenes,
  updateScene,
  type ShotDraft,
} from "../../creationApi";
import type { Confirm } from "../ConfirmDialog";
import {
  MOVEMENT_OPTIONS,
  SHOT_DURATION_MAX_SECONDS,
  SHOT_SIZE_GROUPS,
  SHOT_TYPE_GROUPS,
  validateShotDuration,
} from "../../shotOptions";
import type {
  CreationOutline,
  MediaItem,
  Scene,
  Shot,
  ShotStatus,
} from "../../types";
import { CreationThumb } from "./CreationThumb";

const SHOT_TYPE_LIMIT = 10;
const CUSTOM = "__custom__";
const MAX_CUSTOM_LENGTH = 60;

export const STATUS_LABELS: Record<ShotStatus, string> = {
  NOT_STARTED: "Not started",
  IMAGE_NEEDED: "Image needed",
  IMAGE_READY: "Image ready",
  VIDEO_READY: "Video ready",
  FINAL: "Final set",
};

type ProductionBoardProps = {
  pageId?: string;
  creationId: string;
  outline: CreationOutline;
  busy: boolean;
  confirm: Confirm;
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
  onOpenMedia: (item: MediaItem) => void;
  onOpenScene: (sceneId: string) => void;
};

export function ProductionBoard({
  pageId,
  creationId,
  outline,
  busy,
  confirm,
  onChanged,
  onError,
  onOpenMedia,
  onOpenScene,
}: ProductionBoardProps) {
  const [working, setWorking] = useState(false);
  const [sceneEditor, setSceneEditor] = useState<
    { sceneId: string | null } | null
  >(null);
  const [sceneTitle, setSceneTitle] = useState("");
  const [shotEditor, setShotEditor] = useState<
    { sceneId: string; shot: Shot | null } | null
  >(null);
  const disabled = busy || working;


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

  function moveById<T extends { id: string }>(list: T[], id: string, delta: number) {
    const index = list.findIndex((entry) => entry.id === id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= list.length) return null;
    const next = [...list];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  }

  function moveScene(scene: Scene, delta: number) {
    const next = moveById(outline.scenes, scene.id, delta);
    if (!next) return;
    void run(
      () => reorderScenes(pageId, creationId, next.map((entry) => entry.id)),
      "Unable to reorder scenes",
    );
  }

  async function removeScene(scene: Scene) {
    const accepted = await confirm({
      title: "Delete scene?",
      message: `Delete "${scene.title}" and its ${scene.shots.length} ${
        scene.shots.length === 1 ? "shot" : "shots"
      }? Their invocations stay in Assets.`,
      confirmLabel: "Delete scene",
      danger: true,
    });
    if (!accepted) return;
    void run(
      () => deleteScene(pageId, creationId, scene.id),
      "Unable to delete scene",
    );
  }

  function saveScene(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = sceneTitle.trim();
    if (!title || !sceneEditor) return;
    const editing = sceneEditor.sceneId;
    setSceneEditor(null);
    void run(
      () =>
        editing
          ? updateScene(pageId, creationId, editing, { title, description: null })
          : createScene(pageId, creationId, { title, description: null }),
      "Unable to save scene",
    );
  }

  function openSceneEditor(scene: Scene | null) {
    setSceneTitle(scene?.title ?? "");
    setSceneEditor({ sceneId: scene?.id ?? null });
  }

  return (
    <div className="production-board">
      <div className="production-toolbar">
        <button
          type="button"
          className="primary-button"
          disabled={disabled}
          onClick={() => openSceneEditor(null)}
        >
          <Plus size={14} aria-hidden="true" /> Add scene
        </button>
      </div>

      {sceneEditor && !sceneEditor.sceneId && (
        <SceneForm
          title={sceneTitle}
          onTitle={setSceneTitle}
          onSubmit={saveScene}
          onCancel={() => setSceneEditor(null)}
          disabled={disabled}
        />
      )}

      {outline.scenes.map((scene, sceneIndex) => {
        const addingShotHere =
          shotEditor?.sceneId === scene.id && shotEditor.shot === null;
        return (
        <section className="production-scene" key={scene.id} aria-label={`Scene ${sceneIndex + 1}: ${scene.title}`}>
          <header className="production-scene-header">
            <div>
              <p className="eyebrow">Scene {String(sceneIndex + 1).padStart(2, "0")}</p>
              <h3>{scene.title}</h3>
              <small>
                {scene.shots.length} {scene.shots.length === 1 ? "shot" : "shots"}
              </small>
            </div>
            <div className="creation-card-actions">
              <button type="button" className="secondary-button" onClick={() => onOpenScene(scene.id)}>
                Open scene
              </button>
              <IconButton label="Move scene up" disabled={disabled || sceneIndex === 0} onClick={() => moveScene(scene, -1)}>
                <ChevronUp size={16} aria-hidden="true" />
              </IconButton>
              <IconButton label="Move scene down" disabled={disabled || sceneIndex === outline.scenes.length - 1} onClick={() => moveScene(scene, 1)}>
                <ChevronDown size={16} aria-hidden="true" />
              </IconButton>
              <IconButton label="Rename scene" disabled={disabled} onClick={() => openSceneEditor(scene)}>
                <Pencil size={16} aria-hidden="true" />
              </IconButton>
              <IconButton label="Delete scene" disabled={disabled} onClick={() => void removeScene(scene)}>
                <Trash2 size={16} aria-hidden="true" />
              </IconButton>
            </div>
          </header>

          {sceneEditor?.sceneId === scene.id && (
            <SceneForm
              title={sceneTitle}
              onTitle={setSceneTitle}
              onSubmit={saveScene}
              onCancel={() => setSceneEditor(null)}
              disabled={disabled}
            />
          )}

          <ol className="production-shots">
            {scene.shots.map((shot, shotIndex) => {
              const finalItem = shot.invocations.find(
                (item) => item.id === shot.finalItemId,
              );
              return (
                <li className="production-shot" key={shot.id}>
                <div className="production-shot-header">
                  <span className="eyebrow">
                    Shot {String(shotIndex + 1).padStart(2, "0")}
                  </span>
                  <div className="production-shot-title">
                    <strong>{shot.title}</strong>
                  </div>
                </div>

                {finalItem && (
                  <div className="production-shot-final">
                    <CreationThumb
                      generation={finalItem.generation}
                      onOpen={onOpenMedia}
                    />
                  </div>
                )}

              </li>
              );
            })}
          </ol>

          {addingShotHere && (
            <ShotForm
              disabled={disabled}
              onCancel={() => setShotEditor(null)}
              onSave={(draft) => {
                setShotEditor(null);
                void run(
                  () => createShot(pageId, creationId, { ...draft, sceneId: scene.id }),
                  "Unable to add shot",
                );
              }}
            />
          )}
          {!addingShotHere && (
            <button
              type="button"
              className="secondary-button production-add-shot"
              disabled={disabled}
              onClick={() => setShotEditor({ sceneId: scene.id, shot: null })}
            >
              <Plus size={14} aria-hidden="true" /> Add shot
            </button>
          )}
        </section>
        );
      })}

    </div>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="icon-button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function SceneForm({
  title,
  onTitle,
  onSubmit,
  onCancel,
  disabled,
}: {
  title: string;
  onTitle: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  disabled: boolean;
}) {
  return (
    <form className="production-form" onSubmit={onSubmit}>
      <label>
        Scene title
        <input
          value={title}
          maxLength={120}
          onChange={(event) => onTitle(event.target.value)}
          required
          autoFocus
        />
      </label>
      <div className="production-form-actions">
        <button type="button" className="secondary-button" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="primary-button" disabled={disabled || !title.trim()}>
          Save scene
        </button>
      </div>
    </form>
  );
}

type ShotFormState = {
  title: string;
  brief: string;
  sizeChoice: string;
  customSize: string;
  shotTypes: string[];
  customType: string;
  movementChoice: string;
  customMovement: string;
  duration: string;
};

function initialShotState(shot: Shot | null): ShotFormState {
  const presetSizes = SHOT_SIZE_GROUPS.flatMap((group) => group.options);
  const presetMovements = MOVEMENT_OPTIONS;
  const size = shot?.shotSize ?? "";
  const movement = shot?.movement ?? "";
  return {
    title: shot?.title ?? "",
    brief: shot?.brief ?? "",
    sizeChoice: !size ? "" : presetSizes.includes(size) ? size : CUSTOM,
    customSize: presetSizes.includes(size) ? "" : size,
    shotTypes: shot?.shotTypes ?? [],
    customType: "",
    movementChoice: !movement ? "" : presetMovements.includes(movement) ? movement : CUSTOM,
    customMovement: presetMovements.includes(movement) ? "" : movement,
    duration: shot?.durationSeconds ? String(shot.durationSeconds) : "",
  };
}

export function ShotForm({
  initial,
  disabled,
  onCancel,
  onSave,
}: {
  initial?: Shot;
  disabled: boolean;
  onCancel: () => void;
  onSave: (draft: Omit<ShotDraft, "sceneId">) => void;
}) {
  const [form, setForm] = useState<ShotFormState>(() => initialShotState(initial ?? null));
  const [error, setError] = useState("");
  const [typesOpen, setTypesOpen] = useState(false);
  const knownTypes = SHOT_TYPE_GROUPS.flatMap((group) => group.options);

  function patch(next: Partial<ShotFormState>) {
    setForm((current) => ({ ...current, ...next }));
  }

  function toggleType(option: string) {
    setForm((current) => {
      if (current.shotTypes.includes(option)) {
        return { ...current, shotTypes: current.shotTypes.filter((type) => type !== option) };
      }
      if (current.shotTypes.length >= SHOT_TYPE_LIMIT) return current;
      return { ...current, shotTypes: [...current.shotTypes, option] };
    });
  }

  function addCustomType() {
    const value = form.customType.trim();
    if (!value) return;
    if (form.shotTypes.length >= SHOT_TYPE_LIMIT && !form.shotTypes.includes(value)) {
      setError(`Choose up to ${SHOT_TYPE_LIMIT} shot types.`);
      return;
    }
    setForm((current) => ({
      ...current,
      customType: "",
      shotTypes: current.shotTypes.includes(value)
        ? current.shotTypes
        : [...current.shotTypes, value],
    }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = form.title.trim();
    if (!title) {
      setError("Shot title is required.");
      return;
    }
    const duration = validateShotDuration(form.duration);
    if (duration.error) {
      setError(duration.error);
      return;
    }
    const shotSize =
      form.sizeChoice === CUSTOM ? form.customSize.trim() : form.sizeChoice;
    const movement =
      form.movementChoice === CUSTOM
        ? form.customMovement.trim()
        : form.movementChoice;
    setError("");
    onSave({
      title,
      brief: form.brief.trim() || null,
      shotSize: shotSize || null,
      shotTypes: form.shotTypes,
      movement: movement || null,
      durationSeconds: duration.seconds,
    });
  }

  const customTypes = form.shotTypes.filter((type) => !knownTypes.includes(type));

  return (
    <form className="production-form production-shot-form" onSubmit={submit} aria-label={initial ? "Edit shot" : "New shot"}>
      <label>
        Title
        <input
          value={form.title}
          maxLength={120}
          onChange={(event) => patch({ title: event.target.value })}
          required
          autoFocus
        />
      </label>
      <label>
        Description
        <textarea
          rows={2}
          value={form.brief}
          onChange={(event) => patch({ brief: event.target.value })}
        />
      </label>

      <label>
        Shot size
        <select
          value={form.sizeChoice}
          onChange={(event) => patch({ sizeChoice: event.target.value })}
        >
          <option value="">Not set</option>
          {SHOT_SIZE_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </optgroup>
          ))}
          <option value={CUSTOM}>Custom</option>
        </select>
      </label>
      {form.sizeChoice === CUSTOM && (
        <label>
          Custom shot size
          <input
            value={form.customSize}
            maxLength={MAX_CUSTOM_LENGTH}
            onChange={(event) => patch({ customSize: event.target.value })}
          />
        </label>
      )}

      <div className="production-type-field">
        <span className="production-type-field-label" id="shot-type-label">
          Shot type
        </span>
        <button
          type="button"
          className="production-type-trigger"
          aria-labelledby="shot-type-label shot-type-summary"
          aria-expanded={typesOpen}
          aria-controls="shot-type-panel"
          onClick={() => setTypesOpen((open) => !open)}
        >
          <span id="shot-type-summary" className="production-type-summary">
            {form.shotTypes.length > 0 ? form.shotTypes.join(", ") : "Not set"}
          </span>
          <span className="production-type-caret" aria-hidden="true" />
        </button>
      </div>
      {typesOpen && (
        <div id="shot-type-panel" className="production-type-groups" role="group" aria-label="Shot type options">
          {SHOT_TYPE_GROUPS.map((group) => (
            <div key={group.label} className="production-type-group">
              <span className="production-type-label">{group.label}</span>
              {group.options.map((option) => {
                const checked = form.shotTypes.includes(option);
                return (
                  <label key={option} className="production-checkbox">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!checked && form.shotTypes.length >= SHOT_TYPE_LIMIT}
                      onChange={() => toggleType(option)}
                    />
                    {option}
                  </label>
                );
              })}
            </div>
          ))}
          {customTypes.length > 0 && (
            <div className="production-type-group">
              <span className="production-type-label">Custom</span>
              {customTypes.map((option) => (
                <label key={option} className="production-checkbox">
                  <input type="checkbox" checked onChange={() => toggleType(option)} />
                  {option}
                </label>
              ))}
            </div>
          )}
          <div className="production-custom-type">
            <input
              aria-label="Add custom shot type"
              placeholder="Add custom type"
              value={form.customType}
              maxLength={MAX_CUSTOM_LENGTH}
              onChange={(event) => patch({ customType: event.target.value })}
            />
            <button type="button" className="secondary-button" onClick={addCustomType}>
              Add
            </button>
          </div>
          <div className="production-type-done">
            <button type="button" className="secondary-button" onClick={() => setTypesOpen(false)}>
              Done
            </button>
          </div>
        </div>
      )}

      <label>
        Movement
        <select
          value={form.movementChoice}
          onChange={(event) => patch({ movementChoice: event.target.value })}
        >
          <option value="">Not set</option>
          {MOVEMENT_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
          <option value={CUSTOM}>Custom</option>
        </select>
      </label>
      {form.movementChoice === CUSTOM && (
        <label>
          Custom movement
          <input
            value={form.customMovement}
            maxLength={MAX_CUSTOM_LENGTH}
            onChange={(event) => patch({ customMovement: event.target.value })}
          />
        </label>
      )}

      <label>
        Est. time (seconds)
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={SHOT_DURATION_MAX_SECONDS}
          step={1}
          value={form.duration}
          onChange={(event) => patch({ duration: event.target.value })}
        />
        <small>Used as the shot duration. From 1 to {SHOT_DURATION_MAX_SECONDS} seconds.</small>
      </label>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="production-form-actions">
        <button type="button" className="secondary-button" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="primary-button" disabled={disabled}>
          {initial ? "Save shot" : "Add shot"}
        </button>
      </div>
    </form>
  );
}
