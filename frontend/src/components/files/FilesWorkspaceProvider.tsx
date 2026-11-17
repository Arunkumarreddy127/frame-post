import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useMatch, useNavigate } from "react-router-dom";
import { useConfirm } from "../ConfirmDialog";
import { FileExplorer } from "./FileExplorer";
import { CreationsExplorer } from "../creations/CreationsExplorer";
import {
  useFilesWorkspace,
  type FilesWorkspaceState,
} from "./useFilesWorkspace";

type FilesWorkspaceContextValue = {
  workspace: FilesWorkspaceState;
  filesExplorer: ReactNode;
  creationsExplorer: ReactNode;
  filesPath: string;
  pageId?: string;
  pageTabs: WorkspacePageTab[];
  activePageTabKey?: string;
  closePageTab: (key: string) => void;
  closeAllPageTabs: () => void;
  setCreationTabLabel: (creationId: string, label: string) => void;
};

export type WorkspacePageTab = {
  key: string;
  label: string;
  pageId?: string;
  to: string;
  kind?: "creation";
  creationId?: string;
};

const FilesWorkspaceContext =
  createContext<FilesWorkspaceContextValue | null>(null);

export function FilesWorkspaceProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  return enabled ? (
    <AuthenticatedFilesWorkspaceProvider>
      {children}
    </AuthenticatedFilesWorkspaceProvider>
  ) : (
    children
  );
}

function AuthenticatedFilesWorkspaceProvider({
  children,
}: {
  children: ReactNode;
}) {
  const pageMatch = useMatch("/pages/:pageId/*");
  const isNewPageRoute = useMatch({ path: "/pages/new", end: true }) !== null;
  const pageId = isNewPageRoute ? undefined : pageMatch?.params.pageId;
  const filesPath = pageId ? `/pages/${pageId}/files` : "/files";
  const location = useLocation();
  const navigate = useNavigate();
  const { confirm, dialog } = useConfirm();
  const workspace = useFilesWorkspace(pageId, confirm);
  const [pageTabs, setPageTabs] = useState<WorkspacePageTab[]>([]);
  const skipPageTabPath = useRef<string | null>(null);
  const filesTabKey = `${pageId ? `page:${pageId}` : "global"}:files`;
  const hasFilesTab = pageTabs.some((tab) => tab.key === filesTabKey);
  const currentPageTab = getPageTab(
    location.pathname,
    pageId,
    workspace.activeTab !== undefined,
    hasFilesTab,
  );

  useEffect(() => {
    if (!currentPageTab) return;
    if (skipPageTabPath.current === location.pathname) {
      skipPageTabPath.current = null;
      return;
    }
    const to = `${location.pathname}${location.search}`;
    setPageTabs((current) => {
      const existing = current.find((tab) => tab.key === currentPageTab.key);
      if (existing?.to === to) return current;
      if (existing) {
        return current.map((tab) =>
          tab.key === currentPageTab.key ? { ...tab, to } : tab,
        );
      }
      return [...current, { ...currentPageTab, to }];
    });
  }, [currentPageTab?.key, location.pathname, location.search]);

  function closePageTab(key: string) {
    const remaining = pageTabs.filter((tab) => tab.key !== key);
    setPageTabs(remaining);
    if (currentPageTab?.key === key) {
      const nextTab = remaining
        .filter((tab) => tab.pageId === pageId)
        .at(-1);
      const closingTab = pageTabs.find((tab) => tab.key === key);
      const creationsPath = pageId
        ? `/pages/${pageId}/creations`
        : "/creations";
      const workspacePath = pageId ? `/pages/${pageId}` : "/home";
      navigate(
        nextTab?.to ??
          (closingTab?.kind === "creation"
            ? creationsPath
            : closingTab?.label === "Files"
              ? workspacePath
              : filesPath),
      );
    }
  }

  function closeAllPageTabs() {
    setPageTabs((current) => current.filter((tab) => tab.pageId !== pageId));
    const destination = pageId ? `/pages/${pageId}` : "/home";
    if (location.pathname !== destination) {
      skipPageTabPath.current = destination;
    }
    navigate(destination);
  }

  const setCreationTabLabel = useCallback(
    (creationId: string, label: string) => {
      const key = `creation:${pageId ?? "global"}:${creationId}`;
      const to = pageId
        ? `/pages/${pageId}/creations/${encodeURIComponent(creationId)}`
        : `/creations/${encodeURIComponent(creationId)}`;
      setPageTabs((current) => {
        const existing = current.find((tab) => tab.key === key);
        if (existing?.label === label) return current;
        if (existing) {
          return current.map((tab) =>
            tab.key === key ? { ...tab, label } : tab,
          );
        }
        return [
          ...current,
          {
            key,
            label,
            pageId,
            creationId,
            kind: "creation",
            to,
          },
        ];
      });
    },
    [pageId],
  );

  const filesExplorer = (
    <FileExplorer workspace={workspace} filesPath={filesPath} />
  );
  const creationsExplorer = (
    <CreationsExplorer
      pageId={pageId}
      activePageTabKey={currentPageTab?.key}
    />
  );

  return (
    <FilesWorkspaceContext.Provider
      value={{
        workspace,
        filesExplorer,
        creationsExplorer,
        filesPath,
        pageId,
        pageTabs,
        activePageTabKey: currentPageTab?.key,
        closePageTab,
        closeAllPageTabs,
        setCreationTabLabel,
      }}
    >
      {children}
      {dialog}
    </FilesWorkspaceContext.Provider>
  );
}

function getPageTab(
  pathname: string,
  pageId: string | undefined,
  hasActiveFile: boolean,
  hasFilesTab: boolean,
): Omit<WorkspacePageTab, "to"> | null {
  const pageBase = pageId ? `/pages/${pageId}` : "";
  if (!pageId && pathname === "/home") {
    return { key: "global:home", label: "Home" };
  }
  if (!pageId && pathname === "/pages") {
    return { key: "global:pages", label: "Pages" };
  }
  if (pageId && pathname === pageBase) {
    return {
      key: `page:${pageId}:overview`,
      label: "Overview",
      pageId,
    };
  }

  const creationsPath = `${pageBase}/creations`;
  const filesPath = `${pageBase}/files`;
  if (pathname === filesPath && (!hasActiveFile || hasFilesTab)) {
    return {
      key: `${pageId ? `page:${pageId}` : "global"}:files`,
      label: "Files",
      pageId,
    };
  }

  if (pathname === creationsPath) {
    return {
      key: `${pageId ? `page:${pageId}` : "global"}:creations`,
      label: "Creations",
      pageId,
    };
  }

  if (pathname.startsWith(`${creationsPath}/`)) {
    const creationId = pathname.slice(creationsPath.length + 1).split("/")[0];
    if (creationId) {
      return {
        key: `creation:${pageId ?? "global"}:${creationId}`,
        label: "Creation",
        pageId,
        creationId,
        kind: "creation",
      };
    }
  }

  for (const label of ["Create", "Library"] as const) {
    const route = label.toLowerCase();
    const basePath = `${pageBase}/${route}`;
    if (pathname === basePath || pathname.startsWith(`${basePath}/`)) {
      return {
        key: `${pageId ? `page:${pageId}` : "global"}:${route}`,
        label,
        pageId,
      };
    }
  }
  return null;
}

export function useFilesWorkspaceContext() {
  const context = useContext(FilesWorkspaceContext);
  if (!context) {
    throw new Error("Files workspace must be used within its provider.");
  }
  return context;
}
