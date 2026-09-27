import { StrictMode, useEffect, useMemo, useState } from "react";
import { FormEvent } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
} from "react-router-dom";
import "./styles.css";

type User = { username: string };
type Page = {
  id: string;
  name: string;
  description: string;
  bio: string;
  createdAt: string;
  updatedAt: string;
};

type PageFormState = {
  name: string;
  description: string;
  bio: string;
};

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

function buildPageForm(page?: Page): PageFormState {
  return {
    name: page?.name ?? "",
    description: page?.description ?? "",
    bio: page?.bio ?? "",
  };
}

function AppShell({ children }: { children: React.ReactNode }) {
  return <div className="shell app-shell"> {children} </div>;
}

function AuthPage({
  user,
  onSubmit,
  onLogout,
}: {
  user: User | null;
  onSubmit: (
    event: FormEvent<HTMLFormElement>,
    mode: "login" | "register",
  ) => Promise<void>;
  onLogout: () => Promise<void>;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await onSubmit(event, mode);
      setPassword("");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to authenticate",
      );
    } finally {
      setLoading(false);
    }
  }

  if (user) {
    return (
      <main className="shell home-shell">
        <div className="home-panel">
          <p className="eyebrow">Framepost home</p>
          <h1>Hello, {user.username}</h1>
          <p className="status">Your workspace is ready.</p>
          <div className="home-actions">
            <Link to="/pages" className="primary-button">
              View pages
            </Link>
            <button
              className="secondary-button"
              onClick={() => void onLogout()}
            >
              Log out
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="shell auth-shell">
      <section className="intro">
        <p className="eyebrow">Framepost</p>
        <h1>A quiet place to begin.</h1>
        <p className="status">Sign in to enter your workspace.</p>
      </section>
      <form className="auth-panel" onSubmit={submit}>
        <div className="mode-switcher">
          <button
            type="button"
            className={mode === "login" ? "mode-button active" : "mode-button"}
            onClick={() => setMode("login")}
          >
            Log in
          </button>
          <button
            type="button"
            className={
              mode === "register" ? "mode-button active" : "mode-button"
            }
            onClick={() => setMode("register")}
          >
            Create account
          </button>
        </div>
        <label>
          Username
          <input
            name="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            required
            minLength={3}
            maxLength={30}
            pattern="[a-zA-Z0-9_]+"
          />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            required
            minLength={8}
            maxLength={128}
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary-button" type="submit" disabled={loading}>
          {mode === "login" ? "Enter Framepost" : "Create account"}
        </button>
      </form>
    </main>
  );
}

function PageList() {
  const [pages, setPages] = useState<Page[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

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

  useEffect(() => {
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
    <AppShell>
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

function PageEditor({ mode }: { mode: "new" | "edit" }) {
  const navigate = useNavigate();
  const { pageId } = useParams();
  const [form, setForm] = useState<PageFormState>(buildPageForm());
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
    <AppShell>
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

function PageDetail() {
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
      <AppShell>
        <p className="status">Loading page...</p>
      </AppShell>
    );
  }

  if (error || !page) {
    return (
      <AppShell>
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
    <AppShell>
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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <main className="shell">
        <p className="status">Loading Framepost...</p>
      </main>
    );
  }

  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/auth/me`, { credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then((currentUser: User | null) => setUser(currentUser))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  return { user, loading, setUser };
}

function App() {
  const { user, loading, setUser } = useAuth();

  async function submit(
    event: FormEvent<HTMLFormElement>,
    mode: "login" | "register",
  ) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const username = String(formData.get("username") ?? "");
    const password = String(formData.get("password") ?? "");

    const response = await fetch(`${API_BASE_URL}/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.detail ?? "Unable to authenticate");
    }

    setUser(await response.json());
  }

  async function logout() {
    await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    setUser(null);
  }

  if (loading) {
    return (
      <main className="shell">
        <p className="status">Loading Framepost...</p>
      </main>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={<AuthPage user={user} onSubmit={submit} onLogout={logout} />}
        />
        <Route
          path="/register"
          element={<AuthPage user={user} onSubmit={submit} onLogout={logout} />}
        />
        <Route
          path="/pages"
          element={
            <ProtectedRoute>
              <PageList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pages/new"
          element={
            <ProtectedRoute>
              <PageEditor mode="new" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pages/:pageId"
          element={
            <ProtectedRoute>
              <PageDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pages/:pageId/edit"
          element={
            <ProtectedRoute>
              <PageEditor mode="edit" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/"
          element={
            user ? (
              <Navigate to="/pages" replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="*"
          element={<Navigate to={user ? "/pages" : "/login"} replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
