import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { useConfirm } from "../components/ConfirmDialog";
import { FileEditorArea } from "../components/files/FileEditorArea";
import { FileExplorer } from "../components/files/FileExplorer";
import { useFilesWorkspace } from "../components/files/useFilesWorkspace";
import type { ShellRouteProps } from "../types";

export function FilesPage({ user, onLogout }: ShellRouteProps) {
  const { pageId } = useParams<{ pageId?: string }>();
  const { confirm, dialog } = useConfirm();
  const workspace = useFilesWorkspace(pageId, confirm);
  const filesExplorer = useMemo(
    () => <FileExplorer workspace={workspace} />,
    [
      workspace.files,
      workspace.groups,
      workspace.tabs,
      workspace.activeTab,
      workspace.saving,
      workspace.remove,
    ],
  );

  return (
    <AppShell
      user={user}
      onLogout={onLogout}
      pageTitle="Files"
      sidebar={pageId ? "page" : "global"}
      pageId={pageId}
      backTo={pageId ? "/pages" : undefined}
      filesExplorer={filesExplorer}
    >
      <>
        <FileEditorArea pageId={pageId} workspace={workspace} />
        {dialog}
      </>
    </AppShell>
  );
}
