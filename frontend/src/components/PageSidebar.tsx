import { NavLink } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

type PageSidebarProps = {
  pageId?: string;
  backTo?: string;
};

const navigation = [
  { label: "Chat", suffix: "chat" },
  { label: "Create", suffix: "create" },
  { label: "Library", suffix: "library" },
];

export function PageSidebar({ pageId, backTo = "/pages" }: PageSidebarProps) {
  const pagePath = pageId ? `/pages/${pageId}` : "/pages";

  return (
    <aside className="app-sidebar">
      <NavLink to={backTo} className="sidebar-back" aria-label="Back to Pages">
        <ArrowLeft className="sidebar-back-icon" size={18} strokeWidth={1.8} aria-hidden="true" />
        <span>Back to Pages</span>
      </NavLink>
      <nav className="sidebar-nav" aria-label="Main navigation">
        <NavLink
          to={pagePath}
          end
          className={({ isActive }) =>
            isActive ? "sidebar-link active" : "sidebar-link"
          }
        >
          Overview
        </NavLink>
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
