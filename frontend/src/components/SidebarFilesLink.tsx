import { useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { ChevronRight } from "lucide-react";

type SidebarFilesLinkProps = {
  to: string;
  explorer?: ReactNode;
};

export function SidebarFilesLink({ to, explorer }: SidebarFilesLinkProps) {
  const [expanded, setExpanded] = useState(true);
  const onFilesRoute = explorer !== undefined;
  const open = onFilesRoute && expanded;

  return (
    <>
      <NavLink
        to={to}
        end
        aria-expanded={onFilesRoute ? open : false}
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
