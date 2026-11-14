import { FormEvent, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Navigate } from "react-router-dom";
import type { User } from "../types";

type AuthPageProps = {
  user: User | null;
  onSubmit: (
    event: FormEvent<HTMLFormElement>,
    mode: "login" | "register",
  ) => Promise<void>;
};

export function AuthPage({ user, onSubmit }: AuthPageProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    return <Navigate to="/home" replace />;
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
            autoFocus
          />
          {mode === "register" && (
            <small className="field-hint">
              3–30 characters: letters, numbers and underscores.
            </small>
          )}
        </label>
        <label>
          Password
          <span className="password-field">
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              required
              minLength={8}
              maxLength={128}
            />
            <button
              type="button"
              className="password-toggle"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((current) => !current)}
            >
              {showPassword ? (
                <EyeOff size={16} aria-hidden="true" />
              ) : (
                <Eye size={16} aria-hidden="true" />
              )}
            </button>
          </span>
          {mode === "register" && (
            <small className="field-hint">Use at least 8 characters.</small>
          )}
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button
          className="primary-button auth-submit"
          type="submit"
          disabled={loading}
        >
          {loading
            ? "Please wait..."
            : mode === "login"
              ? "Enter Framepost"
              : "Create account"}
        </button>
      </form>
    </main>
  );
}
