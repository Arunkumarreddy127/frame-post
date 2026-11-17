import { FileText, X } from "lucide-react";
import { CodeEditor } from "./CodeEditor";
import {
  isDirty,
  MAX_CONTENT_LENGTH,
  type FilesWorkspaceState,
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
            <div className="files-editor-file-details">
              <strong>{activeTab.draft.name || "untitled"}</strong>
              {pageId && (
                <small>
                  {activeTab.draft.scope === "page" ? "This page" : "Global"}
                </small>
              )}
            </div>
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
