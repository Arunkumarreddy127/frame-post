import { useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { FileEditorArea } from "../components/files/FileEditorArea";
import { FileExplorer } from "../components/files/FileExplorer";
import { useFilesWorkspace } from "../components/files/useFilesWorkspace";
import type { ShellRouteProps } from "../types";

export function FilesPage({ user, onLogout }: ShellRouteProps) {
  const { pageId } = useParams<{ pageId?: string }>();
  const workspace = useFilesWorkspace(pageId);

  return (
    <AppShell
      user={user}
      onLogout={onLogout}
      pageTitle="Files"
      sidebar={pageId ? "page" : "global"}
      pageId={pageId}
      backTo={pageId ? "/pages" : undefined}
      filesExplorer={<FileExplorer workspace={workspace} />}
    >
      <FileEditorArea pageId={pageId} workspace={workspace} />
    </AppShell>
  );
}
