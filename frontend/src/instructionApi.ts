import { API_BASE_URL } from "./api";
import type { InstructionFile } from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    ...init,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail ?? body?.message ?? "Unable to complete the request");
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function basePath(pageId?: string) {
  return pageId ? `/api/pages/${pageId}/instructions` : "/api/instructions";
}

const jsonHeaders = { "Content-Type": "application/json" };

export async function listInstructionFiles(pageId?: string) {
  return (await request<InstructionFile[]>(basePath(pageId))) ?? [];
}

export async function createInstructionFile(
  input: { name: string; content: string },
  pageId?: string,
) {
  return await request<InstructionFile>(basePath(pageId), {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(input),
  });
}

export async function updateInstructionFile(
  id: string,
  input: {
    name: string;
    content: string;
    scope?: "user" | "page";
    pageId?: string | null;
  },
) {
  return await request<InstructionFile>(`/api/instructions/${id}`, {
    method: "PUT",
    headers: jsonHeaders,
    body: JSON.stringify(input),
  });
}

export async function deleteInstructionFile(id: string) {
  await request<void>(`/api/instructions/${id}`, { method: "DELETE" });
}
