import { useEffect, useRef, useState } from "react";
import { FileText } from "lucide-react";
import {
  listInstructionFiles,
  onInstructionFilesChanged,
} from "../instructionApi";
import type { InstructionFile } from "../types";

type ChatInstructionPickerProps = {
  pageId?: string;
  selectedIds: string[];
  disabled?: boolean;
  onSelectionChange: (ids: string[]) => void;
  onFilesChange: (files: InstructionFile[]) => void;
  onError: (message: string) => void;
};

export function ChatInstructionPicker({
  pageId,
  selectedIds,
  disabled = false,
  onSelectionChange,
  onFilesChange,
  onError,
}: ChatInstructionPickerProps) {
  const [files, setFiles] = useState<InstructionFile[] | null>(null);
  const [open, setOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const root = useRef<HTMLDivElement>(null);

  useEffect(
    () => onInstructionFilesChanged(() => setRefreshKey((key) => key + 1)),
    [],
  );

  useEffect(() => {
    let active = true;
    listInstructionFiles(pageId)
      .then((loaded) => {
        if (active) {
          setFiles(loaded);
          onFilesChange(loaded);
        }
      })
      .catch((error) => {
        if (active) {
          onError(
            error instanceof Error
              ? error.message
              : "Unable to load instruction files",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [onFilesChange, onError, pageId, refreshKey]);

  // Drop selections that point at files that no longer exist.
  useEffect(() => {
    if (!files) return;
    const known = new Set(files.map((file) => file.id));
    const pruned = selectedIds.filter((id) => known.has(id));
    if (pruned.length !== selectedIds.length) onSelectionChange(pruned);
  }, [files, selectedIds]);

  useEffect(() => {
    if (!open) return;
    function close(event: MouseEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent) {
        if (event.key === "Escape") setOpen(false);
      } else if (!root.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  function toggle(id: string) {
    onSelectionChange(
      selectedIds.includes(id)
        ? selectedIds.filter((selectedId) => selectedId !== id)
        : [...selectedIds, id],
    );
  }

  const globalFiles = (files ?? []).filter((file) => file.scope === "user");
  const pageFiles = (files ?? []).filter((file) => file.scope === "page");

  return (
    <div className="chat-instruction-picker" ref={root}>
      <button
        type="button"
        className="chat-attachment-button"
        aria-label="Instruction files"
        aria-expanded={open}
        title="Instruction files"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <FileText size={17} aria-hidden="true" />
      </button>
      {selectedIds.length > 0 && (
        <span className="chat-attachment-count">{selectedIds.length}</span>
      )}
      {open && (
        <div className="chat-instruction-popover" role="group">
          <span className="sidebar-section-label">Instruction files</span>
          {files && files.length === 0 && (
            <p className="chat-history-status">
              No files yet. Create them from Files.
            </p>
          )}
          {[
            { label: "Global", items: globalFiles },
            { label: "This page", items: pageFiles },
          ]
            .filter((group) => group.items.length > 0)
            .map((group) => (
              <div key={group.label} className="chat-instruction-group">
                <span className="chat-instruction-group-label">
                  {group.label}
                </span>
                {group.items.map((file) => (
                  <label key={file.id} className="chat-instruction-option">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(file.id)}
                      onChange={() => toggle(file.id)}
                    />
                    <span>{file.name}</span>
                  </label>
                ))}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
