import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  deleteGeneration,
  getGeneration,
  saveFile,
  subscribeToGeneration,
} from "../../generationApi";
import { useInfiniteScroll } from "../../hooks/useInfiniteScroll";
import type { Generation, MediaItem } from "../../types";
import { useConfirm } from "../ConfirmDialog";
import { GenerationArticle } from "./GenerationArticle";
import { MediaViewer } from "../media/MediaViewer";

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
 * Renders generations of any provider as newest-first articles. Owns the full-size viewer,
 * live updates for processing items, and loading further pages as the end scrolls into view.
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
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();
  const restoredMediaId = useRef("");
  const [fullView, setFullView] = useState<MediaItem | null>(null);
  const sentinel = useInfiniteScroll<HTMLDivElement>(
    onLoadMore,
    hasMore && !loading,
  );
  const viewerItems = useMemo(
    () => items.flatMap((generation) => generation.outputs),
    [items],
  );
  const mediaId = searchParams.get("media");
  const viewerAlt =
    items.find((generation) =>
      generation.outputs.some((output) => output.id === fullView?.id),
    )?.inputs.prompt ?? fullView?.name;

  function showMedia(item: MediaItem, replace = true) {
    setFullView(item);
    const next = new URLSearchParams(searchParams);
    next.set("media", item.id);
    setSearchParams(next, { replace });
  }

  function closeMediaViewer() {
    setFullView(null);
    const next = new URLSearchParams(searchParams);
    next.delete("media");
    setSearchParams(next, { replace: true });
  }

  useEffect(() => {
    if (!mediaId) {
      restoredMediaId.current = "";
      setFullView(null);
      return;
    }
    const visible = viewerItems.find((item) => item.id === mediaId);
    if (visible) {
      restoredMediaId.current = mediaId;
      setFullView(visible);
      return;
    }
    if (restoredMediaId.current === mediaId) return;
    const match = mediaId.match(/:(?:in|out):/);
    if (!match || match.index === undefined) return;
    restoredMediaId.current = mediaId;
    let cancelled = false;
    getGeneration(mediaId.slice(0, match.index))
      .then((generation) => {
        if (cancelled) return;
        const selected = [...generation.inputFiles, ...generation.outputs].find(
          (item) => item.id === mediaId,
        );
        if (selected) setFullView(selected);
        else setError("That media item is no longer available.");
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Unable to open media");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [mediaId, viewerItems]);

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

  async function showParent(generation: Generation) {
    if (!generation.parentGenerationId || !generation.parentResultKey) return;
    setError("");
    try {
      const parent = await getGeneration(generation.parentGenerationId, generation.pageId ?? undefined);
      const source = parent.outputs.find((item) => item.key === generation.parentResultKey);
      if (!source) {
        setError("The original image is no longer available.");
        return;
      }
      showMedia(source, false);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to open the original image",
      );
    }
  }

  async function remove(generation: Generation) {
    const fileCount = generation.inputFiles.length + generation.outputs.length;
    const accepted = await confirm({
      title: "Delete this generation?",
      message: `This removes the generation and its ${fileCount} associated file${fileCount === 1 ? "" : "s"}. Shared media files remain available to other generations. This cannot be undone.`,
      confirmLabel: `Delete generation (${fileCount} file${fileCount === 1 ? "" : "s"})`,
      danger: true,
    });
    if (!accepted) return;
    setError("");
    try {
      await deleteGeneration(generation.id);
      if (fullView?.generationId === generation.id) closeMediaViewer();
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
            onFullView={(item) => showMedia(item, false)}
            onDownload={download}
            onDelete={remove}
            onShowParent={showParent}
            onEdit={onEdit}
          />
        ))}
        {(error || loadError) && (
          <p className="error" role="alert">
            {error || loadError}
          </p>
        )}
        {loading && (
          <p className="status" role="status">
            Loading…
          </p>
        )}
        {hasMore && <div ref={sentinel} style={{ height: 1 }} />}
      </section>
      {confirmDialog}
      {fullView && (
        <MediaViewer
          item={fullView}
          items={viewerItems}
          alt={viewerAlt}
          onSelect={(item) => showMedia(item)}
          onClose={closeMediaViewer}
        />
      )}
    </>
  );
}
