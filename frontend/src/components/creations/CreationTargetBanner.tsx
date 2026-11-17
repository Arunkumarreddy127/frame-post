import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { errorMessage, getCreation } from "../../creationApi";

/** Query string that keeps the target creation while moving between Create pages. */
export function creationQuery(creationId: string | null | undefined) {
  return creationId ? `?creationId=${encodeURIComponent(creationId)}` : "";
}

type CreationTargetBannerProps = {
  pageId?: string;
  creationId: string;
};

/** Shown on Create pages started from a creation; new generations are added to it. */
export function CreationTargetBanner({ pageId, creationId }: CreationTargetBannerProps) {
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
  return (
    <div className="panel creation-target" role="status">
      {error ? (
        <p className="error">{error}</p>
      ) : (
        <p>
          New generations will be added to <strong>{name ?? "…"}</strong>.
        </p>
      )}
      <Link className="secondary-button" to={`${base}/creations/${creationId}`}>
        Back to creation
      </Link>
    </div>
  );
}
