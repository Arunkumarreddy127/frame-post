import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { LibraryMediaGrid } from "../components/library/LibraryMediaGrid";
import { deleteGeneration, getGeneration, saveFile } from "../generationApi";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";
import { useMediaPages } from "../hooks/useGenerationPages";
import type { MediaItem, ShellRouteProps } from "../types";

type LibraryPageProps = ShellRouteProps & {
  pageId?: string;
};

type Folder = "inputs" | "outputs";

const folders: { key: Folder; title: string; description: string }[] = [
  {
    key: "inputs",
    title: "Inputs",
    description: "Files you uploaded to generations",
  },
  { key: "outputs", title: "Outputs", description: "Files generated for you" },
];

export function LibraryPage({ user, onLogout, pageId }: LibraryPageProps) {
  const [folder, setFolder] = useState<Folder | null>(null);

  const title = folder
    ? (folders.find((f) => f.key === folder)?.title ?? "Library")
    : "Library";

  return (
    <AppShell
      user={user}
      onLogout={onLogout}
      pageTitle={title}
      sidebar={pageId ? "page" : "global"}
      pageId={pageId}
      backTo={folder ? undefined : pageId ? `/pages/${pageId}` : "/home"}
    >
      <section className="library-panel">
        {folder ? (
          <LibraryFolder
            key={folder}
            kind={folder}
            title={title}
            pageId={pageId}
            onBack={() => setFolder(null)}
          />
        ) : (
          <>
            <header className="library-heading">
              <div>
                <p className="eyebrow">Framepost workspace</p>
                <h2>Library</h2>
                <p>Your generated work and source files, together.</p>
              </div>
            </header>
            <div className="library-folders">
              {folders.map((entry) => (
                <button
                  key={entry.key}
                  type="button"
                  className="library-folder"
                  onClick={() => setFolder(entry.key)}
                >
                  <span className="library-folder-mark" aria-hidden="true">
                    {entry.key === "inputs" ? "IN" : "OUT"}
                  </span>
                  <span className="library-folder-title">{entry.title}</span>
                  <span className="library-folder-description">
                    {entry.description}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </section>
    </AppShell>
  );
}

function LibraryFolder({
  kind,
  title,
  pageId,
  onBack,
}: {
  kind: Folder;
  title: string;
  pageId?: string;
  onBack: () => void;
}) {
  const navigate = useNavigate();
  const { items, hasMore, loading, error, loadMore, removeWhere } =
    useMediaPages(kind, pageId);
  const [actionError, setActionError] = useState<string | null>(null);
  const sentinel = useInfiniteScroll<HTMLDivElement>(
    loadMore,
    hasMore && !loading,
  );

  async function download(item: MediaItem) {
    setActionError(null);
    try {
      await saveFile(item.key, item.name);
    } catch {
      setActionError("Unable to download this file");
    }
  }

  async function remove(item: MediaItem) {
    if (
      !window.confirm(
        "Delete the generation this file belongs to, including all of its files? This cannot be undone.",
      )
    )
      return;
    setActionError(null);
    try {
      await deleteGeneration(item.generationId);
      removeWhere((entry) => entry.generationId === item.generationId);
    } catch (caught) {
      setActionError(
        caught instanceof Error ? caught.message : "Unable to delete this file",
      );
    }
  }

  async function open(item: MediaItem) {
    setActionError(null);
    try {
      const generation = await getGeneration(item.generationId);
      const base = generation.pageId ? `/pages/${generation.pageId}` : "";
      navigate(
        generation.provider === "OPENAI"
          ? `${base}/create/gpt-image-gen`
          : `${base}/create/rh/${generation.workflowKey}`,
      );
    } catch (caught) {
      setActionError(
        caught instanceof Error ? caught.message : "Unable to open this file",
      );
    }
  }

  return (
    <>
      <header className="library-heading">
        <div>
          <button type="button" className="library-back" onClick={onBack}>
            <span aria-hidden="true">←</span> All files
          </button>
          <h2>{title}</h2>
        </div>
      </header>
      {(error || actionError) && (
        <p className="status error">{error || actionError}</p>
      )}
      {!error && !loading && items.length === 0 && (
        <p className="status">Nothing here yet.</p>
      )}
      <LibraryMediaGrid
        items={items}
        onDownload={download}
        onDelete={remove}
        onEdit={open}
      />
      {loading && <p className="status">Loading…</p>}
      {hasMore && <div ref={sentinel} style={{ height: 1 }} />}
    </>
  );
}
