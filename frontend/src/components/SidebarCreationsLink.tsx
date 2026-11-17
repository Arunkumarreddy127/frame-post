import { useEffect, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { NavLink, useMatch } from "react-router-dom";

const CREATIONS_EXPLORER_OPEN_KEY = "framepost.creationsExplorerOpen";

type SidebarCreationsLinkProps = {
  to: string;
  explorer?: ReactNode;
};

export function SidebarCreationsLink({
  to,
  explorer,
}: SidebarCreationsLinkProps) {
  const [expanded, setExpanded] = useState(
    () => window.localStorage.getItem(CREATIONS_EXPLORER_OPEN_KEY) !== "false",
  );
  const onCreationsList = useMatch({ path: to, end: true }) !== null;
  const open = expanded && explorer !== undefined;

  useEffect(() => {
    window.localStorage.setItem(CREATIONS_EXPLORER_OPEN_KEY, String(expanded));
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
          if (onCreationsList) {
            event.preventDefault();
            setExpanded((current) => !current);
          }
        }}
      >
        <span>Creations</span>
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
