import { useEffect, useState } from "react";
import { AppShell } from "../components/AppShell";
import {
  fetchLibrary,
  type LibraryItem,
  type LibraryResponse,
} from "../libraryApi";
import { API_BASE_URL } from "../api";
import type { ShellRouteProps } from "../types";

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

  const title = folder
    ? (folders.find((f) => f.key === folder)?.title ?? "Library")
    : "Library";
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
      <section className="library-panel">
        {folder ? (
          <>
            <header className="library-heading">
              <div>
                <button
                  type="button"
                  className="library-back"
                  onClick={() => setFolder(null)}
                >
                  <span aria-hidden="true">←</span> All files
                </button>
                <h2>{title}</h2>
                <p>
                  {items.length} {items.length === 1 ? "file" : "files"}
                </p>
              </div>
            </header>
            {error && <p className="status error">{error}</p>}
            {!error && !library && <p className="status">Loading…</p>}
            {library && items.length === 0 && (
              <p className="status">Nothing here yet.</p>
            )}
            <div className="library-grid">
              {items.map((item) => (
                <LibraryCard
                  key={`${item.generationId}-${item.key}`}
                  item={item}
                />
              ))}
            </div>
          </>
        ) : (
          <>
            <header className="library-heading">
              <div>
                <p className="eyebrow">Framepost workspace</p>
                <h2>Library</h2>
                <p>Your generated work and source files, together.</p>
              </div>
              {library && (
                <span className="library-total">
                  {library.inputs.length + library.outputs.length} files
                </span>
              )}
            </header>
            {error && <p className="status error">{error}</p>}
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
                  <span className="library-folder-count">
                    {library
                      ? `${library[entry.key].length} files`
                      : "Loading…"}
                  </span>
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

function LibraryCard({ item }: { item: LibraryItem }) {
  const [downloadError, setDownloadError] = useState<string | null>(null);

  async function downloadItem() {
    setDownloadError(null);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/images/download?key=${encodeURIComponent(item.key)}`,
        { credentials: "include" },
      );
      if (!response.ok) throw new Error("Download failed");
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = item.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setDownloadError("Unable to download this file");
    }
  }

  return (
    <figure className="library-card">
      <div className="library-preview">
        {item.contentType.startsWith("image/") && (
          <img src={item.url} alt={item.name} loading="lazy" />
        )}
        {item.contentType.startsWith("video/") && (
          <video src={item.url} controls preload="metadata" />
        )}
        {!item.contentType.startsWith("image/") &&
          !item.contentType.startsWith("video/") && (
            <span className="library-file">{item.name}</span>
          )}
      </div>
      <figcaption>
        <span className="library-name" title={item.name}>
          {item.name}
        </span>
        <button
          type="button"
          className="library-download"
          onClick={downloadItem}
        >
          <span aria-hidden="true">↓</span>
          Download
        </button>
        {downloadError && <span className="status error">{downloadError}</span>}
      </figcaption>
    </figure>
  );
}
