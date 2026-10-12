import { useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import type { ShellRouteProps } from "../types";

type GptImageGenPageProps = ShellRouteProps & {
  pageId?: string;
};

export function GptImageGenPage({ user, onLogout, pageId }: GptImageGenPageProps) {
  const { pageId: routePageId } = useParams<{ pageId?: string }>();
  const activePageId = pageId ?? routePageId;

  return (
    <AppShell
      user={user}
      onLogout={onLogout}
      pageTitle="Image"
      sidebar={activePageId ? "page" : "global"}
      pageId={activePageId}
      backTo={activePageId ? `/pages/${activePageId}/create` : "/create"}
    >
      <section className="panel placeholder-panel">
        <p className="eyebrow">Framepost workspace</p>
        <h2>Image</h2>
        <p className="status">Generate images with GPT image models.</p>
      </section>
    </AppShell>
  );
}
