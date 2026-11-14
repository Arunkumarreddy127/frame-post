import { Outlet, useParams } from "react-router-dom";
import { WorkspaceAppShell } from "./AppShell";
import type { ShellRouteProps } from "../types";

export function PageWorkspaceLayout({ user, onLogout }: ShellRouteProps) {
  const { pageId } = useParams<{ pageId: string }>();

  return (
    <WorkspaceAppShell
      user={user}
      onLogout={onLogout}
      pageId={pageId}
    >
      <Outlet />
    </WorkspaceAppShell>
  );
}
