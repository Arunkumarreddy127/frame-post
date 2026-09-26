import { StrictMode } from "react";
import { FormEvent, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type User = { username: string };

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch(`${API_BASE_URL}/api/auth/me`, { credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then((currentUser: User | null) => setUser(currentUser))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
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

  if (user) {
    return (
      <main className="shell home-shell">
        <div className="home-panel">
          <p className="eyebrow">Framepost home</p>
          <h1>Hello, {user.username}</h1>
          <p className="status">Your workspace is ready.</p>
          <button className="secondary-button" onClick={() => void logout()}>
            Log out
          </button>
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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
