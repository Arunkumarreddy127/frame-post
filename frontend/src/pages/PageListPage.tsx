import { useEffect, useState } from "react";
import { ChevronRight, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../api";
import { AppShell } from "../components/AppShell";
import { useConfirm } from "../components/ConfirmDialog";
import { formatDate } from "../format";
import type { Page, ShellRouteProps } from "../types";

export function PageListPage({ user, onLogout }: ShellRouteProps) {
  const [pages, setPages] = useState<Page[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { confirm, dialog: confirmDialog } = useConfirm();

  useEffect(() => {
    async function loadPages() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`${API_BASE_URL}/api/pages`, {
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error("Unable to load pages");
        }
        setPages(await response.json());
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load pages",
        );
      } finally {
        setLoading(false);
      }
    }

    void loadPages();
  }, []);

  async function removePage(page: Page) {
    const accepted = await confirm({
      title: `Delete “${page.name}”?`,
      message: "This page will be permanently deleted. This cannot be undone.",
      confirmLabel: "Delete page",
      danger: true,
    });
    if (!accepted) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/pages/${page.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Unable to delete page");
      }
      setPages((current) => current.filter((entry) => entry.id !== page.id));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to delete page",
      );
    }
  }

  return (
    <AppShell user={user} onLogout={onLogout} pageTitle="All Pages">
      <div className="page-list-header">
        <div>
          <p className="eyebrow">Pages</p>
          <h2>All pages</h2>
        </div>
        <button
          className="primary-button"
          type="button"
          onClick={() => navigate("/pages/new")}
        >
          New page
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <div className="page-list" aria-busy="true" aria-label="Loading pages">
          {[0, 1, 2].map((index) => (
            <div className="page-card skeleton-card" key={index} />
          ))}
        </div>
      ) : pages.length === 0 ? (
        <div className="empty-state">
          <p>No pages yet. Create your first page to start generating.</p>
          <button
            className="primary-button"
            type="button"
            onClick={() => navigate("/pages/new")}
          >
            Create a page
          </button>
        </div>
      ) : (
        <div className="page-list">
          {pages.map((page) => (
            <div className="page-card" key={page.id}>
              <Link to={`/pages/${page.id}`} className="page-card-link">
                <span className="page-avatar" aria-hidden="true">
                  {page.name.trim().charAt(0).toUpperCase() || "P"}
                </span>
                <span className="page-card-text">
                  <strong>{page.name}</strong>
                  <span>{page.description}</span>
                  <small>Updated {formatDate(page.updatedAt)}</small>
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
                aria-label={`Delete ${page.name}`}
                title="Delete page"
                onClick={() => void removePage(page)}
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
