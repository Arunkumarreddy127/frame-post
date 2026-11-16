import { createContext, useContext, type ReactNode } from "react";
import { useMatch } from "react-router-dom";
import { useConfirm } from "../ConfirmDialog";
import { FileExplorer } from "./FileExplorer";
import {
  useFilesWorkspace,
  type FilesWorkspaceState,
} from "./useFilesWorkspace";

type FilesWorkspaceContextValue = {
  workspace: FilesWorkspaceState;
  filesExplorer: ReactNode;
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
  const pageId = pageMatch?.params.pageId;
  const filesPath = pageId ? `/pages/${pageId}/files` : "/files";
  const { confirm, dialog } = useConfirm();
  const workspace = useFilesWorkspace(pageId, confirm);
  const filesExplorer = (
    <FileExplorer workspace={workspace} filesPath={filesPath} />
  );

  return (
    <FilesWorkspaceContext.Provider value={{ workspace, filesExplorer }}>
      {children}
      {dialog}
    </FilesWorkspaceContext.Provider>
  );
}

export function useFilesWorkspaceContext() {
  const context = useContext(FilesWorkspaceContext);
  if (!context) {
    throw new Error("Files workspace must be used within its provider.");
  }
  return context;
}
