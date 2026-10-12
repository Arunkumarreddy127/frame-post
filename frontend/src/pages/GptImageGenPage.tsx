import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import type { ShellRouteProps } from "../types";

type GptImageGenPageProps = ShellRouteProps & {
  pageId?: string;
};

export function GptImageGenPage({ user, onLogout, pageId }: GptImageGenPageProps) {
  const { pageId: routePageId } = useParams<{ pageId?: string }>();
  const activePageId = pageId ?? routePageId;
  const createPath = activePageId ? `/pages/${activePageId}/create` : "/create";

  return (
    <AppShell
      user={user}
      onLogout={onLogout}
      pageTitle="Image"
      sidebar={activePageId ? "page" : "global"}
      pageId={activePageId}
      backTo={createPath}
    >
      <Link to={createPath} className="secondary-button">
        <ArrowLeft size={16} strokeWidth={1.8} aria-hidden="true" />
        Back to Create
      </Link>
      <section className="panel placeholder-panel">
        <p className="eyebrow">Framepost workspace</p>
        <h2>Image</h2>
        <p className="status">Generate images with GPT image models.</p>
      </section>
    </AppShell>
  );
}
