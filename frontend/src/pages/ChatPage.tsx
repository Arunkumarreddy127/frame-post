import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  CHAT_MODELS,
  type ChatModel,
  createConversation,
  deleteConversation,
  getConversation,
  listAllConversations,
  listConversations,
  streamMessage,
} from "../chatApi";
import { AppShell } from "../components/AppShell";
import type {
  ChatConversation,
  ChatConversationSummary,
  ChatMessage,
  ShellRouteProps,
} from "../types";

type ChatPageProps = ShellRouteProps & {
  pageId?: string;
};

const initialModel: ChatModel = "gpt-5-mini";

export function ChatPage({ user, onLogout, pageId }: ChatPageProps) {
  const [conversations, setConversations] = useState<ChatConversationSummary[]>([]);
  const [conversation, setConversation] = useState<ChatConversation | null>(null);
  const [model, setModel] = useState<ChatModel>(initialModel);
  const [draft, setDraft] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [showAllChats, setShowAllChats] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedConversationId = searchParams.get("conversation");

  const isPageChat = Boolean(pageId);

  useEffect(() => {
    let active = true;

    async function loadInitialConversations() {
      setLoading(true);
      setConversation(null);
      setConversations([]);
      setError("");
      setShowAllChats(false);
      try {
        const loaded = await listConversations(pageId);
        if (!active) return;
        setConversations(loaded);
        const selectedConversation =
          loaded.find((item) => item.id === requestedConversationId) ?? loaded[0];
        if (selectedConversation) {
          await loadConversation(selectedConversation.id, active);
        }
      } catch (requestError) {
        if (active) setError(messageFrom(requestError, "Unable to load conversations"));
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadInitialConversations();
    return () => {
      active = false;
    };
  }, [pageId, requestedConversationId]);

  async function loadConversation(conversationId: string, active = true) {
    setError("");
    try {
      const loaded = await getConversation(conversationId, pageId);
      if (!active) return;
      setConversation(loaded);
      setModel(loaded.model as ChatModel);
    } catch (requestError) {
      if (active) setError(messageFrom(requestError, "Unable to load conversation"));
    }
  }

  async function refreshConversations() {
    const loaded = showAllChats
      ? await listAllConversations()
      : await listConversations(pageId);
    setConversations(loaded);
  }

  async function toggleAllChats() {
    const nextShowAllChats = !showAllChats;
    setShowAllChats(nextShowAllChats);
    setError("");
    try {
      const loaded = nextShowAllChats
        ? await listAllConversations()
        : await listConversations();
      setConversations(loaded);
    } catch (requestError) {
      setError(messageFrom(requestError, "Unable to load conversations"));
    }
  }

  async function selectConversation(item: ChatConversationSummary) {
    if (showAllChats && item.pageId) {
      navigate(`/pages/${item.pageId}/chat?conversation=${item.id}`);
      return;
    }
    await loadConversation(item.id);
  }

  async function startConversation() {
    setError("");
    try {
      const created = await createConversation(model, pageId);
      setConversations((current) => [created, ...current]);
      setConversation(created);
      setStreamingText("");
    } catch (requestError) {
      setError(messageFrom(requestError, "Unable to create a conversation"));
    }
  }

  async function removeConversation() {
    if (!conversation || sending) return;
    try {
      await deleteConversation(conversation.id, pageId);
      const remaining = conversations.filter((item) => item.id !== conversation.id);
      setConversations(remaining);
      setConversation(null);
      setStreamingText("");
      if (remaining[0]) {
        await loadConversation(remaining[0].id);
      }
    } catch (requestError) {
      setError(messageFrom(requestError, "Unable to delete conversation"));
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;

    setSending(true);
    setError("");
    setDraft("");
    let selectedConversation = conversation;

    try {
      if (!selectedConversation) {
        const createdConversation = await createConversation(model, pageId);
        selectedConversation = createdConversation;
        setConversations((current) => [createdConversation, ...current]);
        setConversation(createdConversation);
      }

      const temporaryMessage: ChatMessage = {
        id: `pending-${Date.now()}`,
        role: "user",
        content,
        model: null,
        status: "completed",
        createdAt: new Date().toISOString(),
      };
      setConversation((current) =>
        current
          ? { ...current, messages: [...current.messages, temporaryMessage] }
          : current,
      );
      setStreamingText("");

      await streamMessage(
        selectedConversation.id,
        content,
        model,
        (streamEvent) => {
          if (streamEvent.type === "delta") {
            setStreamingText((current) => current + streamEvent.text);
          } else if (streamEvent.type === "error") {
            setError(streamEvent.message);
          }
        },
        pageId,
      );
      await Promise.all([loadConversation(selectedConversation.id), refreshConversations()]);
    } catch (requestError) {
      setError(messageFrom(requestError, "Unable to send message"));
      if (selectedConversation) {
        await Promise.all([
          loadConversation(selectedConversation.id),
          refreshConversations(),
        ]).catch(() => undefined);
      }
    } finally {
      setStreamingText("");
      setSending(false);
    }
  }

  return (
    <AppShell
      user={user}
      onLogout={onLogout}
      pageTitle="Chat"
      sidebar={isPageChat ? "page" : "global"}
      pageId={pageId}
      backTo={isPageChat ? "/pages" : undefined}
    >
      <section className="chat-page">
        <aside className="chat-history" aria-label="Chat history">
          <div className="chat-history-header">
            <span className="sidebar-section-label">Conversations</span>
            <button
              className="secondary-button small-button"
              type="button"
              onClick={() => void startConversation()}
              disabled={sending}
            >
              New chat
            </button>
          </div>
          {!isPageChat && (
            <button
              className={showAllChats ? "chat-history-filter active" : "chat-history-filter"}
              type="button"
              disabled={sending}
              onClick={() => void toggleAllChats()}
            >
              {showAllChats ? "Global chats" : "All chats"}
            </button>
          )}
          {loading ? (
            <p className="chat-history-status">Loading chats...</p>
          ) : conversations.length === 0 ? (
            <p className="chat-history-status">No chats yet.</p>
          ) : (
            <div className="chat-history-list">
              {conversations.map((item) => (
                <button
                  key={item.id}
                  className={
                    item.id === conversation?.id
                      ? "chat-history-item active"
                      : "chat-history-item"
                  }
                  type="button"
                  disabled={sending}
                  onClick={() => void selectConversation(item)}
                >
                  <span>{item.title}</span>
                  {showAllChats && (
                    <span className="chat-history-scope">
                      {item.pageName ?? "Global chat"}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </aside>
        <div className="chat-workspace">
          <div className="chat-toolbar">
            <div>
              <p className="eyebrow">
                {isPageChat ? "Page workspace" : "Private workspace"}
              </p>
              <h2>{conversation?.title ?? "New chat"}</h2>
            </div>
            <div className="chat-toolbar-actions">
              <label className="chat-model-label">
                Model
                <select
                  value={model}
                  disabled={sending}
                  onChange={(event) => setModel(event.target.value as ChatModel)}
                >
                  {CHAT_MODELS.map((chatModel) => (
                    <option key={chatModel} value={chatModel}>
                      {chatModel}
                    </option>
                  ))}
                </select>
              </label>
              {conversation && (
                <button
                  className="secondary-button small-button danger-button"
                  type="button"
                  disabled={sending}
                  onClick={() => void removeConversation()}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
          <div className="chat-transcript" aria-live="polite">
            {!conversation && !loading ? (
              <div className="chat-empty-state">
                <p>Ask anything to start a new conversation.</p>
              </div>
            ) : (
              <>
                {conversation?.messages.map((message) => (
                  <article
                    className={`chat-message ${message.role} ${
                      message.status === "failed" ? "failed" : ""
                    }`}
                    key={message.id}
                  >
                    <span className="chat-message-role">{message.role}</span>
                    <p>{message.content}</p>
                    {message.status === "failed" && (
                      <span className="chat-message-status">Response failed</span>
                    )}
                  </article>
                ))}
                {streamingText && (
                  <article className="chat-message assistant streaming">
                    <span className="chat-message-role">assistant</span>
                    <p>{streamingText}</p>
                  </article>
                )}
              </>
            )}
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <form className="chat-composer" onSubmit={submit}>
            <label className="sr-only" htmlFor="chat-message">
              Message
            </label>
            <textarea
              id="chat-message"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Message Framepost"
              rows={3}
              maxLength={8000}
              disabled={sending}
              required
            />
            <button
              className="primary-button"
              type="submit"
              disabled={sending || !draft.trim()}
            >
              {sending ? "Responding..." : "Send"}
            </button>
          </form>
        </div>
      </section>
    </AppShell>
  );
}

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
