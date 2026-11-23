import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { errorMessage, getCreation } from "../../creationApi";
import type { CreationTool } from "../../types";
import { formatShotLabel, useShotTarget } from "./shotTarget";
import { formatSceneLabel, useSceneTarget } from "./sceneTarget";

type CreationTarget = {
  shotId?: string | null;
  sceneId?: string | null;
  tool?: CreationTool | null;
};

/** Query string that keeps the target creation, scene or shot, and tool while moving between Create pages. */
export function creationQuery(
  creationId: string | null | undefined,
  target: CreationTarget = {},
) {
  if (!creationId) return "";
  const params = new URLSearchParams({ creationId });
  if (target.shotId) params.set("shotId", target.shotId);
  if (target.sceneId) params.set("sceneId", target.sceneId);
  if ((target.shotId || target.sceneId) && target.tool) {
    params.set("tool", target.tool);
  }
  return `?${params.toString()}`;
}

type CreationTargetBannerProps = {
  pageId?: string;
  creationId: string;
  shotId?: string | null;
  sceneId?: string | null;
  tool?: CreationTool | null;
};

const TOOL_NAMES: Record<CreationTool, string> = {
  IMAGE: "Image",
  VIDEO: "Video",
  EDIT: "Edit",
  UPSCALE: "Upscale",
  CHAT: "Chat",
};

/** Shown on Create pages started from a creation; new generations are added to it. */
export function CreationTargetBanner({
  pageId,
  creationId,
  shotId,
  sceneId,
  tool,
}: CreationTargetBannerProps) {
  const shotTarget = useShotTarget(pageId, creationId, shotId);
  const shotLabel = shotTarget ? formatShotLabel(shotTarget) : null;
  const sceneTarget = useSceneTarget(pageId, creationId, shotId ? null : sceneId);
  const sceneLabel = sceneTarget ? formatSceneLabel(sceneTarget) : null;
  const [name, setName] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getCreation(pageId, creationId)
      .then((creation) => {
        if (!cancelled) setName(creation.name);
      })
      .catch((requestError: unknown) => {
        if (!cancelled) setError(errorMessage(requestError, "Creation not found"));
      });
    return () => {
      cancelled = true;
    };
  }, [pageId, creationId]);

  const base = pageId ? `/pages/${pageId}` : "";
  const backTo = shotId
    ? `${base}/creations/${creationId}?shot=${encodeURIComponent(shotId)}`
    : sceneId
      ? `${base}/creations/${creationId}?scene=${encodeURIComponent(sceneId)}`
      : `${base}/creations/${creationId}`;
  return (
    <div className="panel creation-target" role="status">
      {error ? (
        <p className="error">{error}</p>
      ) : (
        <p>
          New generations will be added to <strong>{name ?? "…"}</strong>
          {shotLabel || sceneLabel ? (
            <>
              {" "}
              · <strong>{shotLabel ?? sceneLabel}</strong>
            </>
          ) : null}
          {tool ? ` · ${TOOL_NAMES[tool]}` : null}.
        </p>
      )}
      <Link className="secondary-button" to={backTo}>
        {shotId ? "Back to shot" : sceneId ? "Back to scene" : "Back to creation"}
      </Link>
    </div>
  );
}
