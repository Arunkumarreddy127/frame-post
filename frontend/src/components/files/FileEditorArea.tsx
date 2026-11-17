import { FileText, X } from "lucide-react";
import { CodeEditor } from "./CodeEditor";
import {
  isDirty,
  MAX_CONTENT_LENGTH,
  MAX_NAME_LENGTH,
  type FilesWorkspaceState,
  type Scope,
} from "./useFilesWorkspace";

type FileEditorAreaProps = {
  pageId?: string;
  workspace: FilesWorkspaceState;
};

export function FileEditorArea({ pageId, workspace }: FileEditorAreaProps) {
  const {
    activeTab,
    saving,
    error,
    updateDraft,
    save,
  } = workspace;

  return (
    <div className="files-editor-area">
      {activeTab ? (
        <>
          <div className="files-editor-toolbar">
            <input
              className="files-name-input"
              value={activeTab.draft.name}
              maxLength={MAX_NAME_LENGTH}
              placeholder="File name"
              aria-label="Instruction file name"
              onChange={(event) =>
                updateDraft(activeTab.key, { name: event.target.value })
              }
              onKeyDown={(event) => {
                if (
                  (event.metaKey || event.ctrlKey) &&
                  event.key.toLowerCase() === "s"
                ) {
                  event.preventDefault();
                  void save(activeTab);
                }
              }}
            />
            {pageId && (
              <select
                value={activeTab.draft.scope}
                aria-label="Instruction file scope"
                onChange={(event) =>
                  updateDraft(activeTab.key, {
                    scope: event.target.value as Scope,
                  })
                }
              >
                <option value="user">Global</option>
                <option value="page">This page</option>
              </select>
            )}
            <button
              type="button"
              className="secondary-button small-button"
              disabled={saving || !isDirty(activeTab)}
              onClick={() => void save(activeTab)}
            >
              Save
            </button>
          </div>
          <CodeEditor
            key={activeTab.key}
            value={activeTab.draft.content}
            maxLength={MAX_CONTENT_LENGTH}
            ariaLabel="Instruction file content"
            onChange={(content) => updateDraft(activeTab.key, { content })}
            onSave={() => void save(activeTab)}
          />
        </>
      ) : (
        <div className="files-empty-state">
          <FileText size={32} strokeWidth={1.5} aria-hidden="true" />
          <p>Select a file from the explorer, or create a new one.</p>
        </div>
      )}
      {error && (
        <p className="files-status-bar error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
