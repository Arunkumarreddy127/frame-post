import { useCallback, useEffect, useRef, useState } from "react";
import {
  listGenerations,
  listMedia,
  type GenerationFilters,
} from "../generationApi";
import type { Generation, MediaItem, Paged } from "../types";

const PAGE_SIZE = 10;

/**
 * Loads a cursor-paged list: the first page whenever `key` changes, further pages on `loadMore`.
 * `enabled` false keeps the list empty without fetching.
 */
function usePagedList<T extends { id: string }>(
  fetchPage: (before: string | undefined) => Promise<Paged<T>>,
  key: string,
  enabled: boolean,
) {
  const [items, setItems] = useState<T[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;
  const cursor = useRef<string | null>(null);
  const busy = useRef(false);
  const epoch = useRef(0);

  const load = useCallback(async (before: string | undefined) => {
    const token = epoch.current;
    busy.current = true;
    setLoading(true);
    setError("");
    try {
      const page = await fetchRef.current(before);
      if (token !== epoch.current) return;
      setItems((current) => {
        if (!before) return page.items;
        const known = new Set(current.map((item) => item.id));
        return [
          ...current,
          ...page.items.filter((item) => !known.has(item.id)),
        ];
      });
      cursor.current = page.nextCursor;
      setHasMore(page.nextCursor !== null);
    } catch (caught) {
      if (token === epoch.current) {
        setError(
          caught instanceof Error ? caught.message : "Unable to load the list",
        );
      }
    } finally {
      if (token === epoch.current) {
        busy.current = false;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    epoch.current += 1;
    busy.current = false;
    cursor.current = null;
    setItems([]);
    setHasMore(false);
    setError("");
    setLoading(false);
    if (enabled) void load(undefined);
    return () => {
      epoch.current += 1;
    };
  }, [key, enabled, load]);

  const loadMore = useCallback(() => {
    if (busy.current || cursor.current === null) return;
    void load(cursor.current);
  }, [load]);

  const prepend = useCallback((item: T) => {
    setItems((current) => [item, ...current.filter((it) => it.id !== item.id)]);
  }, []);

  const update = useCallback((item: T) => {
    setItems((current) => current.map((it) => (it.id === item.id ? item : it)));
  }, []);

  const removeWhere = useCallback((matches: (item: T) => boolean) => {
    setItems((current) => current.filter((item) => !matches(item)));
  }, []);

  return {
    items,
    hasMore,
    loading,
    error,
    loadMore,
    prepend,
    update,
    removeWhere,
  };
}

/** Newest-first generations for one scope, loaded a page at a time. */
export function useGenerationPages(filters: GenerationFilters, enabled = true) {
  const key = JSON.stringify(filters);
  return usePagedList<Generation>(
    (before) => listGenerations(filters, { before, limit: PAGE_SIZE }),
    key,
    enabled,
  );
}

/** Newest-first stored input or output files, loaded a page at a time. */
export function useMediaPages(kind: "inputs" | "outputs", pageId?: string) {
  return usePagedList<MediaItem>(
    (before) => listMedia(kind, { pageId }, { before, limit: PAGE_SIZE }),
    `${kind}|${pageId ?? ""}`,
    true,
  );
}
