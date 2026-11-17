import { StrictMode } from "react";
import { FormEvent } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Navigate,
  Routes,
  useLocation,
  Route,
  useParams,
} from "react-router-dom";
import { AuthPage } from "./components/AuthPage";
import { GlobalWorkspaceLayout } from "./components/GlobalWorkspaceLayout";
import { PageWorkspaceLayout } from "./components/PageWorkspaceLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { FilesWorkspaceProvider } from "./components/files/FilesWorkspaceProvider";
import { useAuth } from "./hooks/useAuth";
import type { User } from "./types";
import "./styles.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

function PageChatRedirect() {
  const { pageId } = useParams<{ pageId: string }>();
  const { search } = useLocation();
  return <Navigate to={`/pages/${pageId}${search}`} replace />;
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
      <FilesWorkspaceProvider enabled={user !== null}>
        <Routes>
          <Route
            path="/login"
            element={<AuthPage user={user} onSubmit={submit} />}
          />
          <Route
            path="/register"
            element={<AuthPage user={user} onSubmit={submit} />}
          />
          <Route path="/pages/:pageId/chat" element={<PageChatRedirect />} />
          <Route
            path="/pages/:pageId/*"
            element={
              <ProtectedRoute user={user} loading={loading}>
                <PageWorkspaceLayout
                  user={user as User}
                  onLogout={logout}
                />
              </ProtectedRoute>
            }
          />
          <Route
            element={
              <ProtectedRoute user={user} loading={loading}>
                <GlobalWorkspaceLayout
                  user={user as User}
                  onLogout={logout}
                />
              </ProtectedRoute>
            }
          >
            <Route path="pages/new" element={<></>} />
            <Route path="*" element={<></>} />
          </Route>
          <Route
            path="/"
            element={<Navigate to={user ? "/home" : "/login"} replace />}
          />
          <Route
            path="*"
            element={<Navigate to={user ? "/home" : "/login"} replace />}
          />
        </Routes>
      </FilesWorkspaceProvider>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
