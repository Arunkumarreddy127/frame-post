import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { SidebarFilesLink } from "./SidebarFilesLink";
import { useFilesWorkspaceContext } from "./files/FilesWorkspaceProvider";

type PageSidebarProps = {
  pageId?: string;
  pageName?: string;
  pageProfileImageUrl?: string | null;
  pageNameLoading?: boolean;
  filesExplorer?: ReactNode;
};

const navigation = [
  { label: "Create", suffix: "create" },
  { label: "Library", suffix: "library" },
];

export function PageSidebar({
  pageId,
  pageName,
  pageProfileImageUrl,
  pageNameLoading,
  filesExplorer,
}: PageSidebarProps) {
  const { pageTabs } = useFilesWorkspaceContext();
  const pagePath = pageId ? `/pages/${pageId}` : "/pages";
  const displayName =
    pageName ?? (pageNameLoading ? "Loading page..." : "Page unavailable");
  const overviewTab = pageTabs.find(
    (tab) => tab.label === "Overview" && tab.pageId === pageId,
  );

  return (
    <aside className="app-sidebar">
      <Link to="/pages" className="sidebar-back" aria-label="Back to Pages">
        <ArrowLeft
          className="sidebar-back-icon"
          size={18}
          strokeWidth={1.8}
          aria-hidden="true"
        />
        <span>All pages</span>
      </Link>
      <section className="page-workspace-group" aria-label="Page workspace">
        <div className="page-workspace-card">
          <span className="page-workspace-label">Page workspace</span>
          <Link
            to={pagePath}
            className="page-workspace-identity"
            aria-label={`Open ${displayName} overview`}
          >
            {pageProfileImageUrl ? (
              <img
                className="page-workspace-avatar"
                src={pageProfileImageUrl}
                alt=""
              />
            ) : (
              <span className="page-workspace-avatar" aria-hidden="true">
                {pageName?.trim().charAt(0).toUpperCase() || "P"}
              </span>
            )}
            <span
              className="page-workspace-name"
              role={pageNameLoading ? "status" : undefined}
              title={pageName}
            >
              {displayName}
            </span>
          </Link>
        </div>
        <nav
          className="sidebar-nav page-workspace-nav"
          aria-label="Page navigation"
        >
          <NavLink
            to={overviewTab?.to ?? pagePath}
            end
            className={({ isActive }) =>
              isActive ? "sidebar-link active" : "sidebar-link"
            }
          >
            Overview
          </NavLink>
          <SidebarFilesLink to={`${pagePath}/files`} explorer={filesExplorer} />
          {navigation.map((item) => {
            const pageTab = pageTabs.find(
              (tab) => tab.label === item.label && tab.pageId === pageId,
            );
            return (
              <NavLink
                key={item.suffix}
                to={pageTab?.to ?? `${pagePath}/${item.suffix}`}
                className={({ isActive }) =>
                  isActive ? "sidebar-link active" : "sidebar-link"
                }
              >
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      </section>
    </aside>
  );
}
