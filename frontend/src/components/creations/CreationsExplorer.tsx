import { FolderOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  errorMessage,
  listCreations,
  onCreationsChanged,
} from "../../creationApi";
import type { Creation } from "../../types";

type CreationsExplorerProps = {
  pageId?: string;
  activePageTabKey?: string;
};

export function CreationsExplorer({
  pageId,
  activePageTabKey,
}: CreationsExplorerProps) {
  const [creations, setCreations] = useState<Creation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const items = await listCreations(pageId);
        if (active) setCreations(items);
      } catch (requestError) {
        if (active) {
          setError(errorMessage(requestError, "Unable to load creations"));
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    const unsubscribe = onCreationsChanged(() => void load());
    return () => {
      active = false;
      unsubscribe();
    };
  }, [pageId]);

  return (
    <div className="files-explorer" role="group" aria-label="Creations">
      {loading ? (
        <p className="files-explorer-status">Loading creations...</p>
      ) : error ? (
        <p className="files-explorer-status" role="alert">
          {error}
        </p>
      ) : creations.length === 0 ? (
        <p className="files-explorer-status">No creations</p>
      ) : (
        <div className="files-explorer-group">
          {creations.map((creation) => {
            const to = pageId
              ? `/pages/${pageId}/creations/${creation.id}`
              : `/creations/${creation.id}`;
            const active =
              activePageTabKey ===
              `creation:${pageId ?? "global"}:${creation.id}`;
            return (
              <div
                key={creation.id}
                className={
                  active ? "files-explorer-item active" : "files-explorer-item"
                }
              >
                <button
                  type="button"
                  className="files-explorer-open"
                  title={creation.name}
                  aria-current={location.pathname === to ? "page" : undefined}
                  onClick={() => navigate(to)}
                >
                  <FolderOpen size={14} strokeWidth={2} aria-hidden="true" />
                  <span>{creation.name}</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
