import {
  Check,
  Download,
  Maximize2,
  Pencil,
  Play,
  Trash2,
} from "lucide-react";
import type { MediaItem } from "../../types";

export function mediaLineageLabel(item: MediaItem) {
  if (item.slot !== null) return undefined;
  if (item.parentGenerationId) return "Derived";
  if (item.sourceCount > 0) {
    return `${item.sourceCount} source${item.sourceCount === 1 ? "" : "s"}`;
  }
  return undefined;
}

type MediaTileProps = {
  item: MediaItem;
  alt: string;
  onOpen: () => void;
  onDownload?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  onSelect?: () => void;
  selected?: boolean;
  lineageLabel?: string;
  className?: string;
};

/** Shared media preview and action surface for Library, Create, and the picker. */
export function MediaTile({
  item,
  alt,
  onOpen,
  onDownload,
  onDelete,
  onEdit,
  onSelect,
  selected = false,
  lineageLabel,
  className = "",
}: MediaTileProps) {
  return (
    <div
      className={`media-tile${selected ? " selected" : ""}${className ? ` ${className}` : ""}`}
    >
      <button
        type="button"
        className="media-tile-preview"
        aria-label={`View ${item.mediaType}: ${item.name}`}
        onClick={onOpen}
      >
        {item.mediaType === "video" ? (
          <video src={item.url} muted playsInline preload="metadata" />
        ) : (
          <img src={item.url} alt={alt} loading="lazy" />
        )}
        {item.mediaType === "video" && (
          <span className="media-tile-play" aria-hidden="true">
            <Play size={16} fill="currentColor" aria-hidden="true" />
          </span>
        )}
      </button>
      {lineageLabel && (
        <span className="media-tile-lineage">{lineageLabel}</span>
      )}
      <div className="media-tile-actions">
        {onSelect && (
          <button
            type="button"
            className="media-tile-action"
            aria-label={selected ? "Remove selection" : "Select media"}
            aria-pressed={selected}
            title={selected ? "Selected" : "Select"}
            onClick={onSelect}
          >
            {selected ? (
              <Check size={14} aria-hidden="true" />
            ) : (
              <span className="media-tile-select-mark" aria-hidden="true" />
            )}
          </button>
        )}
        <button
          type="button"
          className="media-tile-action"
          aria-label="View full size"
          title="View"
          onClick={onOpen}
        >
          <Maximize2 size={14} aria-hidden="true" />
        </button>
        {onEdit && (
          <button
            type="button"
            className="media-tile-action"
            aria-label={item.slot !== null ? "Use as source" : "Open in generator"}
            title={item.slot !== null ? "Use as source" : "Open in generator"}
            onClick={onEdit}
          >
            <Pencil size={14} aria-hidden="true" />
          </button>
        )}
        {onDownload && (
          <button
            type="button"
            className="media-tile-action"
            aria-label="Download"
            title="Download"
            onClick={onDownload}
          >
            <Download size={14} aria-hidden="true" />
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            className="media-tile-action"
            aria-label="Delete generation"
            title="Delete generation"
            onClick={onDelete}
          >
            <Trash2 size={14} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
