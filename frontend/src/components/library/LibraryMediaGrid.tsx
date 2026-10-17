import type { MediaItem } from "../../types";

type LibraryMediaGridProps = {
  items: MediaItem[];
  onDownload: (item: MediaItem) => void;
  onDelete: (item: MediaItem) => void;
  onEdit: (item: MediaItem) => void;
};

/** Stored files shown as plain tiles, without the generation they came from. */
export function LibraryMediaGrid({
  items,
  onDownload,
  onDelete,
  onEdit,
}: LibraryMediaGridProps) {
  return (
    <div className="library-grid">
      {items.map((item) => (
        <figure className="library-card" key={item.id}>
          <div className="library-preview">
            {item.mediaType === "video" ? (
              <video src={item.url} controls preload="metadata" />
            ) : (
              <img src={item.url} alt={item.name} loading="lazy" />
            )}
          </div>
          <figcaption>
            <span className="library-name" title={item.name}>
              {item.name}
            </span>
            <button
              type="button"
              className="library-download"
              onClick={() => onDownload(item)}
            >
              <span aria-hidden="true">↓</span>
              Download
            </button>
            <button
              type="button"
              className="library-download"
              onClick={() => onEdit(item)}
            >
              Open in generator
            </button>
            <button
              type="button"
              className="library-download"
              onClick={() => onDelete(item)}
            >
              Delete
            </button>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
