import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { API_BASE_URL } from "../api";

type SidebarProps = {
  backTo?: string;
};

type SidebarPage = {
  id: string;
  name: string;
};

const navigation = [
  { label: "Home", to: "/home", end: true },
  { label: "Chat", to: "/chat", end: true },
  { label: "Create", to: "/create", end: true },
  { label: "Library", to: "/library", end: true },
];

export function Sidebar({ backTo = "/home" }: SidebarProps) {
  const [pages, setPages] = useState<SidebarPage[]>([]);

  useEffect(() => {
    async function loadPages() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/pages`, {
          credentials: "include",
        });
        if (!response.ok) return;
        setPages(await response.json());
      } catch {
        setPages([]);
      }
    }

    void loadPages();
  }, []);

  return (
    <aside className="app-sidebar">
      <nav className="sidebar-nav" aria-label="Main navigation">
        {navigation.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              isActive ? "sidebar-link active" : "sidebar-link"
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-section">
        <span className="sidebar-section-label">Pages</span>
        {pages.map((page) => (
          <NavLink
            key={page.id}
            to={`/pages/${page.id}`}
            className={({ isActive }) =>
              isActive ? "sidebar-page-link active" : "sidebar-page-link"
            }
          >
            {page.name}
          </NavLink>
        ))}
        <NavLink to="/pages/new" className="sidebar-page-link">
          + New Page
        </NavLink>
      </div>
    </aside>
  );
}
