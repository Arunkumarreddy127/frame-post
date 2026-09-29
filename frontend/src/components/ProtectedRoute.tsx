import { Navigate } from "react-router-dom";
import type { User } from "../types";

type ProtectedRouteProps = {
  children: React.ReactNode;
  user: User | null;
  loading: boolean;
};

export function ProtectedRoute({
  children,
  user,
  loading,
}: ProtectedRouteProps) {
  if (loading) {
    return (
      <main className="shell">
        <p className="status">Loading Framepost...</p>
      </main>
    );
  }

  return user ? <>{children}</> : <Navigate to="/login" replace />;
}
