import { AppShell } from "./AppShell";
import type { ShellRouteProps } from "../types";

type PlaceholderPageProps = ShellRouteProps & {
  title: string;
  description: string;
  sidebar?: "global" | "page";
  pageId?: string;
  backTo?: string;
};

export function PlaceholderPage({
  user,
  onLogout,
  title,
  description,
  sidebar = "global",
  pageId,
  backTo,
}: PlaceholderPageProps) {
  return (
    <AppShell
      user={user}
      onLogout={onLogout}
      pageTitle={title}
      sidebar={sidebar}
      pageId={pageId}
      backTo={backTo}
    >
      <section className="panel placeholder-panel">
        <p className="eyebrow">Framepost workspace</p>
        <h2 className="app-page-title">{title}</h2>
        <p className="status app-page-description">{description}</p>
      </section>
    </AppShell>
  );
}
