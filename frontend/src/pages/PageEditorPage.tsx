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
    mode === "new" ? "New page" : "Loading...",
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);

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
    if (saving) return;
    setError("");
    setSaving(true);
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
      setSaving(false);
    }
  }

  return (
    <AppShell
      user={user}
      onLogout={onLogout}
      pageTitle={pageTitle}
      sidebar={mode === "edit" ? "page" : "global"}
      pageId={pageId}
      backTo="/pages"
    >
      <section className="panel form-panel">
        <div>
          <p className="eyebrow">Page</p>
          <h2>{mode === "edit" ? "Edit page" : "Create a page"}</h2>
          <p className="status form-intro">
            A page groups your chats, files and generations around one idea.
            All fields are required.
          </p>
        </div>
        {loading ? (
          <p className="status" role="status">
            Loading page...
          </p>
        ) : (
          <form onSubmit={submit} className="page-form">
            <label>
              <span className="field-label-row">
                Name
                <small>{form.name.length}/120</small>
              </span>
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
                autoFocus={mode === "new"}
              />
            </label>
            <label>
              <span className="field-label-row">
                Description
                <small>{form.description.length}/2000</small>
              </span>
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
              <span className="field-label-row">
                Bio
                <small>{form.bio.length}/2000</small>
              </span>
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
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <div className="page-form-actions">
              <Link
                className="secondary-button"
                to={mode === "edit" && pageId ? `/pages/${pageId}` : "/pages"}
              >
                Cancel
              </Link>
              <button
                className="primary-button"
                type="submit"
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : mode === "edit"
                    ? "Save changes"
                    : "Create page"}
              </button>
            </div>
          </form>
        )}
      </section>
    </AppShell>
  );
}
