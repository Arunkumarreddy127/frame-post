import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useMatch } from "react-router-dom";
import { ChevronRight } from "lucide-react";

const FILES_EXPLORER_OPEN_KEY = "framepost.filesExplorerOpen";

type SidebarFilesLinkProps = {
  to: string;
  explorer?: ReactNode;
};

export function SidebarFilesLink({ to, explorer }: SidebarFilesLinkProps) {
  const [expanded, setExpanded] = useState(
    () => window.localStorage.getItem(FILES_EXPLORER_OPEN_KEY) !== "false",
  );
  const onFilesRoute = useMatch({ path: to, end: true }) !== null;
  const open = expanded && explorer !== undefined;

  useEffect(() => {
    window.localStorage.setItem(FILES_EXPLORER_OPEN_KEY, String(expanded));
  }, [expanded]);

  return (
    <>
      <NavLink
        to={to}
        end
        aria-expanded={open}
        className={({ isActive }) =>
          isActive ? "sidebar-link active" : "sidebar-link"
        }
        onClick={(event) => {
          if (onFilesRoute) {
            event.preventDefault();
            setExpanded((current) => !current);
          }
        }}
      >
        <span>Files</span>
        <ChevronRight
          className={`sidebar-link-chevron${open ? " open" : ""}`}
          size={16}
          strokeWidth={2}
          aria-hidden="true"
        />
      </NavLink>
      {open && <div className="sidebar-files-explorer">{explorer}</div>}
    </>
  );
}
