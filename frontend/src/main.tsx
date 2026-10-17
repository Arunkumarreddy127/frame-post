import { StrictMode } from "react";
import { FormEvent } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useParams,
} from "react-router-dom";
import { AuthPage } from "./components/AuthPage";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { useAuth } from "./hooks/useAuth";
import {
  ChatPage,
  CreatePage,
  GenerationsPage,
  GptImageGenPage,
  HomePage,
  PageDetailPage,
  PageEditorPage,
  PageListPage,
  LibraryPage,
  RunningHubWorkflowPage,
} from "./pages";
import type { User } from "./types";
import "./styles.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

const LEGACY_MINIMAX_KEY = "minimax-h3-ff-image-to-video";

function PageLibraryRoute({
  user,
  onLogout,
}: {
  user: User;
  onLogout: () => Promise<void>;
}) {
  const { pageId } = useParams<{ pageId: string }>();
  return <LibraryPage user={user} onLogout={onLogout} pageId={pageId} />;
}

function LegacyMinimaxRedirect() {
  const { pageId } = useParams<{ pageId?: string }>();
  const base = pageId ? `/pages/${pageId}/create` : "/create";
  return <Navigate to={`${base}/rh/${LEGACY_MINIMAX_KEY}`} replace />;
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
          element={<AuthPage user={user} onSubmit={submit} />}
        />
        <Route
          path="/register"
          element={<AuthPage user={user} onSubmit={submit} />}
        />
        <Route
          path="/home"
          element={
            <ProtectedRoute user={user} loading={loading}>
              <HomePage user={user as User} onLogout={logout} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pages"
          element={
            <ProtectedRoute user={user} loading={loading}>
              <PageListPage user={user as User} onLogout={logout} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pages/new"
          element={
            <ProtectedRoute user={user} loading={loading}>
              <PageEditorPage
                mode="new"
                user={user as User}
                onLogout={logout}
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pages/:pageId"
          element={
            <ProtectedRoute user={user} loading={loading}>
              <PageDetailPage user={user as User} onLogout={logout} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pages/:pageId/edit"
          element={
            <ProtectedRoute user={user} loading={loading}>
              <PageEditorPage
                mode="edit"
                user={user as User}
                onLogout={logout}
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pages/:pageId/chat"
          element={
            <ProtectedRoute user={user} loading={loading}>
              <ChatPage user={user as User} onLogout={logout} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pages/:pageId/create"
          element={
            <ProtectedRoute user={user} loading={loading}>
              <CreatePage user={user as User} onLogout={logout} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pages/:pageId/create/gpt-image-gen"
          element={
            <ProtectedRoute user={user} loading={loading}>
              <GptImageGenPage user={user as User} onLogout={logout} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pages/:pageId/create/rh-minimax-h3-ff-image-to-video"
          element={<LegacyMinimaxRedirect />}
        />
        <Route
          path="/pages/:pageId/create/rh/:workflowKey"
          element={
            <ProtectedRoute user={user} loading={loading}>
              <RunningHubWorkflowPage user={user as User} onLogout={logout} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pages/:pageId/library"
          element={
            <ProtectedRoute user={user} loading={loading}>
              <PageLibraryRoute user={user as User} onLogout={logout} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pages/:pageId/generations"
          element={
            <ProtectedRoute user={user} loading={loading}>
              <GenerationsPage user={user as User} onLogout={logout} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/generations"
          element={
            <ProtectedRoute user={user} loading={loading}>
              <GenerationsPage user={user as User} onLogout={logout} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chat"
          element={
            <ProtectedRoute user={user} loading={loading}>
              <ChatPage user={user as User} onLogout={logout} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/create"
          element={
            <ProtectedRoute user={user} loading={loading}>
              <CreatePage user={user as User} onLogout={logout} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/create/gpt-image-gen"
          element={
            <ProtectedRoute user={user} loading={loading}>
              <GptImageGenPage user={user as User} onLogout={logout} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/create/rh-minimax-h3-ff-image-to-video"
          element={<LegacyMinimaxRedirect />}
        />
        <Route
          path="/create/rh/:workflowKey"
          element={
            <ProtectedRoute user={user} loading={loading}>
              <RunningHubWorkflowPage user={user as User} onLogout={logout} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/library"
          element={
            <ProtectedRoute user={user} loading={loading}>
              <LibraryPage user={user as User} onLogout={logout} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/"
          element={<Navigate to={user ? "/home" : "/login"} replace />}
        />
        <Route
          path="*"
          element={<Navigate to={user ? "/home" : "/login"} replace />}
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
