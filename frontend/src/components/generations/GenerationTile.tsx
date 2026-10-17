import { Download, Maximize2, Pencil, Trash2 } from "lucide-react";
import type { MediaItem } from "../../types";

type GenerationTileProps = {
  item: MediaItem;
  alt: string;
  onFullView: (item: MediaItem, alt: string) => void;
  onDownload: (item: MediaItem) => void;
  onDelete: () => void;
  onEdit?: () => void;
};

/** One generated file with its hover actions. */
export function GenerationTile({
  item,
  alt,
  onFullView,
  onDownload,
  onDelete,
  onEdit,
}: GenerationTileProps) {
  return (
    <div className="image-gen-tile">
      {item.mediaType === "video" ? (
        <video src={item.url} controls preload="metadata" />
      ) : (
        <img
          src={item.url}
          alt={alt}
          loading="lazy"
          title="Double-click to view"
          onDoubleClick={() => onFullView(item, alt)}
        />
      )}
      <div className="image-gen-tile-actions">
        <button
          type="button"
          className="image-gen-icon-button"
          aria-label="View full size"
          title="Full view"
          onClick={() => onFullView(item, alt)}
        >
          <Maximize2 size={14} aria-hidden="true" />
        </button>
        {onEdit && (
          <button
            type="button"
            className="image-gen-icon-button"
            aria-label="Edit image"
            title="Edit"
            onClick={onEdit}
          >
            <Pencil size={14} aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          className="image-gen-icon-button"
          aria-label="Download"
          title="Download"
          onClick={() => onDownload(item)}
        >
          <Download size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="image-gen-icon-button"
          aria-label="Delete generation"
          title="Delete"
          onClick={onDelete}
        >
          <Trash2 size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
