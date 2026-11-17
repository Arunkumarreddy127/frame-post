import { Fragment, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { SidebarFilesLink } from "./SidebarFilesLink";
import { useFilesWorkspaceContext } from "./files/FilesWorkspaceProvider";

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
  const { pageTabs } = useFilesWorkspaceContext();

  return (
    <aside className="app-sidebar">
      <nav className="sidebar-nav" aria-label="Main navigation">
        {navigation.map((item) => {
          const pageTab = pageTabs.find(
            (tab) => tab.label === item.label && tab.pageId === undefined,
          );
          return (
            <Fragment key={item.to}>
            <NavLink
              to={pageTab?.to ?? item.to}
              end={item.label === "Home" || item.label === "Pages"}
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
          );
        })}
      </nav>
    </aside>
  );
}
