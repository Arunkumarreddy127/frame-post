import { useEffect, useState } from "react";
import { getOutline } from "../../creationApi";
import type {
  CreationOutline,
  CreationItem,
  MediaItem,
  Scene,
  Shot,
} from "../../types";

export type SceneLocation = {
  scene: Scene;
  sceneNumber: number;
};

export function formatSceneLabel(location: SceneLocation) {
  return `Scene ${String(location.sceneNumber).padStart(2, "0")} · ${location.scene.title}`;
}

/** Loads the scene a Create page was opened for; null when there is no scene or it cannot be found. */
export function useSceneTarget(
  pageId: string | undefined,
  creationId: string | null | undefined,
  sceneId: string | null | undefined,
) {
  const [target, setTarget] = useState<SceneLocation | null>(null);

  useEffect(() => {
    if (!creationId || !sceneId) {
      setTarget(null);
      return;
    }
    let cancelled = false;
    getOutline(pageId, creationId)
      .then((outline) => {
        if (!cancelled) setTarget(findScene(outline, sceneId));
      })
      .catch(() => {
        if (!cancelled) setTarget(null);
      });
    return () => {
      cancelled = true;
    };
  }, [pageId, creationId, sceneId]);

  return target;
}

export function findScene(
  outline: CreationOutline,
  sceneId: string,
): SceneLocation | null {
  const sceneIndex = outline.scenes.findIndex((scene) => scene.id === sceneId);
  if (sceneIndex < 0) return null;
  return { scene: outline.scenes[sceneIndex], sceneNumber: sceneIndex + 1 };
}

export function adjacentScenes(outline: CreationOutline, sceneId: string) {
  const index = outline.scenes.findIndex((scene) => scene.id === sceneId);
  const toLocation = (sceneIndex: number): SceneLocation => ({
    scene: outline.scenes[sceneIndex],
    sceneNumber: sceneIndex + 1,
  });
  return {
    position: index + 1,
    total: outline.scenes.length,
    previous: index > 0 ? toLocation(index - 1) : null,
    next:
      index >= 0 && index < outline.scenes.length - 1 ? toLocation(index + 1) : null,
  };
}

/** The final output when one is set, otherwise the most recent invocation that has an output. */
export function shotCoverItem(shot: Shot): CreationItem | null {
  const final = shot.invocations.find((item) => item.id === shot.finalItemId);
  if (final) return final;
  for (let index = shot.invocations.length - 1; index >= 0; index -= 1) {
    const item = shot.invocations[index];
    if (item.generation.outputs.length > 0) return item;
  }
  return null;
}

export function sceneFinalVideoItems(scene: Scene): MediaItem[] {
  return scene.shots.flatMap((shot) => {
    const final = shot.invocations.find((item) => item.id === shot.finalItemId);
    return final?.generation.outputs.filter(
      (output) => output.mediaType === "video",
    ) ?? [];
  });
}

export function outlineFinalVideoItems(outline: CreationOutline): MediaItem[] {
  return outline.scenes.flatMap(sceneFinalVideoItems);
}
