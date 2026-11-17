import {
  FileText,
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
      className={`files-tabs workspace-tabs${isFilesPage ? " files-workspace-tabs" : ""}`}
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
        const active = tab.key === activePageTabKey;
        const Icon =
          tab.label === "Home"
            ? Home
            : tab.label === "Overview"
              ? LayoutDashboard
              : tab.label === "Pages"
                ? LayoutGrid
              : tab.label === "Create"
                ? Sparkles
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
              onClick={() => navigate(tab.to)}
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
  );
}
