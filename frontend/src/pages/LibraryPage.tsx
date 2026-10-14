import { useEffect, useState } from "react";
import { AppShell } from "../components/AppShell";
import { fetchLibrary, type LibraryItem, type LibraryResponse } from "../libraryApi";
import type { ShellRouteProps } from "../types";

type LibraryPageProps = ShellRouteProps & {
  pageId?: string;
};

type Folder = "inputs" | "outputs";

const folders: { key: Folder; title: string; description: string }[] = [
  { key: "inputs", title: "Inputs", description: "Files you uploaded to generations" },
  { key: "outputs", title: "Outputs", description: "Files generated for you" },
];

export function LibraryPage({ user, onLogout, pageId }: LibraryPageProps) {
  const [library, setLibrary] = useState<LibraryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [folder, setFolder] = useState<Folder | null>(null);

  useEffect(() => {
    let active = true;
    setLibrary(null);
    setError(null);
    fetchLibrary(pageId)
      .then((data) => {
        if (active) setLibrary(data);
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      });
    return () => {
      active = false;
    };
  }, [pageId]);

  const title = folder ? folders.find((f) => f.key === folder)?.title ?? "Library" : "Library";
  const items = library && folder ? library[folder] : [];

  return (
    <AppShell
      user={user}
      onLogout={onLogout}
      pageTitle={title}
      sidebar={pageId ? "page" : "global"}
      pageId={pageId}
      backTo={folder ? undefined : pageId ? `/pages/${pageId}` : "/home"}
    >
      <section className="panel library-panel">
        {folder ? (
          <>
            <button type="button" className="library-back" onClick={() => setFolder(null)}>
              Back to folders
            </button>
            <h2>{title}</h2>
            {error && <p className="status error">{error}</p>}
            {!error && !library && <p className="status">Loading…</p>}
            {library && items.length === 0 && <p className="status">Nothing here yet.</p>}
            <div className="library-grid">
              {items.map((item) => (
                <LibraryCard key={`${item.generationId}-${item.key}`} item={item} />
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="eyebrow">Framepost workspace</p>
            <h2>Library</h2>
            {error && <p className="status error">{error}</p>}
            <div className="library-folders">
              {folders.map((entry) => (
                <button
                  key={entry.key}
                  type="button"
                  className="library-folder"
                  onClick={() => setFolder(entry.key)}
                >
                  <span className="library-folder-title">{entry.title}</span>
                  <span className="library-folder-count">
                    {library ? `${library[entry.key].length} files` : "Loading…"}
                  </span>
                  <span className="library-folder-description">{entry.description}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </section>
    </AppShell>
  );
}

function LibraryCard({ item }: { item: LibraryItem }) {
  return (
    <figure className="library-card">
      <div className="library-preview">
        {item.contentType.startsWith("image/") && <img src={item.url} alt={item.name} loading="lazy" />}
        {item.contentType.startsWith("video/") && <video src={item.url} controls preload="metadata" />}
        {!item.contentType.startsWith("image/") && !item.contentType.startsWith("video/") && (
          <span className="library-file">{item.name}</span>
        )}
      </div>
      <figcaption>
        <span className="library-name" title={item.name}>{item.name}</span>
        <a href={item.url} download={item.name} target="_blank" rel="noreferrer">
          Download
        </a>
      </figcaption>
    </figure>
  );
}
