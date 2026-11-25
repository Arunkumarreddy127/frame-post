import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getGeneration, listGenerationChildren } from "../../generationApi";
import type { Generation, MediaItem } from "../../types";
import { CopyPromptButton } from "./CopyPromptButton";

type MediaViewerProps = {
  item: MediaItem;
  items: MediaItem[];
  alt?: string;
  onSelect: (item: MediaItem) => void;
  onClose: () => void;
  onEdit?: (item: MediaItem) => void;
};

function settingsLine(generation: Generation) {
  if (generation.provider === "OPENAI") {
    const { model, size, quality } = generation.inputs;
    return [model, size, quality].filter(Boolean).join(" · ");
  }
  const { prompt: _prompt, ...settings } = generation.inputs;
  return [
    generation.workflowKey ?? "Workflow",
    generation.instanceType,
    ...Object.values(settings),
  ]
    .filter(Boolean)
    .join(" · ");
}

export function MediaViewer({
  item,
  items,
  alt,
  onSelect,
  onClose,
  onEdit,
}: MediaViewerProps) {
  const [generation, setGeneration] = useState<Generation | null>(null);
  const [parent, setParent] = useState<Generation | null>(null);
  const [children, setChildren] = useState<Generation[]>([]);
  const [childrenCursor, setChildrenCursor] = useState<string | null>(null);
  const [loadingChildren, setLoadingChildren] = useState(false);
  const [childrenError, setChildrenError] = useState("");
  const [parentError, setParentError] = useState("");
  const [loadingRelations, setLoadingRelations] = useState(false);
  const [error, setError] = useState("");
  const layerRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const currentIndex = items.findIndex((entry) => entry.id === item.id);
  const navigationRef = useRef({ items, currentIndex, onSelect, onClose });
  navigationRef.current = { items, currentIndex, onSelect, onClose };

  useEffect(() => {
    let cancelled = false;
    setGeneration(null);
    setParent(null);
    setChildren([]);
    setChildrenCursor(null);
    setChildrenError("");
    setParentError("");
    setLoadingRelations(false);
    setError("");
    async function loadDetails() {
      try {
        const result = await getGeneration(item.generationId, item.pageId ?? undefined);
        if (cancelled) return;
        setGeneration(result);
        setLoadingRelations(true);
        const [sourceResult, childResult] = await Promise.allSettled([
          result.parentGenerationId
            ? getGeneration(result.parentGenerationId, result.pageId ?? undefined)
            : Promise.resolve(null),
          item.slot === null
            ? listGenerationChildren(result.id, result.pageId ?? undefined, { limit: 50 })
            : Promise.resolve({ items: [], nextCursor: null }),
        ]);
        if (cancelled) return;
        if (sourceResult.status === "fulfilled") {
          setParent(sourceResult.value);
        } else {
          setParentError(
            sourceResult.reason instanceof Error
              ? sourceResult.reason.message
              : "Original source details are unavailable.",
          );
        }
        if (childResult.status === "fulfilled") {
          setChildren(
            childResult.value.items.filter((child) => child.parentResultKey === item.key),
          );
          setChildrenCursor(childResult.value.nextCursor);
        } else {
          setChildrenError(
            childResult.reason instanceof Error
              ? childResult.reason.message
              : "Unable to load derived media.",
          );
        }
        setLoadingRelations(false);
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load media details",
          );
        }
      }
    }
    void loadDetails();
    return () => {
      cancelled = true;
    };
  }, [item.generationId, item.key, item.pageId, item.slot]);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      const navigation = navigationRef.current;
      if (event.key === "Escape") navigation.onClose();
      if (event.key === "ArrowLeft" && navigation.currentIndex > 0) {
        navigation.onSelect(navigation.items[navigation.currentIndex - 1]);
      }
      if (
        event.key === "ArrowRight" &&
        navigation.currentIndex >= 0 &&
        navigation.currentIndex < navigation.items.length - 1
      ) {
        navigation.onSelect(navigation.items[navigation.currentIndex + 1]);
      }
      if (event.key === "Tab") {
        const focusable = layerRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), video[controls]',
        );
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus?.();
    };
  }, []);

  const sourceItem = parent?.outputs.find(
    (output) => output.key === generation?.parentResultKey,
  );
  const prompt = generation?.inputs.prompt;
  const isOutput = item.slot === null;
  const usedMedia = isOutput
    ? children.flatMap((child) => child.outputs)
    : generation?.outputs ?? [];

  function navigate(offset: -1 | 1) {
    const next = currentIndex + offset;
    if (next >= 0 && next < items.length) onSelect(items[next]);
  }

  async function loadMoreChildren() {
    if (!generation || !childrenCursor || loadingChildren) return;
    setLoadingChildren(true);
    setChildrenError("");
    try {
      const page = await listGenerationChildren(
        generation.id,
        generation.pageId ?? undefined,
        { before: childrenCursor, limit: 50 },
      );
      setChildren((current) => [
        ...current,
        ...page.items.filter((child) => child.parentResultKey === item.key),
      ]);
      setChildrenCursor(page.nextCursor);
    } catch (caught) {
      setChildrenError(
        caught instanceof Error ? caught.message : "Unable to load derived media",
      );
    } finally {
      setLoadingChildren(false);
    }
  }

  return (
    <div
      ref={layerRef}
      className="media-viewer-layer"
      role="dialog"
      aria-modal="true"
      aria-label="Media details"
      onMouseDown={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <button
        ref={closeRef}
        type="button"
        className="media-viewer-close"
        aria-label="Close media viewer"
        onClick={onClose}
      >
        <X size={18} aria-hidden="true" />
      </button>
      <div className="media-viewer" onMouseDown={(event) => event.stopPropagation()}>
        <div className="media-viewer-stage">
          {item.mediaType === "video" ? (
            <video
              src={item.url}
              controls
              playsInline
              preload="metadata"
              autoPlay
            />
          ) : (
            <img src={item.url} alt={alt ?? prompt ?? item.name} />
          )}
          {currentIndex > 0 && (
            <button
              type="button"
              className="media-viewer-nav previous"
              aria-label="Previous media"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft size={18} aria-hidden="true" />
            </button>
          )}
          {currentIndex >= 0 && currentIndex < items.length - 1 && (
            <button
              type="button"
              className="media-viewer-nav next"
              aria-label="Next media"
              onClick={() => navigate(1)}
            >
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          )}
        </div>
        <aside className="media-viewer-details">
          <h2 title={item.name}>{item.name}</h2>
          {onEdit && (
            <button
              type="button"
              className="secondary-button media-viewer-edit"
              onClick={() => onEdit(item)}
            >
              {item.slot !== null ? "Use as source" : "Open in generator"}
            </button>
          )}
          {error && <p className="status error" role="alert">{error}</p>}
          {!generation && !error && (
            <p className="status" role="status">Loading details…</p>
          )}
          {generation && (
            <>
              {settingsLine(generation) && (
                <p className="media-viewer-settings">{settingsLine(generation)}</p>
              )}
              {prompt && (
                <section className="media-viewer-section">
                  <div className="media-viewer-section-heading">
                    <h3>Prompt</h3>
                    <CopyPromptButton prompt={prompt} />
                  </div>
                  <p>{prompt}</p>
                </section>
              )}
              {isOutput && generation.inputFiles.length > 0 && (
                <section className="media-viewer-section">
                  <h3>Made from</h3>
                  <div className="media-viewer-related">
                    {generation.inputFiles.map((source) => (
                      <button
                        key={source.id}
                        type="button"
                        className="media-viewer-related-item"
                        title={source.name}
                        onClick={() => onSelect(source)}
                      >
                        {source.mediaType === "video" ? (
                          <video src={source.url} muted preload="metadata" />
                        ) : (
                          <img src={source.url} alt={source.name} />
                        )}
                        <span>{source.name}</span>
                      </button>
                    ))}
                  </div>
                </section>
              )}
              {isOutput && sourceItem && (
                <section className="media-viewer-section">
                  <h3>Parent result</h3>
                  <button
                    type="button"
                    className="media-viewer-related-item"
                    title={sourceItem.name}
                    onClick={() => onSelect(sourceItem)}
                  >
                    {sourceItem.mediaType === "video" ? (
                      <video src={sourceItem.url} muted preload="metadata" />
                    ) : (
                      <img src={sourceItem.url} alt={sourceItem.name} />
                    )}
                    <span>{sourceItem.name}</span>
                  </button>
                </section>
              )}
              {isOutput && parentError && (
                <p className="status">{parentError}</p>
              )}
              {(usedMedia.length > 0 ||
                (isOutput &&
                  (childrenCursor !== null || childrenError || loadingRelations))) && (
                <section className="media-viewer-section">
                  <h3>Used to make</h3>
                  <div className="media-viewer-related">
                    {usedMedia.map((output) => (
                        <button
                          key={output.id}
                          type="button"
                          className="media-viewer-related-item"
                          title={output.name}
                          onClick={() => onSelect(output)}
                        >
                          {output.mediaType === "video" ? (
                            <video src={output.url} muted preload="metadata" />
                          ) : (
                            <img src={output.url} alt={output.name} />
                          )}
                          <span>{output.name}</span>
                        </button>
                    ))}
                  </div>
                  {loadingRelations && usedMedia.length === 0 && (
                    <p className="status">Checking derived media…</p>
                  )}
                  {childrenError && <p className="status error" role="alert">{childrenError}</p>}
                  {isOutput && childrenCursor !== null && (
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={loadingChildren}
                      onClick={loadMoreChildren}
                    >
                      {loadingChildren ? "Loading…" : "Load more"}
                    </button>
                  )}
                </section>
              )}
              <section className="media-viewer-section">
                <h3>File</h3>
                <dl className="media-viewer-metadata">
                  <div><dt>Type</dt><dd>{item.mediaType}</dd></div>
                  {item.width && item.height && (
                    <div><dt>Dimensions</dt><dd>{item.width} × {item.height}</dd></div>
                  )}
                  {item.durationSeconds !== null && (
                    <div><dt>Duration</dt><dd>{item.durationSeconds}s</dd></div>
                  )}
                  {item.sizeBytes !== null && (
                    <div><dt>Size</dt><dd>{(item.sizeBytes / 1024 / 1024).toFixed(2)} MB</dd></div>
                  )}
                  <div><dt>Created</dt><dd>{new Date(item.createdAt).toLocaleString()}</dd></div>
                </dl>
              </section>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
