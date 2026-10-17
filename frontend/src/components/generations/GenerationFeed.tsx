import { X } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import {
  deleteGeneration,
  saveFile,
  subscribeToGeneration,
} from "../../generationApi";
import { useInfiniteScroll } from "../../hooks/useInfiniteScroll";
import type { Generation, MediaItem } from "../../types";
import { GenerationArticle } from "./GenerationArticle";

const POPOVER_WIDTH = 480;
const POPOVER_GAP = 8;

function popoverPosition(anchor: HTMLElement): CSSProperties {
  const rect = anchor.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const width = Math.min(POPOVER_WIDTH, viewportWidth - POPOVER_GAP * 2);
  const left = Math.min(
    Math.max(rect.left, POPOVER_GAP),
    viewportWidth - width - POPOVER_GAP,
  );
  const spaceBelow = viewportHeight - rect.bottom;
  const spaceAbove = rect.top;
  if (spaceBelow >= 200 || spaceBelow >= spaceAbove) {
    return {
      top: rect.bottom + POPOVER_GAP,
      left,
      width,
      maxHeight: spaceBelow - POPOVER_GAP * 2,
    };
  }
  return {
    bottom: viewportHeight - rect.top + POPOVER_GAP,
    left,
    width,
    maxHeight: spaceAbove - POPOVER_GAP * 2,
  };
}

type GenerationFeedProps = {
  items: Generation[];
  hasMore: boolean;
  loading: boolean;
  loadError?: string;
  emptyMessage?: string;
  onLoadMore: () => void;
  onUpdate: (generation: Generation) => void;
  onDeleted: (generation: Generation) => void;
  onEdit?: (generation: Generation, output: MediaItem) => void;
};

/**
 * Renders generations of any provider as newest-first articles. Owns the full-size viewer, the prompt
 * popover, live updates for processing items and loading of further pages as the end scrolls into view.
 */
export function GenerationFeed({
  items,
  hasMore,
  loading,
  loadError,
  emptyMessage = "Nothing generated yet.",
  onLoadMore,
  onUpdate,
  onDeleted,
  onEdit,
}: GenerationFeedProps) {
  const [error, setError] = useState("");
  const [fullView, setFullView] = useState<{
    item: MediaItem;
    alt: string;
  } | null>(null);
  const [promptPopover, setPromptPopover] = useState<{
    text: string;
    anchor: HTMLElement;
  } | null>(null);
  const [, setLayoutTick] = useState(0);
  const sentinel = useInfiniteScroll<HTMLDivElement>(
    onLoadMore,
    hasMore && !loading,
  );

  const processingIds = items
    .filter((item) => item.status === "PROCESSING")
    .map((item) => item.id)
    .join(",");

  useEffect(() => {
    if (!processingIds) return;
    const closers = processingIds
      .split(",")
      .map((id) => subscribeToGeneration(id, undefined, onUpdate));
    return () => closers.forEach((close) => close());
  }, [processingIds, onUpdate]);

  useEffect(() => {
    if (!fullView && !promptPopover) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setFullView(null);
      setPromptPopover(null);
    }
    function onLayoutChange() {
      setLayoutTick((tick) => tick + 1);
    }
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onLayoutChange, true);
    window.addEventListener("resize", onLayoutChange);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onLayoutChange, true);
      window.removeEventListener("resize", onLayoutChange);
    };
  }, [fullView, promptPopover]);

  async function download(item: MediaItem) {
    setError("");
    try {
      await saveFile(item.key, item.name);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to download the file",
      );
    }
  }

  async function remove(generation: Generation) {
    if (!window.confirm("Delete this generation? This cannot be undone."))
      return;
    setError("");
    try {
      await deleteGeneration(generation.id);
      onDeleted(generation);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to delete the generation",
      );
    }
  }

  return (
    <>
      <section className="image-gen-results">
        {items.length === 0 && !loading && !loadError && (
          <p className="status">{emptyMessage}</p>
        )}
        {items.map((generation) => (
          <GenerationArticle
            key={generation.id}
            generation={generation}
            onFullView={(item, alt) => setFullView({ item, alt })}
            onDownload={download}
            onDelete={remove}
            onShowPrompt={(text, anchor) => setPromptPopover({ text, anchor })}
            onEdit={onEdit}
          />
        ))}
        {(error || loadError) && <p className="error">{error || loadError}</p>}
        {loading && <p className="status">Loading…</p>}
        {hasMore && <div ref={sentinel} style={{ height: 1 }} />}
      </section>
      {fullView && (
        <div
          className="image-gen-fullview-layer"
          role="dialog"
          aria-modal="true"
          aria-label="Full size view"
          onMouseDown={() => setFullView(null)}
        >
          <button
            type="button"
            className="secondary-button image-gen-fullview-close"
            aria-label="Close"
            onClick={() => setFullView(null)}
          >
            <X size={16} aria-hidden="true" />
          </button>
          {fullView.item.mediaType === "video" ? (
            <video
              src={fullView.item.url}
              controls
              autoPlay
              style={{ maxWidth: "90%", maxHeight: "90%" }}
              onMouseDown={(event) => event.stopPropagation()}
            />
          ) : (
            <img
              src={fullView.item.url}
              alt={fullView.alt}
              onMouseDown={(event) => event.stopPropagation()}
            />
          )}
        </div>
      )}
      {promptPopover && (
        <div
          className="image-gen-popover-layer"
          onMouseDown={() => setPromptPopover(null)}
        >
          <div
            className="panel image-gen-popover"
            role="dialog"
            aria-modal="false"
            aria-labelledby="image-gen-popover-title"
            style={popoverPosition(promptPopover.anchor)}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="image-gen-popover-header">
              <h3 id="image-gen-popover-title">Prompt</h3>
              <button
                type="button"
                className="secondary-button"
                aria-label="Close"
                onClick={() => setPromptPopover(null)}
              >
                <X size={14} aria-hidden="true" />
              </button>
            </header>
            <p className="image-gen-popover-body">{promptPopover.text}</p>
          </div>
        </div>
      )}
    </>
  );
}
