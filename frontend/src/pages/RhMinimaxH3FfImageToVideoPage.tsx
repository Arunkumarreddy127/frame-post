import { useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import type { ShellRouteProps } from "../types";

type RhMinimaxH3FfImageToVideoPageProps = ShellRouteProps & {
  pageId?: string;
};

export function RhMinimaxH3FfImageToVideoPage({
  user,
  onLogout,
  pageId,
}: RhMinimaxH3FfImageToVideoPageProps) {
  const { pageId: routePageId } = useParams<{ pageId?: string }>();
  const activePageId = pageId ?? routePageId;

  return (
    <AppShell
      user={user}
      onLogout={onLogout}
      pageTitle="Minimax H3 - FF Image to Video"
      sidebar={activePageId ? "page" : "global"}
      pageId={activePageId}
      backTo={activePageId ? `/pages/${activePageId}/create` : "/create"}
    >
      <section className="panel placeholder-panel">
        <p className="eyebrow">Framepost workspace</p>
        <h2>Minimax H3 - FF Image to Video</h2>
        <p className="status">Turn a still image into a video with Minimax H3 (FF).</p>
      </section>
    </AppShell>
  );
}
