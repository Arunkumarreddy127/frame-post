import { API_BASE_URL } from "./api";
import type {
  ChatConversation,
  ChatConversationSummary,
  InstructionFileProposal,
} from "./types";

export type ChatModel = string;

export type ChatStreamEvent =
  | { type: "delta"; text: string }
  | { type: "instruction_proposal"; proposal: InstructionFileProposal }
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

export function updateConversationTitle(
  conversationId: string,
  title: string,
  pageId?: string,
) {
  return request<ChatConversation>(`${chatPath(pageId)}/${conversationId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
}

export function createConversation(model: ChatModel, pageId?: string) {
  return request<ChatConversation>(chatPath(pageId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model }),
  });
}

export function updateConversationInstructions(
  conversationId: string,
  instructionFileIds: string[],
  pageId?: string,
) {
  return request<ChatConversation>(`${chatPath(pageId)}/${conversationId}/instructions`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ instructionFileIds }),
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
  const payload = JSON.parse(data.join("\n")) as Record<string, unknown>;
  
  // Check for update proposal
  if (
    eventType === "instruction_proposal" &&
    typeof payload.fileId === "string" &&
    typeof payload.fileName === "string" &&
    typeof payload.currentContent === "string" &&
    typeof payload.proposedContent === "string"
  ) {
    return {
      type: "instruction_proposal",
      proposal: {
        fileId: payload.fileId,
        fileName: payload.fileName,
        currentContent: payload.currentContent,
        proposedContent: payload.proposedContent,
      },
    } as const;
  }
  
  // Check for creation proposal
  if (
    eventType === "instruction_proposal" &&
    typeof payload.name === "string" &&
    typeof payload.content === "string" &&
    !("fileId" in payload)
  ) {
    return {
      type: "instruction_proposal",
      proposal: {
        name: payload.name,
        content: payload.content,
      },
    } as const;
  }
  if (eventType === "delta" && typeof payload.text === "string") {
    return { type: "delta", text: payload.text };
  }
  if (eventType === "complete") return { type: "complete" };
  if (eventType === "error" && typeof payload.message === "string") {
    return { type: "error", message: payload.message };
  }
  return null;
}
