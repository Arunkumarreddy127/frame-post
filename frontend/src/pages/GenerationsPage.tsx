import { Link, useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { GenerationFeed } from "../components/generations/GenerationFeed";
import { useGenerationPages } from "../hooks/useGenerationPages";
import type { ShellRouteProps } from "../types";

type GenerationsPageProps = ShellRouteProps & {
  pageId?: string;
};

/** Every generation in the workspace or on one page, whatever its provider. */
export function GenerationsPage({
  user,
  onLogout,
  pageId,
}: GenerationsPageProps) {
  const { pageId: routePageId } = useParams<{ pageId?: string }>();
  const activePageId = pageId ?? routePageId;
  const createPath = activePageId ? `/pages/${activePageId}/create` : "/create";
  const { items, hasMore, loading, error, loadMore, update, removeWhere } =
    useGenerationPages({ pageId: activePageId });

  return (
    <AppShell
      user={user}
      onLogout={onLogout}
      pageTitle="All Generations"
      sidebar={activePageId ? "page" : "global"}
      pageId={activePageId}
      backTo={createPath}
    >
      <header className="app-page-header">
        <div>
          <p className="eyebrow">Generations</p>
          <h1 className="app-page-title">All generations</h1>
          <p className="app-page-description">
            Browse past generations and manage their inputs and outputs.
          </p>
        </div>
        <Link to={createPath} className="secondary-button">
          ← Back to Create
        </Link>
      </header>
      <GenerationFeed
        items={items}
        hasMore={hasMore}
        loading={loading}
        loadError={error}
        emptyMessage="No generations yet. Create one to get started!"
        onLoadMore={loadMore}
        onUpdate={update}
        onDeleted={(generation) =>
          removeWhere((item) => item.id === generation.id)
        }
      />
    </AppShell>
  );
}
