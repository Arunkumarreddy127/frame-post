import { FileText, Plus, Trash2 } from "lucide-react";
import { isDirty, type FilesWorkspaceState } from "./useFilesWorkspace";

type FileExplorerProps = {
  workspace: FilesWorkspaceState;
};

export function FileExplorer({ workspace }: FileExplorerProps) {
  const { files, groups, tabs, activeTab, saving, openFile, newFile, remove } =
    workspace;

  return (
    <div className="files-explorer" role="group" aria-label="Instruction files">
      <div className="files-explorer-header">
        <button
          type="button"
          className="files-icon-button files-new-button"
          onClick={newFile}
          aria-label="New file"
          title="New file"
        >
          <Plus size={16} strokeWidth={2} aria-hidden="true" />
          <span>New File</span>
        </button>
      </div>
      {files === null ? (
        <p className="files-explorer-status">Loading files...</p>
      ) : (
        groups.map((group) => (
          <div className="files-explorer-group" key={group.label}>
            <span className="files-explorer-group-label">{group.label}</span>
            {group.items.length === 0 && (
              <span className="files-explorer-status">No files</span>
            )}
            {group.items.map((file) => {
              const openTab = tabs.find((tab) => tab.fileId === file.id);
              return (
                <div
                  key={file.id}
                  className={
                    activeTab?.fileId === file.id
                      ? "files-explorer-item active"
                      : "files-explorer-item"
                  }
                >
                  <button
                    type="button"
                    className="files-explorer-open"
                    title={file.name}
                    onClick={() => openFile(file)}
                  >
                    <FileText size={14} strokeWidth={2} aria-hidden="true" />
                    <span>{file.name}</span>
                    {openTab && isDirty(openTab) && (
                      <span className="files-dirty-dot" aria-label="Unsaved" />
                    )}
                  </button>
                  <button
                    type="button"
                    className="files-icon-button files-explorer-delete"
                    onClick={() => void remove(file)}
                    aria-label={`Delete ${file.name}`}
                    title="Delete"
                    disabled={saving}
                  >
                    <Trash2 size={14} strokeWidth={2} aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}
