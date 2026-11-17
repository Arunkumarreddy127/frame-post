import { Navigate, Route } from "react-router-dom";
import { WorkspaceAppShell } from "./AppShell";
import { WorkspaceRouteCache } from "./WorkspaceRouteCache";
import { CreatePage } from "../pages/CreatePage";
import { FilesPage } from "../pages/FilesPage";
import { GenerationsPage } from "../pages/GenerationsPage";
import { GptImageGenPage } from "../pages/GptImageGenPage";
import { HomePage } from "../pages/HomePage";
import { PageEditorPage } from "../pages/PageEditorPage";
import { PageListPage } from "../pages/PageListPage";
import { LibraryPage } from "../pages/LibraryPage";
import { RunningHubWorkflowPage } from "../pages/RunningHubWorkflowPage";
import type { ShellRouteProps } from "../types";

const LEGACY_MINIMAX_KEY = "minimax-h3-ff-image-to-video";

export function GlobalWorkspaceLayout({ user, onLogout }: ShellRouteProps) {
  return (
    <WorkspaceAppShell
      user={user}
      onLogout={onLogout}
      pageTitle="Workspace"
      sidebar="global"
      backTo="/home"
    >
      <WorkspaceRouteCache>
        <Route
          path="/home"
          element={<HomePage user={user} onLogout={onLogout} />}
        />
        <Route
          path="/pages"
          element={<PageListPage user={user} onLogout={onLogout} />}
        />
        <Route
          path="/pages/new"
          element={
            <PageEditorPage mode="new" user={user} onLogout={onLogout} />
          }
        />
        <Route
          path="/generations"
          element={<GenerationsPage user={user} onLogout={onLogout} />}
        />
        <Route path="/chat" element={<Navigate to="/home" replace />} />
        <Route
          path="/files"
          element={<FilesPage user={user} onLogout={onLogout} />}
        />
        <Route
          path="/create"
          element={<CreatePage user={user} onLogout={onLogout} />}
        />
        <Route
          path="/create/gpt-image-gen"
          element={<GptImageGenPage user={user} onLogout={onLogout} />}
        />
        <Route
          path="/create/rh-minimax-h3-ff-image-to-video"
          element={
            <Navigate
              to={`/create/rh/${LEGACY_MINIMAX_KEY}`}
              replace
            />
          }
        />
        <Route
          path="/create/rh/:workflowKey"
          element={
            <RunningHubWorkflowPage user={user} onLogout={onLogout} />
          }
        />
        <Route
          path="/library"
          element={<LibraryPage user={user} onLogout={onLogout} />}
        />
        <Route
          path="/"
          element={<Navigate to="/home" replace />}
        />
        <Route
          path="*"
          element={<Navigate to="/home" replace />}
        />
      </WorkspaceRouteCache>
    </WorkspaceAppShell>
  );
}
