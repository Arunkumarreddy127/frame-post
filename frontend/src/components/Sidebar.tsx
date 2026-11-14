import { Fragment, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { SidebarFilesLink } from "./SidebarFilesLink";

type SidebarProps = {
  backTo?: string;
  filesExplorer?: ReactNode;
};

const navigation = [
  { label: "Home", to: "/home", end: true },
  { label: "Create", to: "/create", end: true },
  { label: "Library", to: "/library", end: true },
  { label: "Pages", to: "/pages", end: true },
];

export function Sidebar({ backTo = "/home", filesExplorer }: SidebarProps) {
  return (
    <aside className="app-sidebar">
      <nav className="sidebar-nav" aria-label="Main navigation">
        {navigation.map((item) => (
          <Fragment key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                isActive ? "sidebar-link active" : "sidebar-link"
              }
            >
              {item.label}
            </NavLink>
            {item.to === "/home" && (
              <SidebarFilesLink to="/files" explorer={filesExplorer} />
            )}
          </Fragment>
        ))}
      </nav>
    </aside>
  );
}
