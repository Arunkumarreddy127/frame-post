import { FormEvent, useEffect, useState } from "react";
import { FileText, Plus } from "lucide-react";
import {
  createInstructionFile,
  deleteInstructionFile,
  listInstructionFiles,
  updateInstructionFile,
} from "../instructionApi";
import type { InstructionFile } from "../types";

type InstructionFilesProps = {
  pageId?: string;
  selectedIds: string[];
  disabled?: boolean;
  refreshKey?: number;
  onSelectionChange: (ids: string[]) => void;
  onError: (message: string) => void;
};

type Editor = {
  id: string | null;
  name: string;
  content: string;
  scope: "user" | "page";
};

export function InstructionFiles({
  pageId,
  selectedIds,
  disabled = false,
  refreshKey = 0,
  onSelectionChange,
  onError,
}: InstructionFilesProps) {
  const [files, setFiles] = useState<InstructionFile[] | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    listInstructionFiles(pageId)
      .then((loaded) => {
        if (active) setFiles(loaded);
      })
      .catch((error) => {
        if (active) {
          onError(error instanceof Error ? error.message : "Unable to load instruction files");
        }
      });
    return () => {
      active = false;
    };
  }, [pageId, refreshKey]);

  useEffect(() => {
    if (!files) return;
    const known = new Set(files.map((file) => file.id));
    const pruned = selectedIds.filter((id) => known.has(id));
    if (pruned.length !== selectedIds.length) onSelectionChange(pruned);
  }, [files, selectedIds]);

  function toggle(id: string) {
    onSelectionChange(
      selectedIds.includes(id)
        ? selectedIds.filter((selectedId) => selectedId !== id)
        : [...selectedIds, id],
    );
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || saving) return;
    setSaving(true);
    onError("");
    try {
      const input = { name: editor.name, content: editor.content };
      if (editor.id) {
        const updated = await updateInstructionFile(editor.id, input);
        setFiles((current) =>
          (current ?? []).map((file) => (file.id === updated.id ? updated : file)),
        );
      } else {
        const created = await createInstructionFile(
          input,
          editor.scope === "page" ? pageId : undefined,
        );
        setFiles((current) => [...(current ?? []), created]);
      }
      setEditor(null);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Unable to save instruction file");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!editor?.id || saving) return;
    if (!window.confirm(`Delete "${editor.name}"?`)) return;
    const id = editor.id;
    setSaving(true);
    onError("");
    try {
      await deleteInstructionFile(id);
      setFiles((current) => (current ?? []).filter((file) => file.id !== id));
      if (selectedIds.includes(id)) {
        onSelectionChange(selectedIds.filter((selectedId) => selectedId !== id));
      }
      setEditor(null);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Unable to delete instruction file");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="instruction-files">
      <div className="instruction-file-list" role="group" aria-label="Instruction files">
        {(files ?? []).map((file) => (
          <span
            key={file.id}
            className={
              selectedIds.includes(file.id)
                ? "instruction-file selected"
                : "instruction-file"
            }
          >
            <label>
              <input
                type="checkbox"
                checked={selectedIds.includes(file.id)}
                disabled={disabled}
                onChange={() => toggle(file.id)}
              />
              <FileText size={14} strokeWidth={2} aria-hidden="true" />
              <span>{file.name}</span>
              <span className="instruction-file-scope">
                {file.scope === "page" ? "page" : "all"}
              </span>
            </label>
            <button
              type="button"
              className="instruction-file-edit"
              disabled={disabled}
              onClick={() =>
                setEditor({
                  id: file.id,
                  name: file.name,
                  content: file.content,
                  scope: file.scope,
                })
              }
            >
              Edit
            </button>
          </span>
        ))}
        <button
          type="button"
          className="secondary-button small-button"
          disabled={disabled || saving}
          onClick={() => setEditor({ id: null, name: "", content: "", scope: "user" })}
        >
          <Plus size={14} strokeWidth={2} aria-hidden="true" />
          <span>New instruction file</span>
        </button>
      </div>
      {editor && (
        <form className="instruction-editor" onSubmit={save}>
          <input
            value={editor.name}
            maxLength={100}
            placeholder="File name"
            aria-label="Instruction file name"
            required
            onChange={(event) => setEditor({ ...editor, name: event.target.value })}
          />
          <textarea
            value={editor.content}
            maxLength={20000}
            rows={6}
            placeholder="Instructions"
            aria-label="Instruction file content"
            required
            onChange={(event) => setEditor({ ...editor, content: event.target.value })}
          />
          <div className="instruction-editor-actions">
            {!editor.id && pageId && (
              <select
                value={editor.scope}
                aria-label="Instruction file scope"
                onChange={(event) =>
                  setEditor({ ...editor, scope: event.target.value as "user" | "page" })
                }
              >
                <option value="user">All chats</option>
                <option value="page">This page only</option>
              </select>
            )}
            <button className="secondary-button small-button" type="submit" disabled={saving}>
              Save
            </button>
            <button
              className="secondary-button small-button"
              type="button"
              disabled={saving}
              onClick={() => setEditor(null)}
            >
              Cancel
            </button>
            {editor.id && (
              <button
                className="secondary-button small-button danger-button"
                type="button"
                disabled={saving}
                onClick={() => void remove()}
              >
                Delete
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
