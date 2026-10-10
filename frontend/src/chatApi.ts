import { API_BASE_URL } from "./api";
import type { ChatConversation, ChatConversationSummary } from "./types";

export type ChatModel = string;

export type ChatStreamEvent =
  | { type: "delta"; text: string }
  | { type: "complete" }
  | { type: "error"; message: string };

function chatPath(pageId?: string) {
  return pageId ? `/api/pages/${pageId}/chats` : "/api/chats";
}

async function readError(response: Response) {
  const body = await response.json().catch(() => null);
  return body?.detail ?? body?.message ?? "Unable to complete the request";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    ...init,
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return response.json() as Promise<T>;
}

export function listConversations(pageId?: string) {
  return request<ChatConversationSummary[]>(chatPath(pageId));
}

export function listChatModels() {
  return request<string[]>("/api/chat/models");
}

export function listAllConversations() {
  return request<ChatConversationSummary[]>("/api/chats/all");
}

export function getConversation(conversationId: string, pageId?: string) {
  return request<ChatConversation>(`${chatPath(pageId)}/${conversationId}`);
}

export function createConversation(model: ChatModel, pageId?: string) {
  return request<ChatConversation>(chatPath(pageId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model }),
  });
}

export async function deleteConversation(conversationId: string, pageId?: string) {
  const response = await fetch(`${API_BASE_URL}${chatPath(pageId)}/${conversationId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
}

export async function streamMessage(
  conversationId: string,
  content: string,
  model: ChatModel,
  onEvent: (event: ChatStreamEvent) => void,
  pageId?: string,
) {
  const response = await fetch(
    `${API_BASE_URL}${chatPath(pageId)}/${conversationId}/messages/stream`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ content, model }),
    },
  );
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  if (!response.body) {
    throw new Error("The chat response could not be streamed");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const frames = buffer.split(/\r?\n\r?\n/);
    buffer = frames.pop() ?? "";
    frames.forEach((frame) => {
      const event = parseSseFrame(frame);
      if (event) onEvent(event);
    });
    if (done) break;
  }

  const finalEvent = parseSseFrame(buffer);
  if (finalEvent) onEvent(finalEvent);
}

export function parseSseFrame(frame: string): ChatStreamEvent | null {
  if (!frame.trim()) return null;
  let eventType = "";
  const data: string[] = [];
  frame.split(/\r?\n/).forEach((line) => {
    if (line.startsWith("event:")) {
      eventType = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      data.push(line.slice(5).trim());
    }
  });

  if (!eventType || data.length === 0) return null;
  const payload = JSON.parse(data.join("\n")) as { text?: string; message?: string };
  if (eventType === "delta" && typeof payload.text === "string") {
    return { type: "delta", text: payload.text };
  }
  if (eventType === "complete") return { type: "complete" };
  if (eventType === "error" && typeof payload.message === "string") {
    return { type: "error", message: payload.message };
  }
  return null;
}
