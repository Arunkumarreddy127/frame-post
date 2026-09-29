import { NavLink } from "react-router-dom";

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
        {"<- Back to Pages"}
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
