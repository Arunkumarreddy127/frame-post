import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../api";
import { AppShell } from "../components/AppShell";
import type { Page, ShellRouteProps } from "../types";

export function PageListPage({ user, onLogout }: ShellRouteProps) {
  const [pages, setPages] = useState<Page[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

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

  async function removePage(id: string) {
    if (!window.confirm("Delete this page?")) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/pages/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Unable to delete page");
      }
      setPages((current) => current.filter((page) => page.id !== id));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to delete page",
      );
    }
  }

  return (
    <AppShell
      user={user}
      onLogout={onLogout}
      pageTitle="DREAMVERSE"
      pages={pages}
    >
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
      {error && <p className="error">{error}</p>}
      {loading ? (
        <p className="status">Loading pages...</p>
      ) : pages.length === 0 ? (
        <div className="empty-state">
          <p>No pages yet.</p>
          <button
            className="primary-button"
            type="button"
            onClick={() => navigate("/pages/new")}
          >
            Create one
          </button>
        </div>
      ) : (
        <div className="page-list">
          {pages.map((page) => (
            <div className="page-card" key={page.id}>
              <Link to={`/pages/${page.id}`} className="page-card-link">
                <strong>{page.name}</strong>
                <span>{page.description}</span>
              </Link>
              <div className="page-card-actions">
                <Link
                  to={`/pages/${page.id}/edit`}
                  className="secondary-button small-button"
                >
                  Edit
                </Link>
                <button
                  type="button"
                  className="secondary-button small-button danger-button"
                  onClick={() => void removePage(page.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
