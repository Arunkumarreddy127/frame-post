import { API_BASE_URL } from "./api";

export type RunningHubGenerationStatus = "PROCESSING" | "COMPLETED" | "FAILED";

export type RunningHubInputType = "image" | "video" | "text" | "textarea" | "select" | "number";

export type RunningHubInput = {
  name: string;
  type: RunningHubInputType;
  label: string;
  required: boolean;
  accept: string[] | null;
  maxBytes: number | null;
  maxLength: number | null;
  options: (string | number)[] | null;
  default: string | number | null;
  min: number | null;
  max: number | null;
};

export type RunningHubWorkflow = {
  key: string;
  label: string;
  description: string;
  group: string;
  configured: boolean;
  inputs: RunningHubInput[];
  outputType: string;
  outputContentType: string;
};

export type RunningHubGeneration = {
  id: string;
  pageId: string | null;
  workflowKey: string;
  status: RunningHubGenerationStatus;
  error: string | null;
  inputs: Record<string, string>;
  inputUrls: Record<string, string>;
  resultType: string | null;
  resultUrl: string | null;
  resultContentType: string | null;
  createdAt: string;
};

function generationsPath(pageId: string, workflowKey: string) {
  return `/api/pages/${pageId}/runninghub/${workflowKey}/generations`;
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

export function listRunningHubWorkflows() {
  return request<RunningHubWorkflow[]>("/api/runninghub/workflows");
}

export function listRunningHubGenerations(pageId: string, workflowKey: string) {
  return request<RunningHubGeneration[]>(generationsPath(pageId, workflowKey));
}

export function subscribeToRunningHubGeneration(
  pageId: string,
  workflowKey: string,
  id: string,
  onUpdate: (generation: RunningHubGeneration) => void,
): () => void {
  const source = new EventSource(`${API_BASE_URL}${generationsPath(pageId, workflowKey)}/${id}/events`, {
    withCredentials: true,
  });
  source.addEventListener("update", (event) => {
    const generation = JSON.parse((event as MessageEvent<string>).data) as RunningHubGeneration;
    onUpdate(generation);
    if (generation.status !== "PROCESSING") {
      source.close();
    }
  });
  return () => source.close();
}

export type GenerateRunningHubInput = {
  values: Record<string, string>;
  files: Record<string, File>;
};

/**
 * Sends one multipart part per input, named after the input in the workflow definition.
 */
export function generateRunningHub(pageId: string, workflowKey: string, input: GenerateRunningHubInput) {
  const formData = new FormData();
  Object.entries(input.values).forEach(([name, value]) => formData.append(name, value));
  Object.entries(input.files).forEach(([name, file]) => formData.append(name, file));
  return request<RunningHubGeneration>(generationsPath(pageId, workflowKey), {
    method: "POST",
    body: formData,
  });
}
