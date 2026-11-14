import type { MediaItem } from "../../types";
import { MediaTile, mediaLineageLabel } from "../media/MediaTile";

type LibraryMediaGridProps = {
  items: MediaItem[];
  onOpen: (item: MediaItem) => void;
  onDownload: (item: MediaItem) => void;
  onDelete: (item: MediaItem) => void;
  onEdit: (item: MediaItem) => void;
};

/** Stored files shown as plain tiles, without the generation they came from. */
export function LibraryMediaGrid({
  items,
  onOpen,
  onDownload,
  onDelete,
  onEdit,
}: LibraryMediaGridProps) {
  return (
    <div className="library-grid">
      {items.map((item) => (
        <article className="library-card" key={item.id}>
          <MediaTile
            item={item}
            alt={item.name}
            className="library-media-tile"
            lineageLabel={mediaLineageLabel(item)}
            onOpen={() => onOpen(item)}
            onDownload={() => onDownload(item)}
            onEdit={() => onEdit(item)}
            onDelete={() => onDelete(item)}
          />
          <div className="library-card-caption">
            <span className="library-name" title={item.name}>{item.name}</span>
            <span className="library-kind">
              {item.slot ? "Input" : "Output"} · {item.mediaType}
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}
