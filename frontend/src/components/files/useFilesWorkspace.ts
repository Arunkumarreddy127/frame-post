import { useEffect, useMemo, useState } from "react";
import {
  createInstructionFile,
  deleteInstructionFile,
  listInstructionFiles,
  notifyInstructionFilesChanged,
  onInstructionFilesChanged,
  updateInstructionFile,
} from "../../instructionApi";
import type { InstructionFile } from "../../types";
import type { Confirm } from "../ConfirmDialog";

export type Scope = "user" | "page";

export type Draft = { name: string; content: string; scope: Scope };

export type Tab = {
  key: string;
  fileId: string | null;
  saved: Draft | null;
  draft: Draft;
};

export const MAX_NAME_LENGTH = 100;
export const MAX_CONTENT_LENGTH = 30000;

function toDraft(file: InstructionFile): Draft {
  return { name: file.name, content: file.content, scope: file.scope };
}

function sameDraft(a: Draft, b: Draft) {
  return (
    a.name === b.name && a.content === b.content && a.scope === b.scope
  );
}

export function isDirty(tab: Tab) {
  return !tab.saved || !sameDraft(tab.draft, tab.saved);
}

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function useFilesWorkspace(pageId: string | undefined, confirm: Confirm) {
  const [files, setFiles] = useState<InstructionFile[] | null>(null);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [untitledCount, setUntitledCount] = useState(0);

  const activeTab = tabs.find((tab) => tab.key === activeKey);
  const anyDirty = tabs.some(isDirty);

  useEffect(() => {
    let active = true;
    setFiles(null);
    setTabs([]);
    setActiveKey(null);
    setError("");

    async function load() {
      try {
        const loaded = await listInstructionFiles(pageId);
        if (!active) return;
        setFiles(loaded);
        setTabs((current) =>
          current.flatMap((tab) => {
            if (!tab.fileId) return [tab];
            const file = loaded.find((item) => item.id === tab.fileId);
            if (!file) {
              return isDirty(tab) ? [{ ...tab, fileId: null, saved: null }] : [];
            }
            const saved = toDraft(file);
            const clean = tab.saved && sameDraft(tab.draft, tab.saved);
            return [{ ...tab, saved, draft: clean ? saved : tab.draft }];
          }),
        );
      } catch (requestError) {
        if (active) {
          setError(messageFrom(requestError, "Unable to load instruction files"));
        }
      }
    }

    void load();
    const unsubscribe = onInstructionFilesChanged(() => void load());
    return () => {
      active = false;
      unsubscribe();
    };
  }, [pageId]);

  useEffect(() => {
    if (!anyDirty) return;
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [anyDirty]);

  const groups = useMemo(
    () => [
      {
        label: "Global",
        items: (files ?? []).filter((file) => file.scope === "user"),
      },
      ...(pageId
        ? [
            {
              label: "This page",
              items: (files ?? []).filter((file) => file.scope === "page"),
            },
          ]
        : []),
    ],
    [files, pageId],
  );

  function openFile(file: InstructionFile) {
    setTabs((current) =>
      current.some((tab) => tab.fileId === file.id)
        ? current
        : [
            ...current,
            {
              key: file.id,
              fileId: file.id,
              saved: toDraft(file),
              draft: toDraft(file),
            },
          ],
    );
    setActiveKey(file.id);
  }

  function newFile() {
    const key = `untitled-${untitledCount + 1}`;
    setUntitledCount((count) => count + 1);
    setTabs((current) => [
      ...current,
      {
        key,
        fileId: null,
        saved: null,
        draft: { name: "", content: "", scope: pageId ? "page" : "user" },
      },
    ]);
    setActiveKey(key);
  }

  function updateDraft(key: string, changes: Partial<Draft>) {
    setTabs((current) =>
      current.map((tab) =>
        tab.key === key ? { ...tab, draft: { ...tab.draft, ...changes } } : tab,
      ),
    );
  }

  async function closeTab(tab: Tab) {
    if (isDirty(tab)) {
      const accepted = await confirm({
        title: "Discard unsaved changes?",
        message: `Changes to “${tab.draft.name || "untitled"}” will be lost.`,
        confirmLabel: "Discard changes",
        danger: true,
      });
      if (!accepted) return;
    }
    setTabs((current) => current.filter((item) => item.key !== tab.key));
    if (activeKey === tab.key) {
      setActiveKey(tabs.filter((item) => item.key !== tab.key).at(-1)?.key ?? null);
    }
  }

  async function closeAllTabs() {
    if (tabs.some(isDirty)) {
      const accepted = await confirm({
        title: "Close all files?",
        message: "Unsaved changes in open files will be discarded.",
        confirmLabel: "Close all",
        danger: true,
      });
      if (!accepted) return false;
    }
    setTabs([]);
    setActiveKey(null);
    return true;
  }

  async function save(tab: Tab) {
    if (saving) return;
    const name = tab.draft.name.trim();
    const { content, scope } = tab.draft;
    if (!name) {
      setError("Enter a file name before saving.");
      return;
    }
    if (!content.trim()) {
      setError("Instruction files can't be empty.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const file = tab.fileId
        ? await updateInstructionFile(tab.fileId, {
            name,
            content,
            scope,
            pageId: scope === "page" ? (pageId ?? null) : null,
          })
        : await createInstructionFile(
            { name, content },
            scope === "page" ? pageId : undefined,
          );
      const saved = toDraft(file);
      setFiles((current) => [
        ...(current ?? []).filter((item) => item.id !== file.id),
        file,
      ]);
      setTabs((current) =>
        current.map((item) =>
          item.key === tab.key
            ? {
                ...item,
                fileId: file.id,
                saved,
                draft: sameDraft(item.draft, { name, content, scope })
                  ? saved
                  : item.draft,
              }
            : item,
        ),
      );
      notifyInstructionFilesChanged();
    } catch (requestError) {
      setError(messageFrom(requestError, "Unable to save instruction file"));
    } finally {
      setSaving(false);
    }
  }

  async function remove(file: InstructionFile) {
    if (saving) return;
    const accepted = await confirm({
      title: `Delete “${file.name}”?`,
      message: "This instruction file will be permanently deleted. This cannot be undone.",
      confirmLabel: "Delete file",
      danger: true,
    });
    if (!accepted) return;
    setSaving(true);
    setError("");
    try {
      await deleteInstructionFile(file.id);
      setFiles((current) => (current ?? []).filter((item) => item.id !== file.id));
      const remaining = tabs.filter((tab) => tab.fileId !== file.id);
      setTabs((current) => current.filter((tab) => tab.fileId !== file.id));
      if (tabs.some((tab) => tab.fileId === file.id && tab.key === activeKey)) {
        setActiveKey(remaining.at(-1)?.key ?? null);
      }
      notifyInstructionFilesChanged();
    } catch (requestError) {
      setError(messageFrom(requestError, "Unable to delete instruction file"));
    } finally {
      setSaving(false);
    }
  }

  return {
    files,
    groups,
    tabs,
    activeTab,
    saving,
    error,
    openFile,
    newFile,
    updateDraft,
    closeTab,
    closeAllTabs,
    setActiveKey,
    save,
    remove,
  };
}

export type FilesWorkspaceState = ReturnType<typeof useFilesWorkspace>;
