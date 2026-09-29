import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { API_BASE_URL, buildPageForm } from "../api";
import { AppShell } from "../components/AppShell";
import type { Page, PageFormState, ShellRouteProps } from "../types";

type PageEditorPageProps = ShellRouteProps & {
  mode: "new" | "edit";
};

export function PageEditorPage({ mode, user, onLogout }: PageEditorPageProps) {
  const navigate = useNavigate();
  const { pageId } = useParams();
  const [form, setForm] = useState<PageFormState>(buildPageForm());
  const [pageTitle, setPageTitle] = useState(
    mode === "new" ? "Create" : "Loading...",
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(mode === "edit");

  useEffect(() => {
    if (mode !== "edit" || !pageId) return;

    async function loadPage() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/pages/${pageId}`, {
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error("Page not found");
        }
        const page: Page = await response.json();
        setForm(buildPageForm(page));
        setPageTitle(page.name);
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
  }, [mode, pageId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const endpoint =
        mode === "edit" && pageId
          ? `${API_BASE_URL}/api/pages/${pageId}`
          : `${API_BASE_URL}/api/pages`;
      const method = mode === "edit" ? "PUT" : "POST";
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message ?? "Unable to save page");
      }
      const page: Page = await response.json();
      navigate(`/pages/${page.id}`);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to save page",
      );
    }
  }

  return (
    <AppShell user={user} onLogout={onLogout} pageTitle={pageTitle}>
      <div className="page-header-row">
        <Link to="/pages" className="nav-link">
          ← Back to pages
        </Link>
      </div>
      <section className="panel form-panel">
        <h2>{mode === "edit" ? "Edit page" : "Create page"}</h2>
        {loading ? (
          <p className="status">Loading page...</p>
        ) : (
          <form onSubmit={submit} className="page-form">
            <label>
              Name
              <input
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                required
                maxLength={120}
              />
            </label>
            <label>
              Description
              <textarea
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                required
                rows={4}
                maxLength={2000}
              />
            </label>
            <label>
              Bio
              <textarea
                value={form.bio}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    bio: event.target.value,
                  }))
                }
                required
                rows={5}
                maxLength={2000}
              />
            </label>
            {error && <p className="error">{error}</p>}
            <div className="page-form-actions">
              <button className="primary-button" type="submit">
                {mode === "edit" ? "Save changes" : "Create page"}
              </button>
            </div>
          </form>
        )}
      </section>
    </AppShell>
  );
}
