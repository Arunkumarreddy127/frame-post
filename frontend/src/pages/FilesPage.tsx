import { FileText, Plus, Trash2 } from "lucide-react";
import { useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { FileEditorArea } from "../components/files/FileEditorArea";
import { isDirty } from "../components/files/useFilesWorkspace";
import { useFilesWorkspaceContext } from "../components/files/FilesWorkspaceProvider";
import { formatDate } from "../format";
import type { ShellRouteProps } from "../types";

export function FilesPage({ user, onLogout }: ShellRouteProps) {
  const { pageId } = useParams<{ pageId?: string }>();
  const { workspace } = useFilesWorkspaceContext();
  const content = workspace.activeTab ? (
    <FileEditorArea pageId={pageId} workspace={workspace} />
  ) : (
    <section className="files-index">
      <header className="app-page-header">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1 className="app-page-title">Files</h1>
          <p className="app-page-description">
            Browse and edit your instruction files.
          </p>
        </div>
        <button
          type="button"
          className="primary-button"
          onClick={workspace.newFile}
        >
          <Plus size={16} aria-hidden="true" />
          New file
        </button>
      </header>
      {workspace.error && (
        <p className="error" role="alert">
          {workspace.error}
        </p>
      )}
      {workspace.files === null ? (
        workspace.error ? null : <p className="status">Loading files...</p>
      ) : (
        <div className="files-index-groups">
          {workspace.groups.map((group) => (
            <section className="files-index-group" key={group.label}>
              <h2>{group.label}</h2>
              {group.items.length === 0 ? (
                <p className="status">No files in this group.</p>
              ) : (
                <ul>
                  {group.items.map((file) => {
                    const openTab = workspace.tabs.find(
                      (tab) => tab.fileId === file.id,
                    );
                    return (
                      <li key={file.id}>
                        <button
                          type="button"
                          className="files-index-open"
                          onClick={() => workspace.openFile(file)}
                        >
                          <FileText size={18} aria-hidden="true" />
                          <span>
                            <strong>{file.name}</strong>
                            <small>Updated {formatDate(file.updatedAt)}</small>
                          </span>
                          {openTab && isDirty(openTab) && (
                            <span
                              className="files-dirty-dot"
                              aria-label="Unsaved changes"
                            />
                          )}
                        </button>
                        <button
                          type="button"
                          className="files-icon-button files-index-delete"
                          onClick={() => void workspace.remove(file)}
                          aria-label={`Delete ${file.name}`}
                          title="Delete file"
                          disabled={workspace.saving}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </section>
  );

  return (
    <AppShell
      user={user}
      onLogout={onLogout}
      pageTitle="Files"
      sidebar={pageId ? "page" : "global"}
      pageId={pageId}
      backTo={pageId ? "/pages" : undefined}
    >
      {content}
    </AppShell>
  );
}
