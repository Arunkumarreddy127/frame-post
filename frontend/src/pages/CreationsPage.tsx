import { useEffect, useState, type FormEvent } from "react";
import { ChevronRight, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { useConfirm } from "../components/ConfirmDialog";
import {
  createCreation,
  deleteCreation,
  errorMessage,
  listCreations,
  notifyCreationsChanged,
} from "../creationApi";
import { formatDate } from "../format";
import type { Creation, ShellRouteProps } from "../types";

type CreationsPageProps = ShellRouteProps & { pageId?: string };

export function CreationsPage({ user, onLogout, pageId }: CreationsPageProps) {
  const [creations, setCreations] = useState<Creation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const base = pageId ? `/pages/${pageId}` : "";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    listCreations(pageId)
      .then((items) => {
        if (!cancelled) setCreations(items);
      })
      .catch((requestError: unknown) => {
        if (!cancelled) {
          setError(errorMessage(requestError, "Unable to load creations"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pageId]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Give the creation a name.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const created = await createCreation(pageId, {
        name: trimmed,
        description: description.trim(),
      });
      notifyCreationsChanged();
      navigate(`${base}/creations/${created.id}`);
    } catch (requestError) {
      setError(errorMessage(requestError, "Unable to create creation"));
      setSaving(false);
    }
  }

  async function removeCreation(creation: Creation) {
    const accepted = await confirm({
      title: `Delete “${creation.name}”?`,
      message:
        "The creation will be removed. Its generations and files are kept.",
      confirmLabel: "Delete creation",
      danger: true,
    });
    if (!accepted) return;
    try {
      await deleteCreation(pageId, creation.id);
      notifyCreationsChanged();
      setCreations((current) =>
        current.filter((entry) => entry.id !== creation.id),
      );
    } catch (requestError) {
      setError(errorMessage(requestError, "Unable to delete creation"));
    }
  }

  return (
    <AppShell
      user={user}
      onLogout={onLogout}
      pageTitle="Creations"
      sidebar={pageId ? "page" : "global"}
      pageId={pageId}
      backTo={pageId ? `/pages/${pageId}` : "/home"}
    >
      <header className="app-page-header">
        <div>
          <p className="eyebrow">Creations</p>
          <h2 className="app-page-title">Creations</h2>
          <p className="app-page-description">
            Group generations into projects. Add any tool as many times as
            you need.
          </p>
        </div>
      </header>

      <form className="panel creation-form" onSubmit={handleCreate}>
        <label>
          Name
          <input
            value={name}
            maxLength={120}
            onChange={(event) => setName(event.target.value)}
            placeholder="Spring launch set"
            required
          />
        </label>
        <label>
          Description
          <textarea
            value={description}
            maxLength={2000}
            rows={2}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Optional notes about this creation"
          />
        </label>
        <div className="creation-form-actions">
          <button className="primary-button" type="submit" disabled={saving}>
            {saving ? "Creating…" : "New creation"}
          </button>
        </div>
      </form>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <div className="page-list" aria-busy="true" aria-label="Loading creations">
          {[0, 1, 2].map((index) => (
            <div className="page-card skeleton-card" key={index} />
          ))}
        </div>
      ) : creations.length === 0 ? (
        <div className="empty-state">
          <p>No creations yet. Create one above, then add generations to it.</p>
        </div>
      ) : (
        <div className="page-list">
          {creations.map((creation) => (
            <div className="page-card" key={creation.id}>
              <Link
                to={`${base}/creations/${creation.id}`}
                className="page-card-link"
              >
                <span className="page-avatar" aria-hidden="true">
                  {creation.name.trim().charAt(0).toUpperCase() || "C"}
                </span>
                <span className="page-card-text">
                  <strong>{creation.name}</strong>
                  <span>
                    {creation.itemCount}{" "}
                    {creation.itemCount === 1 ? "item" : "items"}
                    {creation.description ? ` · ${creation.description}` : ""}
                  </span>
                  <small>Updated {formatDate(creation.updatedAt)}</small>
                </span>
                <ChevronRight
                  className="page-card-chevron"
                  size={18}
                  aria-hidden="true"
                />
              </Link>
              <button
                type="button"
                className="icon-button danger-icon"
                aria-label={`Delete ${creation.name}`}
                title="Delete creation"
                onClick={() => void removeCreation(creation)}
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}
      {confirmDialog}
    </AppShell>
  );
}
