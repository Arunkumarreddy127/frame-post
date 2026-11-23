import { API_BASE_URL } from "./api";
import type {
  Creation,
  CreationItem,
  CreationOutline,
  CreationTool,
} from "./types";

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
  placement: {
    generationId: string;
    parentItemId?: string;
    shotId?: string;
    sceneId?: string;
    tool?: CreationTool;
  },
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
  items: { itemId: string }[],
) {
  return request<CreationItem[]>(
    scoped(pageId, `/creations/${id}/items/order`),
    json("PUT", { items }),
  );
}

export type SceneDraft = { title: string; description: string | null };

export type ShotDraft = {
  sceneId: string;
  title: string;
  brief: string | null;
  shotSize: string | null;
  shotTypes: string[];
  movement: string | null;
  durationSeconds: number | null;
};

export function getOutline(pageId: string | undefined, id: string) {
  return request<CreationOutline>(scoped(pageId, `/creations/${id}/outline`));
}

export function createScene(
  pageId: string | undefined,
  id: string,
  draft: SceneDraft,
) {
  return request<void>(scoped(pageId, `/creations/${id}/scenes`), json("POST", draft));
}

export function updateScene(
  pageId: string | undefined,
  id: string,
  sceneId: string,
  draft: SceneDraft,
) {
  return request<void>(
    scoped(pageId, `/creations/${id}/scenes/${sceneId}`),
    json("PUT", draft),
  );
}

export function deleteScene(pageId: string | undefined, id: string, sceneId: string) {
  return request<void>(scoped(pageId, `/creations/${id}/scenes/${sceneId}`), {
    method: "DELETE",
  });
}

export function reorderScenes(
  pageId: string | undefined,
  id: string,
  sceneIds: string[],
) {
  return request<void>(
    scoped(pageId, `/creations/${id}/scenes/order`),
    json("PUT", { sceneIds }),
  );
}

export function createShot(pageId: string | undefined, id: string, draft: ShotDraft) {
  return request<void>(scoped(pageId, `/creations/${id}/shots`), json("POST", draft));
}

export function updateShot(
  pageId: string | undefined,
  id: string,
  shotId: string,
  draft: Omit<ShotDraft, "sceneId">,
) {
  return request<void>(
    scoped(pageId, `/creations/${id}/shots/${shotId}`),
    json("PUT", draft),
  );
}

export function deleteShot(pageId: string | undefined, id: string, shotId: string) {
  return request<void>(scoped(pageId, `/creations/${id}/shots/${shotId}`), {
    method: "DELETE",
  });
}

export function reorderShots(
  pageId: string | undefined,
  id: string,
  sceneId: string,
  shotIds: string[],
) {
  return request<void>(
    scoped(pageId, `/creations/${id}/shots/order`),
    json("PUT", { sceneId, shotIds }),
  );
}

export function setShotFinal(
  pageId: string | undefined,
  id: string,
  shotId: string,
  itemId: string | null,
) {
  return request<void>(
    scoped(pageId, `/creations/${id}/shots/${shotId}/final`),
    json("PUT", { itemId }),
  );
}

/** Pass a null shotId to move an item back to Unassigned. */
export function moveCreationItem(
  pageId: string | undefined,
  id: string,
  itemId: string,
  shotId: string | null,
) {
  return request<void>(
    scoped(pageId, `/creations/${id}/items/${itemId}/shot`),
    json("PUT", { shotId }),
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
