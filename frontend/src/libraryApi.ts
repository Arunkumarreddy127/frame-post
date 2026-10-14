import { API_BASE_URL } from "./api";

export type LibrarySource = "image" | "runninghub";

export type LibraryItem = {
  key: string;
  url: string;
  name: string;
  contentType: string;
  source: LibrarySource;
  generationId: string;
  pageId: string | null;
  createdAt: string;
};

export type LibraryResponse = {
  inputs: LibraryItem[];
  outputs: LibraryItem[];
};

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { credentials: "include" });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail ?? body?.message ?? "Unable to load the library");
  }
  return response.json() as Promise<T>;
}

export function fetchLibrary(pageId?: string) {
  const path = pageId ? `/api/pages/${pageId}/library` : "/api/library";
  return request<LibraryResponse>(path);
}
