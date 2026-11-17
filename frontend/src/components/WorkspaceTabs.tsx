import {
  FileText,
  FolderOpen,
  Home,
  Image,
  LayoutDashboard,
  LayoutGrid,
  Sparkles,
  X,
} from "lucide-react";
import { useMatch, useNavigate } from "react-router-dom";
import { useFilesWorkspaceContext } from "./files/FilesWorkspaceProvider";
import { isDirty } from "./files/useFilesWorkspace";

export function WorkspaceTabs() {
  const {
    workspace,
    filesPath,
    pageId,
    pageTabs,
    activePageTabKey,
    closePageTab,
    closeAllPageTabs,
  } = useFilesWorkspaceContext();
  const navigate = useNavigate();
  const isGlobalFilesPage = useMatch({ path: "/files", end: true }) !== null;
  const isPageFilesPage =
    useMatch({ path: "/pages/:pageId/files", end: true }) !== null;
  const isFilesPage = isGlobalFilesPage || isPageFilesPage;
  const currentPageTabs = pageTabs.filter((tab) => tab.pageId === pageId);

  if (workspace.tabs.length === 0 && currentPageTabs.length === 0) return null;

  return (
    <div
      className={`workspace-tabs${isFilesPage ? " files-workspace-tabs" : ""}`}
    >
      <div
        className="files-tabs workspace-tab-list"
        role="tablist"
        aria-label="Workspace tabs"
      >
        {workspace.tabs.map((tab) => {
          const active = isFilesPage && tab.key === workspace.activeTab?.key;
          const label = tab.draft.name || "untitled";
          return (
            <div
              key={tab.key}
              role="tab"
              aria-selected={active}
              className={active ? "files-tab active" : "files-tab"}
            >
              <button
                type="button"
                className="files-tab-label"
                title={label}
                onClick={() => {
                  workspace.setActiveKey(tab.key);
                  navigate(filesPath);
                }}
              >
                <FileText size={13} strokeWidth={2} aria-hidden="true" />
                <span>{label}</span>
              </button>
              {isDirty(tab) && (
                <span className="files-dirty-dot" aria-label="Unsaved" />
              )}
              <button
                type="button"
                className="files-icon-button files-tab-close"
                onClick={() => void workspace.closeTab(tab)}
                aria-label={`Close ${label}`}
              >
                <X size={13} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
          );
        })}
        {currentPageTabs.map((tab) => {
          const active =
            tab.key === activePageTabKey &&
            !(isFilesPage && workspace.activeTab && tab.label === "Files");
          const Icon =
            tab.kind === "creation"
              ? FolderOpen
              : tab.label === "Home"
                ? Home
                : tab.label === "Overview"
                  ? LayoutDashboard
                  : tab.label === "Pages"
                    ? LayoutGrid
                    : tab.label === "Create"
                      ? Sparkles
                      : tab.label === "Creations"
                        ? FolderOpen
                        : Image;
          return (
            <div
              key={tab.key}
              role="tab"
              aria-selected={active}
              className={active ? "files-tab active" : "files-tab"}
            >
              <button
                type="button"
                className="files-tab-label"
                onClick={() => {
                  if (tab.label === "Files") workspace.setActiveKey(null);
                  navigate(tab.to);
                }}
              >
                <Icon size={13} strokeWidth={2} aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
              <button
                type="button"
                className="files-icon-button files-tab-close"
                onClick={() => closePageTab(tab.key)}
                aria-label={`Close ${tab.label} tab`}
              >
                <X size={13} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        className="workspace-tabs-close-all"
        onClick={() => {
          void workspace.closeAllTabs().then((accepted) => {
            if (accepted) closeAllPageTabs();
          });
        }}
        disabled={workspace.saving}
        aria-label="Close all tabs"
        title="Close all tabs"
      >
        <X size={14} strokeWidth={2} aria-hidden="true" />
        <span>Close all</span>
      </button>
    </div>
  );
}
