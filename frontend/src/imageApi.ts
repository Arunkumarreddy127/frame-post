import { API_BASE_URL } from "./api";

export type ImageResult = { key: string; url: string };

export type ImageGeneration = {
  id: string;
  pageId: string | null;
  prompt: string;
  model: string;
  size: string;
  quality: string;
  imageCount: number;
  outputFormat: string;
  background: string;
  moderation: string;
  partialImages: string;
  inputKeys: string[];
  inputs: ImageResult[];
  results: ImageResult[];
  status: "COMPLETED" | "FAILED";
  error: string | null;
  createdAt: string;
  parentGenerationId: string | null;
  parentResultKey: string | null;
};

export type GenerateImagesInput = {
  prompt: string;
  model: string;
  size: string;
  quality: string;
  count: number;
  attachments: File[];
  parentGenerationId?: string;
  parentResultKey?: string;
};

function imagesPath(pageId?: string) {
  return pageId ? `/api/pages/${pageId}/images` : "/api/images";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    ...init,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail ?? body?.message ?? "Unable to complete the request");
  }
  return response.json() as Promise<T>;
}

export function listImageModels() {
  return request<string[]>("/api/images/models");
}

export function listImageGenerations(pageId?: string) {
  return request<ImageGeneration[]>(imagesPath(pageId));
}

export function generateImages(input: GenerateImagesInput, pageId?: string) {
  const form = new FormData();
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
  return request<ImageGeneration>(`${imagesPath(pageId)}/generate`, {
    method: "POST",
    body: form,
  });
}

export async function deleteImageGeneration(id: string, pageId?: string) {
  const response = await fetch(`${API_BASE_URL}${imagesPath(pageId)}/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail ?? body?.message ?? "Unable to delete the image");
  }
}
