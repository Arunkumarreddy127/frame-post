import { Check, X } from "lucide-react";
import { useState } from "react";
import { useInfiniteScroll } from "../../hooks/useInfiniteScroll";
import { useMediaPages } from "../../hooks/useGenerationPages";
import type { MediaItem } from "../../types";

type LibraryPickerProps = {
  pageId?: string;
  accept: string[];
  /** How many more files can be chosen. */
  limit: number;
  onSelect: (items: MediaItem[]) => void;
  onClose: () => void;
};

const TABS = [
  { key: "outputs", label: "Outputs" },
  { key: "inputs", label: "Inputs" },
] as const;

/** Modal for choosing existing Library files as generation inputs. */
export function LibraryPicker({
  pageId,
  accept,
  limit,
  onSelect,
  onClose,
}: LibraryPickerProps) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("outputs");
  const [selected, setSelected] = useState<MediaItem[]>([]);
  const { items, hasMore, loading, error, loadMore } = useMediaPages(
    tab,
    pageId,
  );
  const sentinel = useInfiniteScroll<HTMLDivElement>(
    loadMore,
    hasMore && !loading,
  );
  const visible = items.filter((item) => accept.includes(item.contentType));

  function toggle(item: MediaItem) {
    setSelected((current) => {
      if (current.some((entry) => entry.key === item.key)) {
        return current.filter((entry) => entry.key !== item.key);
      }
      if (limit === 1) return [item];
      return current.length >= limit ? current : [...current, item];
    });
  }

  return (
    <div
      className="library-picker-layer"
      role="dialog"
      aria-modal="true"
      aria-label="Choose from Library"
      onMouseDown={onClose}
    >
      <div
        className="library-picker"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="library-picker-header">
          <h3>Choose from Library</h3>
          <div className="library-picker-tabs" role="tablist">
            {TABS.map((entry) => (
              <button
                key={entry.key}
                type="button"
                role="tab"
                aria-selected={tab === entry.key}
                className={tab === entry.key ? "active" : ""}
                onClick={() => setTab(entry.key)}
              >
                {entry.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="secondary-button"
            aria-label="Close"
            onClick={onClose}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </header>
        <div className="library-picker-body">
          {error && <p className="status error">{error}</p>}
          {!error && !loading && visible.length === 0 && (
            <p className="status">No matching files here yet.</p>
          )}
          <div className="library-picker-grid">
            {visible.map((item) => {
              const chosen = selected.some((entry) => entry.key === item.key);
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`library-picker-tile${chosen ? " selected" : ""}`}
                  aria-pressed={chosen}
                  title={item.name}
                  onClick={() => toggle(item)}
                >
                  {item.mediaType === "video" ? (
                    <video src={item.url} preload="metadata" muted />
                  ) : (
                    <img src={item.url} alt={item.name} loading="lazy" />
                  )}
                  {chosen && (
                    <span className="library-picker-check">
                      <Check size={14} aria-hidden="true" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {loading && <p className="status">Loading…</p>}
          <div ref={sentinel} />
        </div>
        <footer className="library-picker-footer">
          <span className="library-picker-selection-count">
            {selected.length} selected{limit > 1 ? ` (up to ${limit})` : ""}
          </span>
          <button
            type="button"
            className="primary-button"
            disabled={selected.length === 0}
            onClick={() => onSelect(selected)}
          >
            Use selected
          </button>
        </footer>
      </div>
    </div>
  );
}
