import { NavLink } from "react-router-dom";

type SidebarProps = {
  backTo?: string;
};

const navigation = [
  { label: "Home", to: "/home", end: true },
  { label: "Chat", to: "/chat", end: true },
  { label: "Create", to: "/create", end: true },
  { label: "Library", to: "/library", end: true },
  { label: "Pages", to: "/pages", end: true },
];

export function Sidebar({ backTo = "/home" }: SidebarProps) {
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
    </aside>
  );
}
