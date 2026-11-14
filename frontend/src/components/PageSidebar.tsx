import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { SidebarFilesLink } from "./SidebarFilesLink";

type PageSidebarProps = {
  pageId?: string;
  pageName?: string;
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
  pageNameLoading,
  filesExplorer,
}: PageSidebarProps) {
  const pagePath = pageId ? `/pages/${pageId}` : "/pages";
  const displayName =
    pageName ?? (pageNameLoading ? "Loading page..." : "Page unavailable");

  return (
    <aside className="app-sidebar">
      <section className="page-workspace-card" aria-label="Page workspace">
        <span className="page-workspace-label">Page workspace</span>
        <Link
          to={pagePath}
          className="page-workspace-identity"
          aria-label={`Open ${displayName} overview`}
        >
          <span className="page-workspace-avatar" aria-hidden="true">
            {pageName?.trim().charAt(0).toUpperCase() || "P"}
          </span>
          <span
            className="page-workspace-name"
            role={pageNameLoading ? "status" : undefined}
            title={pageName}
          >
            {displayName}
          </span>
        </Link>
        <Link to="/pages" className="sidebar-back" aria-label="Back to Pages">
          <ArrowLeft
            className="sidebar-back-icon"
            size={18}
            strokeWidth={1.8}
            aria-hidden="true"
          />
          <span>All pages</span>
        </Link>
      </section>
      <nav className="sidebar-nav" aria-label="Page navigation">
        <NavLink
          to={pagePath}
          end
          className={({ isActive }) =>
            isActive ? "sidebar-link active" : "sidebar-link"
          }
        >
          Overview
        </NavLink>
        <SidebarFilesLink to={`${pagePath}/files`} explorer={filesExplorer} />
        {navigation.map((item) => (
          <NavLink
            key={item.suffix}
            to={`${pagePath}/${item.suffix}`}
            end
            className={({ isActive }) =>
              isActive ? "sidebar-link active" : "sidebar-link"
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
