import { useEffect, useState, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import { CreatePage } from "../pages/CreatePage";
import { CreationDetailPage } from "../pages/CreationDetailPage";
import { CreationsPage } from "../pages/CreationsPage";
import { FilesPage } from "../pages/FilesPage";
import { GenerationsPage } from "../pages/GenerationsPage";
import { GptImageGenPage } from "../pages/GptImageGenPage";
import { PageDetailPage } from "../pages/PageDetailPage";
import { PageEditorPage } from "../pages/PageEditorPage";
import { LibraryPage } from "../pages/LibraryPage";
import { RunningHubWorkflowPage } from "../pages/RunningHubWorkflowPage";
import type { ShellRouteProps } from "../types";
import { useFilesWorkspaceContext } from "./files/FilesWorkspaceProvider";

const LEGACY_MINIMAX_KEY = "minimax-h3-ff-image-to-video";

type CachedPageRoute = {
  key: string;
  pageTabKey: string;
  location: ReturnType<typeof useLocation>;
};

export function PageWorkspaceRoutes({ user, onLogout }: ShellRouteProps) {
  const { pageId } = useParams<{ pageId: string }>();
  const location = useLocation();
  const { activePageTabKey, pageTabs } = useFilesWorkspaceContext();
  const activeRouteKey = activePageTabKey
    ? `${activePageTabKey}:${location.pathname}`
    : undefined;
  const [cachedRoutes, setCachedRoutes] = useState<CachedPageRoute[]>(() =>
    activePageTabKey && activeRouteKey
      ? [
          {
            key: activeRouteKey,
            pageTabKey: activePageTabKey,
            location,
          },
        ]
      : [],
  );

  useEffect(() => {
    if (!activePageTabKey || !activeRouteKey) return;
    setCachedRoutes((current) => {
      const existing = current.find((route) => route.key === activeRouteKey);
      if (existing?.location.key === location.key) return current;
      if (existing) {
        return current.map((route) =>
          route.key === activeRouteKey ? { ...route, location } : route,
        );
      }
      return [
        ...current,
        { key: activeRouteKey, pageTabKey: activePageTabKey, location },
      ];
    });
  }, [activePageTabKey, activeRouteKey, location]);

  const openKeys = new Set(
    pageTabs
      .filter((tab) => tab.pageId === pageId)
      .map((tab) => tab.key),
  );
  if (activePageTabKey) openKeys.add(activePageTabKey);
  const routesToKeep = cachedRoutes
    .filter((route) => openKeys.has(route.pageTabKey))
    .map((route) =>
      route.key === activeRouteKey ? { ...route, location } : route,
    );

  if (activePageTabKey && activeRouteKey) {
    if (!routesToKeep.some((route) => route.key === activeRouteKey)) {
      routesToKeep.push({
        key: activeRouteKey,
        pageTabKey: activePageTabKey,
        location,
      });
    }
  }

  const routeElements: ReactNode = (
    <>
      <Route
        index
        element={<PageDetailPage user={user} onLogout={onLogout} />}
      />
      <Route
        path="edit"
        element={
          <PageEditorPage mode="edit" user={user} onLogout={onLogout} />
        }
      />
      <Route
        path="files"
        element={<FilesPage user={user} onLogout={onLogout} />}
      />
      <Route
        path="create"
        element={
          <CreatePage user={user} onLogout={onLogout} pageId={pageId} />
        }
      />
      <Route
        path="create/gpt-image-gen"
        element={<GptImageGenPage user={user} onLogout={onLogout} />}
      />
      <Route
        path="create/rh-minimax-h3-ff-image-to-video"
        element={
          <Navigate
            to={`/pages/${pageId}/create/rh/${LEGACY_MINIMAX_KEY}`}
            replace
          />
        }
      />
      <Route
        path="create/rh/:workflowKey"
        element={
          <RunningHubWorkflowPage user={user} onLogout={onLogout} />
        }
      />
      <Route
        path="library"
        element={
          <LibraryPage user={user} onLogout={onLogout} pageId={pageId} />
        }
      />
      <Route
        path="generations"
        element={<GenerationsPage user={user} onLogout={onLogout} />}
      />
      <Route
        path="creations"
        element={
          <CreationsPage user={user} onLogout={onLogout} pageId={pageId} />
        }
      />
      <Route
        path="creations/:creationId"
        element={
          <CreationDetailPage user={user} onLogout={onLogout} pageId={pageId} />
        }
      />
    </>
  );

  return (
    <>
      {routesToKeep.map((route) => {
        const active = route.key === activeRouteKey;
        return (
          <div key={route.key} hidden={!active} aria-hidden={!active}>
            <Routes location={route.location}>{routeElements}</Routes>
          </div>
        );
      })}
      {!activePageTabKey && <Routes>{routeElements}</Routes>}
    </>
  );
}
