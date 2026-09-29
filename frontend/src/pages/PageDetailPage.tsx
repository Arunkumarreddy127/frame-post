import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { API_BASE_URL } from "../api";
import { AppShell } from "../components/AppShell";
import type { Page, ShellRouteProps } from "../types";

export function PageDetailPage({ user, onLogout }: ShellRouteProps) {
  const { pageId } = useParams();
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadPage() {
      if (!pageId) return;
      try {
        const response = await fetch(`${API_BASE_URL}/api/pages/${pageId}`, {
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error("Page not found");
        }
        setPage(await response.json());
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load page",
        );
      } finally {
        setLoading(false);
      }
    }

    void loadPage();
  }, [pageId]);

  if (loading) {
    return (
      <AppShell user={user} onLogout={onLogout} pageTitle="Loading...">
        <p className="status">Loading page...</p>
      </AppShell>
    );
  }

  if (error || !page) {
    return (
      <AppShell user={user} onLogout={onLogout} pageTitle="Page not found">
        <div className="panel error-panel">
          <p className="error">{error || "Page not found."}</p>
          <Link to="/pages" className="primary-button">
            Back to pages
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell user={user} onLogout={onLogout} pageTitle={page.name}>
      <div className="page-header-row">
        <Link to="/pages" className="nav-link">
          ← Back to pages
        </Link>
        <Link
          to={`/pages/${page.id}/edit`}
          className="secondary-button small-button"
        >
          Edit page
        </Link>
      </div>
      <section className="panel page-detail-panel">
        <p className="eyebrow">Page workspace</p>
        <h2>{page.name}</h2>
        <p className="page-detail-copy">{page.description}</p>
        <div className="detail-block">
          <h3>Bio</h3>
          <p>{page.bio}</p>
        </div>
        <div className="meta-grid">
          <div>
            <span className="meta-label">Created</span>
            <strong>{new Date(page.createdAt).toLocaleString()}</strong>
          </div>
          <div>
            <span className="meta-label">Updated</span>
            <strong>{new Date(page.updatedAt).toLocaleString()}</strong>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
