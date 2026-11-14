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
    tabs,
    activeTab,
    saving,
    error,
    setActiveKey,
    updateDraft,
    closeTab,
    save,
  } = workspace;

  return (
    <div className="files-editor-area">
      <div className="files-tabs" role="tablist">
        {tabs.map((tab) => (
          <div
            key={tab.key}
            role="tab"
            aria-selected={tab.key === activeTab?.key}
            className={
              tab.key === activeTab?.key ? "files-tab active" : "files-tab"
            }
          >
            <button
              type="button"
              className="files-tab-label"
              onClick={() => setActiveKey(tab.key)}
            >
              <FileText size={13} strokeWidth={2} aria-hidden="true" />
              <span>{tab.draft.name || "untitled"}</span>
            </button>
            {isDirty(tab) && (
              <span className="files-dirty-dot" aria-label="Unsaved" />
            )}
            <button
              type="button"
              className="files-icon-button files-tab-close"
              onClick={() => closeTab(tab)}
              aria-label={`Close ${tab.draft.name || "untitled"}`}
            >
              <X size={13} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
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
