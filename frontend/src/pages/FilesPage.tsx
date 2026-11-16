import { useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { FileEditorArea } from "../components/files/FileEditorArea";
import { useFilesWorkspaceContext } from "../components/files/FilesWorkspaceProvider";
import type { ShellRouteProps } from "../types";

export function FilesPage({ user, onLogout }: ShellRouteProps) {
  const { pageId } = useParams<{ pageId?: string }>();
  const { workspace } = useFilesWorkspaceContext();

  return (
    <AppShell
      user={user}
      onLogout={onLogout}
      pageTitle="Files"
      sidebar={pageId ? "page" : "global"}
      pageId={pageId}
      backTo={pageId ? "/pages" : undefined}
    >
      <FileEditorArea pageId={pageId} workspace={workspace} />
    </AppShell>
  );
}
