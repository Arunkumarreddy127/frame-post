import { MediaTile, mediaLineageLabel } from "../media/MediaTile";
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
    <MediaTile
      item={item}
      alt={alt}
      className="image-gen-tile"
      lineageLabel={mediaLineageLabel(item)}
      onOpen={() => onFullView(item, alt)}
      onDownload={() => onDownload(item)}
      onDelete={onDelete}
      onEdit={onEdit}
    />
  );
}
