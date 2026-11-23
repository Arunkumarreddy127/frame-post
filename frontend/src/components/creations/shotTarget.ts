import { useEffect, useState } from "react";
import { getOutline } from "../../creationApi";
import { validateShotDuration } from "../../shotOptions";
import type {
  CreationOutline,
  CreationTool,
  MediaItem,
  Scene,
  Shot,
  WorkflowInput,
} from "../../types";

const CREATION_TOOLS: CreationTool[] = [
  "IMAGE",
  "VIDEO",
  "EDIT",
  "UPSCALE",
  "CHAT",
];

export type ShotLocation = {
  scene: Scene;
  shot: Shot;
  sceneNumber: number;
  shotNumber: number;
};

export function parseCreationTool(value: string | null): CreationTool | null {
  if (!value) return null;
  const upper = value.toUpperCase() as CreationTool;
  return CREATION_TOOLS.includes(upper) ? upper : null;
}

/** Loads the shot a Create page was opened for; null when there is no shot or it cannot be found. */
export function useShotTarget(
  pageId: string | undefined,
  creationId: string | null | undefined,
  shotId: string | null | undefined,
) {
  const [target, setTarget] = useState<ShotLocation | null>(null);

  useEffect(() => {
    if (!creationId || !shotId) {
      setTarget(null);
      return;
    }
    let cancelled = false;
    getOutline(pageId, creationId)
      .then((outline) => {
        if (!cancelled) setTarget(findShot(outline, shotId));
      })
      .catch(() => {
        if (!cancelled) setTarget(null);
      });
    return () => {
      cancelled = true;
    };
  }, [pageId, creationId, shotId]);

  return target;
}

export function formatShotLabel(location: ShotLocation) {
  return `Scene ${pad(location.sceneNumber)} · Shot ${pad(location.shotNumber)}`;
}

export function findShot(
  outline: CreationOutline,
  shotId: string,
): ShotLocation | null {
  for (const [sceneIndex, scene] of outline.scenes.entries()) {
    const shotIndex = scene.shots.findIndex((shot) => shot.id === shotId);
    if (shotIndex >= 0) {
      return {
        scene,
        shot: scene.shots[shotIndex],
        sceneNumber: sceneIndex + 1,
        shotNumber: shotIndex + 1,
      };
    }
  }
  return null;
}

/** Shots in production order across scenes, so prev/next can cross scene boundaries. */
export function shotSequence(outline: CreationOutline): ShotLocation[] {
  return outline.scenes.flatMap((scene, sceneIndex) =>
    scene.shots.map((shot, shotIndex) => ({
      scene,
      shot,
      sceneNumber: sceneIndex + 1,
      shotNumber: shotIndex + 1,
    })),
  );
}

export function adjacentShots(outline: CreationOutline, shotId: string) {
  const sequence = shotSequence(outline);
  const index = sequence.findIndex((entry) => entry.shot.id === shotId);
  return {
    position: index + 1,
    total: sequence.length,
    previous: index > 0 ? sequence[index - 1] : null,
    next: index >= 0 && index < sequence.length - 1 ? sequence[index + 1] : null,
  };
}

export function latestOutput(shot: Shot, tool: CreationTool): MediaItem | null {
  for (let index = shot.invocations.length - 1; index >= 0; index -= 1) {
    const invocation = shot.invocations[index];
    if (invocation.tool !== tool) continue;
    const output = invocation.generation.outputs[0];
    if (output) return output;
  }
  return null;
}

export function findSecondsInput(inputs: WorkflowInput[]): WorkflowInput | null {
  return (
    inputs.find(
      (input) =>
        input.type === "number" && /second|duration/i.test(`${input.name} ${input.label}`),
    ) ?? null
  );
}

// Returns the shot duration as a string for a workflow input, or null when the
// shot has no duration or it falls outside the input's min/max.
export function secondsForInput(
  input: WorkflowInput,
  durationSeconds: number | null,
): string | null {
  if (durationSeconds === null) return null;
  const { error } = validateShotDuration(String(durationSeconds));
  if (error) return null;
  if (input.min !== null && durationSeconds < input.min) return null;
  if (input.max !== null && durationSeconds > input.max) return null;
  return String(durationSeconds);
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}
