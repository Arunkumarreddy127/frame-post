import {
  ChevronLeft,
  ChevronRight,
  FileText,
  FolderOpen,
  Home,
  Image,
  LayoutDashboard,
  LayoutGrid,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  const entries = [
    ...currentPageTabs.map((tab) => ({
      token: `page:${tab.key}`,
      kind: "page" as const,
      tab,
    })),
    ...workspace.tabs.map((tab) => ({
      token: `file:${tab.key}`,
      kind: "file" as const,
      tab,
    })),
  ];
  const availableTokens = entries.map((entry) => entry.token);
  const availableSignature = availableTokens.join("|");
  const activeToken =
    isFilesPage && workspace.activeTab
      ? `file:${workspace.activeTab.key}`
      : activePageTabKey
        ? `page:${activePageTabKey}`
        : undefined;
  const previousActiveToken = useRef(activeToken);
  const tabListRef = useRef<HTMLDivElement>(null);
  const [tabOrder, setTabOrder] = useState<string[]>([]);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const available = new Set(availableTokens);
    setTabOrder((current) => {
      const retained = current.filter((token) => available.has(token));
      const newTokens = availableTokens.filter(
        (token) => !retained.includes(token),
      );
      if (newTokens.length === 0) {
        return retained.length === current.length ? current : retained;
      }

      const anchorIndex = previousActiveToken.current
        ? retained.indexOf(previousActiveToken.current)
        : -1;
      const insertionIndex =
        anchorIndex >= 0 ? anchorIndex + 1 : retained.length;
      return [
        ...retained.slice(0, insertionIndex),
        ...newTokens,
        ...retained.slice(insertionIndex),
      ];
    });
    if (activeToken && available.has(activeToken)) {
      previousActiveToken.current = activeToken;
    }
  }, [availableSignature, activeToken]);

  useEffect(() => {
    const element = tabListRef.current;
    if (!element) return;

    function updateScrollButtons() {
      const current = tabListRef.current;
      if (!current) return;
      setCanScrollLeft(current.scrollLeft > 0);
      setCanScrollRight(
        current.scrollLeft + current.clientWidth < current.scrollWidth - 1,
      );
    }

    updateScrollButtons();
    element.addEventListener("scroll", updateScrollButtons, { passive: true });
    const observer = new ResizeObserver(updateScrollButtons);
    observer.observe(element);
    Array.from(element.children).forEach((child) => observer.observe(child));
    return () => {
      element.removeEventListener("scroll", updateScrollButtons);
      observer.disconnect();
    };
  }, [availableSignature]);

  if (entries.length === 0) return null;

  const entriesByToken = new Map(entries.map((entry) => [entry.token, entry]));
  const orderedTokens = [
    ...tabOrder.filter((token) => entriesByToken.has(token)),
    ...availableTokens.filter((token) => !tabOrder.includes(token)),
  ];

  return (
    <div
      className={`workspace-tabs${isFilesPage ? " files-workspace-tabs" : ""}`}
    >
      {(canScrollLeft || canScrollRight) && (
        <button
          type="button"
          className="workspace-tabs-scroll"
          onClick={() =>
            tabListRef.current?.scrollBy({ left: -240, behavior: "smooth" })
          }
          disabled={!canScrollLeft}
          aria-label="Scroll tabs left"
          title="Scroll tabs left"
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
      )}
      <div
        ref={tabListRef}
        className="files-tabs workspace-tab-list"
        role="tablist"
        aria-label="Workspace tabs"
      >
        {orderedTokens.map((token) => {
          const entry = entriesByToken.get(token);
          if (!entry) return null;
          if (entry.kind === "file") {
            const { tab } = entry;
            const active =
              isFilesPage && tab.key === workspace.activeTab?.key;
            const label = tab.draft.name || "untitled";
            return (
              <div
                key={entry.token}
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
          }

          const { tab } = entry;
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
              key={entry.token}
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
      {(canScrollLeft || canScrollRight) && (
        <button
          type="button"
          className="workspace-tabs-scroll"
          onClick={() =>
            tabListRef.current?.scrollBy({ left: 240, behavior: "smooth" })
          }
          disabled={!canScrollRight}
          aria-label="Scroll tabs right"
          title="Scroll tabs right"
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      )}
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
