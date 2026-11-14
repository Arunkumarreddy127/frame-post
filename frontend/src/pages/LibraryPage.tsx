import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { useConfirm } from "../components/ConfirmDialog";
import { LibraryMediaGrid } from "../components/library/LibraryMediaGrid";
import { MediaViewer } from "../components/media/MediaViewer";
import { deleteGeneration, getGeneration, saveFile } from "../generationApi";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";
import { useMediaPages } from "../hooks/useGenerationPages";
import type { Generation, MediaItem, ShellRouteProps } from "../types";

type LibraryPageProps = ShellRouteProps & {
  pageId?: string;
};

type KindFilter = "all" | "inputs" | "outputs";
type TypeFilter = "all" | "image" | "video";

function mediaGenerationId(mediaId: string) {
  return mediaId.split(/:(?:in|out):/, 1)[0];
}

export function LibraryPage({ user, onLogout, pageId }: LibraryPageProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [kind, setKind] = useState<KindFilter>("all");
  const [mediaType, setMediaType] = useState<TypeFilter>("all");
  const [hasSource, setHasSource] = useState(false);
  const [grouped, setGrouped] = useState(false);
  const [viewing, setViewing] = useState<MediaItem | null>(null);
  const [actionError, setActionError] = useState("");
  const restoredMediaId = useRef("");
  const inputPage = useMediaPages("inputs", pageId);
  const outputPage = useMediaPages("outputs", pageId);
  const { confirm, dialog: confirmDialog } = useConfirm();
  const inputSentinel = useInfiniteScroll<HTMLDivElement>(
    inputPage.loadMore,
    inputPage.hasMore && !inputPage.loading,
  );
  const outputSentinel = useInfiniteScroll<HTMLDivElement>(
    outputPage.loadMore,
    outputPage.hasMore && !outputPage.loading,
  );

  const allItems = useMemo(
    () =>
      [...inputPage.items, ...outputPage.items].sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      ),
    [inputPage.items, outputPage.items],
  );
  const visibleItems = useMemo(
    () =>
      allItems.filter((item) => {
        if (kind === "inputs" && !item.slot) return false;
        if (kind === "outputs" && item.slot) return false;
        if (mediaType !== "all" && item.mediaType !== mediaType) return false;
        if (
          hasSource &&
          (item.slot !== null || (!item.parentGenerationId && item.sourceCount === 0))
        ) return false;
        return true;
      }),
    [allItems, hasSource, kind, mediaType],
  );
  const loading = inputPage.loading || outputPage.loading;
  const loadError = inputPage.error || outputPage.error;
  const mediaId = searchParams.get("media");

  function setMediaParam(item: MediaItem | null, replace = true) {
    const next = new URLSearchParams(searchParams);
    if (item) next.set("media", item.id);
    else next.delete("media");
    setSearchParams(next, { replace });
  }

  function selectMedia(item: MediaItem, replace = true) {
    setViewing(item);
    setMediaParam(item, replace);
  }

  function openMedia(item: MediaItem) {
    selectMedia(item, false);
  }

  function closeViewer() {
    setViewing(null);
    setMediaParam(null);
  }

  useEffect(() => {
    if (!mediaId) {
      restoredMediaId.current = "";
      setViewing(null);
      return;
    }
    const loaded = allItems.find((item) => item.id === mediaId);
    if (loaded) {
      setViewing(loaded);
      restoredMediaId.current = mediaId;
      return;
    }
    if (loading || restoredMediaId.current === mediaId) return;
    restoredMediaId.current = mediaId;
    let cancelled = false;
    getGeneration(mediaGenerationId(mediaId), pageId)
      .then((generation) => {
        if (cancelled) return;
        const item = [...generation.inputFiles, ...generation.outputs].find(
          (entry) => entry.id === mediaId,
        );
        if (!item) {
          setActionError("That media item is not available in this Library.");
          setMediaParam(null);
          return;
        }
        setActionError("");
        setViewing(item);
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setActionError(
          caught instanceof Error ? caught.message : "Unable to open media",
        );
        setMediaParam(null);
      });
    return () => {
      cancelled = true;
    };
  }, [allItems, loading, mediaId, pageId]);

  async function download(item: MediaItem) {
    setActionError("");
    try {
      await saveFile(item.key, item.name);
    } catch (caught) {
      setActionError(
        caught instanceof Error ? caught.message : "Unable to download this file",
      );
    }
  }

  async function remove(item: MediaItem) {
    setActionError("");
    let generation: Generation;
    try {
      generation = await getGeneration(item.generationId, pageId);
    } catch (caught) {
      setActionError(
        caught instanceof Error ? caught.message : "Unable to load generation details",
      );
      return;
    }
    const fileCount = generation.inputFiles.length + generation.outputs.length;
    const accepted = await confirm({
      title: "Delete this generation?",
      message: `This permanently deletes the generation and its ${fileCount} associated file${fileCount === 1 ? "" : "s"}. Files shared with other generations are retained. This cannot be undone.`,
      confirmLabel: `Delete generation (${fileCount} file${fileCount === 1 ? "" : "s"})`,
      danger: true,
    });
    if (!accepted) return;
    try {
      await deleteGeneration(generation.id, pageId);
      inputPage.removeWhere((entry) => entry.generationId === generation.id);
      outputPage.removeWhere((entry) => entry.generationId === generation.id);
      if (viewing?.generationId === generation.id) closeViewer();
    } catch (caught) {
      setActionError(
        caught instanceof Error ? caught.message : "Unable to delete this generation",
      );
    }
  }

  async function openInGenerator(item: MediaItem) {
    setActionError("");
    try {
      const generation = await getGeneration(item.generationId, pageId);
      const base = generation.pageId ? `/pages/${generation.pageId}` : "";
      const path =
        generation.provider === "OPENAI"
          ? `${base}/create/gpt-image-gen`
          : `${base}/create/rh/${generation.workflowKey}`;
      const params = new URLSearchParams({
        from: generation.id,
        result: item.key,
      });
      navigate(`${path}?${params.toString()}`);
    } catch (caught) {
      setActionError(
        caught instanceof Error ? caught.message : "Unable to open this file",
      );
    }
  }

  const groupedItems = useMemo(() => {
    const groups = new Map<string, MediaItem[]>();
    visibleItems.forEach((item) => {
      const group = groups.get(item.generationId) ?? [];
      group.push(item);
      groups.set(item.generationId, group);
    });
    return [...groups.entries()];
  }, [visibleItems]);

  const actions = {
    onOpen: openMedia,
    onDownload: download,
    onDelete: remove,
    onEdit: openInGenerator,
  };

  return (
    <AppShell
      user={user}
      onLogout={onLogout}
      pageTitle="Library"
      sidebar={pageId ? "page" : "global"}
      pageId={pageId}
      backTo={pageId ? `/pages/${pageId}` : "/home"}
    >
      <section className="library-panel">
        <header className="library-heading">
          <div>
            <p className="eyebrow">Library</p>
            <h2>Library</h2>
            <p>Browse your source files and generated work together.</p>
          </div>
          <span className="library-total">{visibleItems.length} shown</span>
        </header>
        <div className="library-filters" aria-label="Filter library media">
          <div className="library-filter-group" aria-label="Media role">
            {(["all", "outputs", "inputs"] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={kind === value ? "active" : ""}
                aria-pressed={kind === value}
                onClick={() => setKind(value)}
              >
                {value === "all" ? "All media" : value}
              </button>
            ))}
          </div>
          <label>
            <span className="sr-only">Media type</span>
            <select
              value={mediaType}
              onChange={(event) => setMediaType(event.target.value as TypeFilter)}
            >
              <option value="all">All types</option>
              <option value="image">Images</option>
              <option value="video">Videos</option>
            </select>
          </label>
          <div className="library-filter-toggles">
            <label className="library-source-filter">
              <input
                type="checkbox"
                checked={hasSource}
                onChange={(event) => setHasSource(event.target.checked)}
              />
              Has source
            </label>
            <label className="library-source-filter">
              <input
                type="checkbox"
                checked={grouped}
                onChange={(event) => setGrouped(event.target.checked)}
              />
              Group by generation
            </label>
          </div>
        </div>
        {(loadError || actionError) && (
          <p className="status error" role="alert">{loadError || actionError}</p>
        )}
        {!loadError && !loading && visibleItems.length === 0 && (
          <p className="status">
            {allItems.length === 0
              ? "Nothing here yet."
              : "No media matches these filters."}
          </p>
        )}
        {grouped ? (
          <div className="library-generation-groups">
            {groupedItems.map(([generationId, entries]) => (
              <section className="library-generation-group" key={generationId}>
                <h3>
                  Generation · {new Date(entries[0].createdAt).toLocaleDateString()}
                  <span>{entries.filter((entry) => entry.slot).length} inputs · {entries.filter((entry) => !entry.slot).length} outputs</span>
                </h3>
                <LibraryMediaGrid items={entries} {...actions} />
              </section>
            ))}
          </div>
        ) : (
          <LibraryMediaGrid items={visibleItems} {...actions} />
        )}
        {loading && <p className="status" role="status">Loading…</p>}
        {inputPage.hasMore && <div ref={inputSentinel} className="library-scroll-sentinel" />}
        {outputPage.hasMore && <div ref={outputSentinel} className="library-scroll-sentinel" />}
      </section>
      {viewing && (
        <MediaViewer
          item={viewing}
          items={visibleItems}
          onSelect={selectMedia}
          onClose={closeViewer}
          onEdit={openInGenerator}
        />
      )}
      {confirmDialog}
    </AppShell>
  );
}
