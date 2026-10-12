import { useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import type { ShellRouteProps } from "../types";

type CreatePageProps = ShellRouteProps & {
  pageId?: string;
};

export function CreatePage({ user, onLogout, pageId }: CreatePageProps) {
  const { pageId: routePageId } = useParams<{ pageId?: string }>();
  const activePageId = pageId ?? routePageId;

  return (
    <AppShell
      user={user}
      onLogout={onLogout}
      pageTitle="Create"
      sidebar={activePageId ? "page" : "global"}
      pageId={activePageId}
      backTo={activePageId ? "/pages" : "/home"}
    >
      <div className="create-sections">
        <section className="panel create-section">
          <h3>Copilot</h3>
        </section>
        <section className="panel create-section">
          <h3>RH</h3>
        </section>
      </div>
    </AppShell>
  );
}
