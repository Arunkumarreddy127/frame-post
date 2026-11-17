import { useEffect, useState, type ReactNode } from "react";
import { Routes, useLocation } from "react-router-dom";
import { useFilesWorkspaceContext } from "./files/FilesWorkspaceProvider";

type CachedRoute = {
  key: string;
  pageTabKey: string;
  location: ReturnType<typeof useLocation>;
};

export function WorkspaceRouteCache({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  return enabled ? (
    <AuthenticatedWorkspaceRouteCache>
      {children}
    </AuthenticatedWorkspaceRouteCache>
  ) : (
    <Routes>{children}</Routes>
  );
}

function AuthenticatedWorkspaceRouteCache({
  children,
}: {
  children: ReactNode;
}) {
  const location = useLocation();
  const { activePageTabKey, pageTabs } = useFilesWorkspaceContext();
  const activeRouteKey = activePageTabKey
    ? `${activePageTabKey}:${location.pathname}`
    : undefined;
  const [cachedRoutes, setCachedRoutes] = useState<CachedRoute[]>(() =>
    activePageTabKey && activeRouteKey
      ? [{ key: activeRouteKey, pageTabKey: activePageTabKey, location }]
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

  const openKeys = new Set(pageTabs.map((tab) => tab.key));
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

  return (
    <>
      {routesToKeep.map((route) => {
        const active = route.key === activeRouteKey;
        return (
          <div
            key={route.key}
            hidden={!active}
            aria-hidden={!active}
          >
            <Routes location={route.location}>{children}</Routes>
          </div>
        );
      })}
      {!activePageTabKey && <Routes>{children}</Routes>}
    </>
  );
}
