import { API_BASE_URL } from "./api";
import type { Creation, CreationItem } from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    ...init,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      body?.detail ?? body?.message ?? "Unable to complete the request",
    );
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

function scoped(pageId: string | undefined, path: string) {
  return pageId ? `/api/pages/${pageId}${path}` : `/api${path}`;
}

function json(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export type CreationDraft = { name: string; description: string };

export function listCreations(pageId?: string) {
  return request<Creation[]>(scoped(pageId, "/creations"));
}

export function getCreation(pageId: string | undefined, id: string) {
  return request<Creation>(scoped(pageId, `/creations/${id}`));
}

export function createCreation(pageId: string | undefined, draft: CreationDraft) {
  return request<Creation>(scoped(pageId, "/creations"), json("POST", draft));
}

export function updateCreation(
  pageId: string | undefined,
  id: string,
  draft: CreationDraft,
) {
  return request<Creation>(scoped(pageId, `/creations/${id}`), json("PUT", draft));
}

export function deleteCreation(pageId: string | undefined, id: string) {
  return request<void>(scoped(pageId, `/creations/${id}`), { method: "DELETE" });
}

export function listCreationItems(pageId: string | undefined, id: string) {
  return request<CreationItem[]>(scoped(pageId, `/creations/${id}/items`));
}

export function addCreationItem(
  pageId: string | undefined,
  id: string,
  placement: { generationId: string; laneId?: string; parentItemId?: string },
) {
  return request<CreationItem>(
    scoped(pageId, `/creations/${id}/items`),
    json("POST", placement),
  );
}

export function removeCreationItem(
  pageId: string | undefined,
  id: string,
  itemId: string,
) {
  return request<void>(scoped(pageId, `/creations/${id}/items/${itemId}`), {
    method: "DELETE",
  });
}

export function reorderCreationItems(
  pageId: string | undefined,
  id: string,
  items: { itemId: string; laneId: string | null }[],
) {
  return request<CreationItem[]>(
    scoped(pageId, `/creations/${id}/items/order`),
    json("PUT", { items }),
  );
}

/** Returns the subset of these generation ids that already belong to a creation. */
export function groupedGenerationIds(
  pageId: string | undefined,
  generationIds: string[],
) {
  const search = new URLSearchParams();
  generationIds.forEach((id) => search.append("generationIds", id));
  return request<string[]>(
    scoped(pageId, `/creations/grouped?${search.toString()}`),
  );
}

const CREATIONS_CHANGED_EVENT = "framepost:creations-changed";

export function notifyCreationsChanged() {
  window.dispatchEvent(new Event(CREATIONS_CHANGED_EVENT));
}

export function onCreationsChanged(listener: () => void) {
  window.addEventListener(CREATIONS_CHANGED_EVENT, listener);
  return () => window.removeEventListener(CREATIONS_CHANGED_EVENT, listener);
}
