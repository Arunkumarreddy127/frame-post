import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

export type CreationBreadcrumbItem = {
  label: string;
  to?: string;
  onSelect?: () => void;
  current?: boolean;
};

export function CreationBreadcrumbs({
  items,
}: {
  items: CreationBreadcrumbItem[];
}) {
  return (
    <nav className="creation-breadcrumb" aria-label="Breadcrumb">
      <ol>
        {items.map((item, index) => {
          const current = item.current ?? index === items.length - 1;
          return (
            <li
              key={`${index}-${item.label}`}
              aria-current={current ? "page" : undefined}
            >
              {index > 0 && <ChevronRight size={14} aria-hidden="true" />}
              {current ? (
                <span>{item.label}</span>
              ) : item.to ? (
                <Link to={item.to}>{item.label}</Link>
              ) : item.onSelect ? (
                <button type="button" onClick={item.onSelect}>
                  {item.label}
                </button>
              ) : (
                <span>{item.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
