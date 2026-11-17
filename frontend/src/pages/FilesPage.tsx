import { Check, FileText, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { FileEditorArea } from "../components/files/FileEditorArea";
import {
  isDirty,
  MAX_NAME_LENGTH,
  type Scope,
} from "../components/files/useFilesWorkspace";
import { useFilesWorkspaceContext } from "../components/files/FilesWorkspaceProvider";
import { formatDate } from "../format";
import type { InstructionFile, ShellRouteProps } from "../types";

type MetadataField = "name" | "scope";

export function FilesPage({ user, onLogout }: ShellRouteProps) {
  const { pageId } = useParams<{ pageId?: string }>();
  const { workspace } = useFilesWorkspaceContext();
  const [newFileOpen, setNewFileOpen] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [newFileScope, setNewFileScope] = useState<Scope>(
    pageId ? "page" : "user",
  );
  const [editingMetadata, setEditingMetadata] = useState<{
    fileId: string;
    field: MetadataField;
  } | null>(null);
  const [metadataValue, setMetadataValue] = useState("");

  function submitNewFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newFileName.trim();
    if (!name) return;
    workspace.newFile({ name, scope: newFileScope });
    setNewFileName("");
    setNewFileOpen(false);
  }

  function beginMetadataEdit(file: InstructionFile, field: MetadataField) {
    setEditingMetadata({ fileId: file.id, field });
    setMetadataValue(field === "name" ? file.name : file.scope);
  }

  function cancelMetadataEdit() {
    setEditingMetadata(null);
    setMetadataValue("");
  }

  async function saveMetadata(file: InstructionFile) {
    if (!editingMetadata || editingMetadata.fileId !== file.id) return;
    const saved = await workspace.saveFileMetadata(file, {
      name:
        editingMetadata.field === "name" ? metadataValue : file.name,
      scope:
        editingMetadata.field === "scope"
          ? (metadataValue as Scope)
          : file.scope,
    });
    if (saved) cancelMetadataEdit();
  }

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
          onClick={() => setNewFileOpen((open) => !open)}
          aria-expanded={newFileOpen}
        >
          <Plus size={16} aria-hidden="true" />
          New file
        </button>
      </header>
      {newFileOpen && (
        <form className="panel files-index-new-form" onSubmit={submitNewFile}>
          <label>
            Name
            <input
              value={newFileName}
              maxLength={MAX_NAME_LENGTH}
              onChange={(event) => setNewFileName(event.target.value)}
              required
              autoFocus
            />
          </label>
          {pageId && (
            <label>
              Scope
              <select
                value={newFileScope}
                onChange={(event) =>
                  setNewFileScope(event.target.value as Scope)
                }
              >
                <option value="user">Global</option>
                <option value="page">This page</option>
              </select>
            </label>
          )}
          <div className="files-index-new-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => setNewFileOpen(false)}
            >
              Cancel
            </button>
            <button className="primary-button" type="submit">
              Continue
            </button>
          </div>
        </form>
      )}
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
                    const editingName =
                      editingMetadata?.fileId === file.id &&
                      editingMetadata.field === "name";
                    const editingScope =
                      editingMetadata?.fileId === file.id &&
                      editingMetadata.field === "scope";
                    return (
                      <li
                        className="files-index-row"
                        key={file.id}
                        onClick={(event) => {
                          const target = event.target;
                          if (
                            target instanceof Element &&
                            target.closest("button, input, select")
                          ) {
                            return;
                          }
                          workspace.openFile(file);
                        }}
                      >
                        <div className="files-index-row-header">
                          <FileText
                            className="files-index-file-icon"
                            size={18}
                            aria-hidden="true"
                          />
                          <div className="files-index-details">
                            <div className="files-index-title-row">
                              {editingName ? (
                                <>
                                  <input
                                    className="files-index-inline-input"
                                    value={metadataValue}
                                    maxLength={MAX_NAME_LENGTH}
                                    onChange={(event) =>
                                      setMetadataValue(event.target.value)
                                    }
                                    onKeyDown={(event) => {
                                      if (event.key === "Enter") {
                                        event.preventDefault();
                                        void saveMetadata(file);
                                      }
                                      if (event.key === "Escape") {
                                        cancelMetadataEdit();
                                      }
                                    }}
                                    aria-label={`Name for ${file.name}`}
                                    autoFocus
                                  />
                                  <button
                                    type="button"
                                    className="files-inline-action"
                                    onClick={() => void saveMetadata(file)}
                                    aria-label="Save name"
                                    title="Save"
                                    disabled={
                                      workspace.saving ||
                                      !metadataValue.trim() ||
                                      metadataValue.trim() === file.name
                                    }
                                  >
                                    <Check size={15} aria-hidden="true" />
                                  </button>
                                  <button
                                    type="button"
                                    className="files-inline-action"
                                    onClick={cancelMetadataEdit}
                                    aria-label="Cancel name edit"
                                    title="Cancel"
                                  >
                                    <X size={15} aria-hidden="true" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    className="files-index-open"
                                    onClick={() => workspace.openFile(file)}
                                  >
                                    <strong>{file.name}</strong>
                                  </button>
                                  <button
                                    type="button"
                                    className="files-inline-action"
                                    onClick={() =>
                                      beginMetadataEdit(file, "name")
                                    }
                                    aria-label={`Edit name: ${file.name}`}
                                    title="Edit name"
                                    disabled={
                                      workspace.saving ||
                                      editingMetadata !== null
                                    }
                                  >
                                    <Pencil size={14} aria-hidden="true" />
                                  </button>
                                  {openTab && isDirty(openTab) && (
                                    <span
                                      className="files-dirty-dot"
                                      aria-label="Unsaved content changes"
                                    />
                                  )}
                                </>
                              )}
                            </div>
                            <div className="files-index-scope-row">
                              {!editingScope && (
                                <span>
                                  {file.scope === "page"
                                    ? "This page"
                                    : "Global"}
                                </span>
                              )}
                              {pageId &&
                                (editingScope ? (
                                  <>
                                    <select
                                      className="files-index-inline-input"
                                      value={metadataValue}
                                      onChange={(event) =>
                                        setMetadataValue(event.target.value)
                                      }
                                      aria-label={`Scope for ${file.name}`}
                                      autoFocus
                                    >
                                      <option value="user">Global</option>
                                      <option value="page">This page</option>
                                    </select>
                                    <button
                                      type="button"
                                      className="files-inline-action"
                                      onClick={() => void saveMetadata(file)}
                                      aria-label="Save scope"
                                      title="Save"
                                      disabled={
                                        workspace.saving ||
                                        metadataValue === file.scope
                                      }
                                    >
                                      <Check size={15} aria-hidden="true" />
                                    </button>
                                    <button
                                      type="button"
                                      className="files-inline-action"
                                      onClick={cancelMetadataEdit}
                                      aria-label="Cancel scope edit"
                                      title="Cancel"
                                    >
                                      <X size={15} aria-hidden="true" />
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    className="files-inline-action"
                                    onClick={() =>
                                      beginMetadataEdit(file, "scope")
                                    }
                                    aria-label={`Edit scope: ${
                                      file.scope === "page"
                                        ? "This page"
                                        : "Global"
                                    }`}
                                    title="Edit scope"
                                    disabled={
                                      workspace.saving ||
                                      editingMetadata !== null
                                    }
                                  >
                                    <Pencil size={14} aria-hidden="true" />
                                  </button>
                                ))}
                            </div>
                            <small className="files-index-updated">
                              Updated {formatDate(file.updatedAt)}
                            </small>
                          </div>
                          <button
                            type="button"
                            className="files-icon-button files-index-delete"
                            onClick={() => void workspace.remove(file)}
                            aria-label={`Delete ${file.name}`}
                            title="Delete file"
                            disabled={
                              workspace.saving ||
                              editingMetadata?.fileId === file.id
                            }
                          >
                            <Trash2 size={16} aria-hidden="true" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          ))}
          {workspace.tabs.some((tab) => !tab.fileId) && (
            <section className="files-index-group">
              <h2>Drafts</h2>
              <ul>
                {workspace.tabs
                  .filter((tab) => !tab.fileId)
                  .map((tab) => (
                    <li className="files-index-row" key={tab.key}>
                      <div className="files-index-metadata">
                        <label>
                          Name
                          <input
                            value={tab.draft.name}
                            maxLength={MAX_NAME_LENGTH}
                            onChange={(event) =>
                              workspace.updateDraft(tab.key, {
                                name: event.target.value,
                              })
                            }
                            aria-label="Name for new file"
                          />
                        </label>
                        {pageId && (
                          <label>
                            Scope
                            <select
                              value={tab.draft.scope}
                              onChange={(event) =>
                                workspace.updateDraft(tab.key, {
                                  scope: event.target.value as Scope,
                                })
                              }
                              aria-label="Scope for new file"
                            >
                              <option value="user">Global</option>
                              <option value="page">This page</option>
                            </select>
                          </label>
                        )}
                        <button
                          type="button"
                          className="secondary-button small-button"
                          onClick={() => {
                            workspace.setActiveKey(tab.key);
                          }}
                        >
                          Open draft
                        </button>
                      </div>
                    </li>
                  ))}
              </ul>
            </section>
          )}
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
