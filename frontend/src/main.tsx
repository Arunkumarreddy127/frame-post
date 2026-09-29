import { StrictMode } from "react";
import { FormEvent } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthPage } from "./components/AuthPage";
import { PlaceholderPage } from "./components/PlaceholderPage";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { useAuth } from "./hooks/useAuth";
import {
  HomePage,
  PageDetailPage,
  PageEditorPage,
  PageListPage,
} from "./pages";
import type { User } from "./types";
import "./styles.css";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

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
          path="/chat"
          element={
            <ProtectedRoute user={user} loading={loading}>
              <PlaceholderPage
                user={user as User}
                onLogout={logout}
                title="Chat"
                description="Chat is ready for a future workspace experience."
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="/create"
          element={
            <ProtectedRoute user={user} loading={loading}>
              <PlaceholderPage
                user={user as User}
                onLogout={logout}
                title="Create"
                description="Create tools will appear here as the workspace grows."
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="/library"
          element={
            <ProtectedRoute user={user} loading={loading}>
              <PlaceholderPage
                user={user as User}
                onLogout={logout}
                title="Library"
                description="Your library will have a home here soon."
              />
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
