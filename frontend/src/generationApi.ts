import { API_BASE_URL } from "./api";
import type {
  Catalog,
  Generation,
  GenerationProvider,
  InstanceType,
  MediaItem,
  Paged,
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
  return response.json() as Promise<T>;
}

function scoped(pageId: string | undefined, path: string) {
  return pageId ? `/api/pages/${pageId}${path}` : `/api${path}`;
}

function query(params: Record<string, string | number | boolean | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([name, value]) => {
    if (value !== undefined && value !== "" && value !== false) {
      search.set(name, String(value));
    }
  });
  const text = search.toString();
  return text ? `?${text}` : "";
}

export type GenerationFilters = {
  pageId?: string;
  provider?: GenerationProvider;
  workflowKey?: string;
  /** Without a page, list only generations that belong to no page. */
  globalOnly?: boolean;
};

export type PageOptions = { before?: string; limit?: number };

export function getCatalog() {
  return request<Catalog>("/api/generations/catalog");
}

export function listGenerations(
  filters: GenerationFilters,
  { before, limit }: PageOptions = {},
) {
  return request<Paged<Generation>>(
    scoped(filters.pageId, "/generations") +
      query({
        provider: filters.provider?.toLowerCase(),
        workflowKey: filters.workflowKey,
        globalOnly: filters.pageId ? undefined : filters.globalOnly,
        before,
        limit,
      }),
  );
}

export function getGeneration(id: string, pageId?: string) {
  return request<Generation>(scoped(pageId, `/generations/${id}`));
}

export function listMedia(
  kind: "inputs" | "outputs",
  filters: { pageId?: string },
  { before, limit }: PageOptions = {},
) {
  return request<Paged<MediaItem>>(
    scoped(filters.pageId, `/generations/media/${kind}`) +
      query({ before, limit }),
  );
}

export type CreateImageInput = {
  prompt: string;
  model: string;
  size: string;
  quality: string;
  count: number;
  attachments: File[];
  parentGenerationId?: string;
  parentResultKey?: string;
};

export function createImageGeneration(input: CreateImageInput, pageId?: string) {
  const form = new FormData();
  form.append("provider", "openai");
  form.append("prompt", input.prompt);
  form.append("model", input.model);
  form.append("size", input.size);
  form.append("quality", input.quality);
  form.append("count", String(input.count));
  if (input.parentGenerationId && input.parentResultKey) {
    form.append("parentGenerationId", input.parentGenerationId);
    form.append("parentResultKey", input.parentResultKey);
  }
  input.attachments.forEach((file) => form.append("attachments", file));
  return request<Generation>(scoped(pageId, "/generations"), {
    method: "POST",
    body: form,
  });
}

export type StartWorkflowInput = {
  values: Record<string, string>;
  files: Record<string, File>;
  instanceType: InstanceType;
};

/** One multipart part per workflow input, named after the input in its definition. */
export function startWorkflowGeneration(
  pageId: string,
  workflowKey: string,
  input: StartWorkflowInput,
) {
  const form = new FormData();
  form.append("provider", "runninghub");
  form.append("workflowKey", workflowKey);
  form.append("instanceType", input.instanceType);
  Object.entries(input.values).forEach(([name, value]) =>
    form.append(name, value),
  );
  Object.entries(input.files).forEach(([name, file]) =>
    form.append(name, file),
  );
  return request<Generation>(scoped(pageId, "/generations"), {
    method: "POST",
    body: form,
  });
}

export async function deleteGeneration(id: string, pageId?: string) {
  const response = await fetch(
    `${API_BASE_URL}${scoped(pageId, `/generations/${id}`)}`,
    { method: "DELETE", credentials: "include" },
  );
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      body?.detail ?? body?.message ?? "Unable to delete the generation",
    );
  }
}

/** Calls `onUpdate` for every change and stops once the generation is no longer processing. */
export function subscribeToGeneration(
  id: string,
  pageId: string | undefined,
  onUpdate: (generation: Generation) => void,
): () => void {
  const source = new EventSource(
    `${API_BASE_URL}${scoped(pageId, `/generations/${id}/events`)}`,
    { withCredentials: true },
  );
  source.addEventListener("update", (event) => {
    const generation = JSON.parse(
      (event as MessageEvent<string>).data,
    ) as Generation;
    onUpdate(generation);
    if (generation.status !== "PROCESSING") source.close();
  });
  return () => source.close();
}

export async function downloadFile(key: string): Promise<Blob> {
  const response = await fetch(
    `${API_BASE_URL}/api/generations/download?key=${encodeURIComponent(key)}`,
    { credentials: "include" },
  );
  if (!response.ok) throw new Error("Unable to download the file");
  return response.blob();
}

export async function saveFile(key: string, filename: string) {
  const blob = await downloadFile(key);
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}
