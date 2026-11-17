import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useMatch, useNavigate } from "react-router-dom";
import { useConfirm } from "../ConfirmDialog";
import { FileExplorer } from "./FileExplorer";
import {
  useFilesWorkspace,
  type FilesWorkspaceState,
} from "./useFilesWorkspace";

type FilesWorkspaceContextValue = {
  workspace: FilesWorkspaceState;
  filesExplorer: ReactNode;
  filesPath: string;
  pageId?: string;
  pageTabs: WorkspacePageTab[];
  activePageTabKey?: string;
  closePageTab: (key: string) => void;
};

export type WorkspacePageTab = {
  key: string;
  label: "Home" | "Overview" | "Create" | "Library" | "Pages";
  pageId?: string;
  to: string;
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
  const currentPageTab = getPageTab(location.pathname, pageId);

  useEffect(() => {
    if (!currentPageTab) return;
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
      navigate(nextTab?.to ?? filesPath);
    }
  }

  const filesExplorer = (
    <FileExplorer workspace={workspace} filesPath={filesPath} />
  );

  return (
    <FilesWorkspaceContext.Provider
      value={{
        workspace,
        filesExplorer,
        filesPath,
        pageId,
        pageTabs,
        activePageTabKey: currentPageTab?.key,
        closePageTab,
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
