import { FormEvent, useEffect, useState, type KeyboardEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowUp, ChevronDown, Pencil, Plus } from "lucide-react";
import {
  type ChatModel,
  createConversation,
  deleteConversation,
  getConversation,
  listChatModels,
  listAllConversations,
  listConversations,
  streamMessage,
  updateConversationInstructions,
  updateConversationTitle,
} from "../chatApi";
import { API_BASE_URL } from "../api";
import { AppShell } from "../components/AppShell";
import { InstructionFiles } from "../components/InstructionFiles";
import { updateInstructionFile } from "../instructionApi";
import type {
  ChatConversation,
  ChatConversationSummary,
  ChatMessage,
  InstructionFileProposal,
  InstructionProposal,
  InstructionCreationProposal,
  ShellRouteProps,
} from "../types";

type ChatPageProps = ShellRouteProps & {
  pageId?: string;
};

export function ChatPage({ user, onLogout, pageId }: ChatPageProps) {
  const { pageId: routePageId } = useParams<{ pageId?: string }>();
  const activePageId = pageId ?? routePageId;
  const [chatModels, setChatModels] = useState<ChatModel[]>([]);
  const [conversations, setConversations] = useState<ChatConversationSummary[]>([]);
  const [conversation, setConversation] = useState<ChatConversation | null>(null);
  const [model, setModel] = useState<ChatModel>("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  const [draft, setDraft] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [showAllChats, setShowAllChats] = useState(false);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [proposals, setProposals] = useState<InstructionFileProposal[]>([]);
  const [filesRefreshKey, setFilesRefreshKey] = useState(0);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedConversationId = searchParams.get("conversation");

  const isPageChat = Boolean(activePageId);

  useEffect(() => {
    let active = true;

    async function loadInitialConversations() {
      setLoading(true);
      setConversation(null);
      setEditingTitle(false);
      setTitleDraft("");
      setConversations([]);
      setError("");
      setShowAllChats(false);
      try {
        const [availableModels, loaded] = await Promise.all([
          listChatModels(),
          listConversations(activePageId),
        ]);
        if (!active) return;
        setChatModels(availableModels);
        setModel(availableModels[0] ?? "");
        setConversations(loaded);
        const selectedConversation =
          loaded.find((item) => item.id === requestedConversationId) ?? loaded[0];
        if (selectedConversation) {
          await loadConversation(selectedConversation.id, active, availableModels);
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
  }, [activePageId, requestedConversationId]);

  useEffect(() => {
    setSelectedFileIds(conversation?.instructionFileIds ?? []);
    setProposals([]);
  }, [conversation?.id]);

  async function changeSelection(ids: string[]) {
    setSelectedFileIds(ids);
    if (!conversation) return;
    try {
      const updated = await updateConversationInstructions(conversation.id, ids, activePageId);
      setConversation((current) =>
        current && current.id === updated.id
          ? { ...current, instructionFileIds: updated.instructionFileIds }
          : current,
      );
    } catch (requestError) {
      setError(messageFrom(requestError, "Unable to update instruction files"));
    }
  }

  async function withSelection(created: ChatConversation) {
    if (selectedFileIds.length === 0) return created;
    try {
      return await updateConversationInstructions(created.id, selectedFileIds, activePageId);
    } catch (requestError) {
      setError(messageFrom(requestError, "Unable to update instruction files"));
      return created;
    }
  }

  async function applyProposal(proposal: InstructionFileProposal) {
    try {
      if ("fileId" in proposal) {
        // Update existing file
        await updateInstructionFile(proposal.fileId, {
          name: proposal.fileName,
          content: proposal.proposedContent,
        });
      } else {
        // Create new file
        const path = activePageId
          ? `/api/pages/${activePageId}/chats/instruction-proposals`
          : `/api/chats/instruction-proposals`;
        const response = await fetch(`${API_BASE_URL}${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ name: proposal.name, content: proposal.content }),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.detail ?? body?.message ?? "Unable to create instruction file");
        }
      }
      setProposals((current) => current.filter((item) => item !== proposal));
      setFilesRefreshKey((current) => current + 1);
    } catch (requestError) {
      setError(messageFrom(requestError, "Unable to apply the instruction proposal"));
    }
  }

  async function loadConversation(
    conversationId: string,
    active = true,
    availableModels = chatModels,
  ) {
    setError("");
    try {
      const loaded = await getConversation(conversationId, activePageId);
      if (!active) return;
      setConversation(loaded);
      setEditingTitle(false);
      setModel(
        availableModels.includes(loaded.model)
          ? loaded.model
          : availableModels[0] ?? "",
      );
    } catch (requestError) {
      if (active) setError(messageFrom(requestError, "Unable to load conversation"));
    }
  }

  async function refreshConversations() {
    const loaded = showAllChats
      ? await listAllConversations()
      : await listConversations(activePageId);
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
    if (!model) {
      setError("No chat models are available");
      return;
    }
    try {
      const created = await withSelection(await createConversation(model, activePageId));
      setConversations((current) => [created, ...current]);
      setConversation(created);
      setEditingTitle(false);
      setTitleDraft("");
      setStreamingText("");
    } catch (requestError) {
      setError(messageFrom(requestError, "Unable to create a conversation"));
    }
  }

  async function removeConversation() {
    if (!conversation || sending) return;
    try {
      await deleteConversation(conversation.id, activePageId);
      const remaining = conversations.filter((item) => item.id !== conversation.id);
      setConversations(remaining);
      setConversation(null);
      setEditingTitle(false);
      setTitleDraft("");
      setStreamingText("");
      if (remaining[0]) {
        await loadConversation(remaining[0].id);
      }
    } catch (requestError) {
      setError(messageFrom(requestError, "Unable to delete conversation"));
    }
  }

  function beginTitleEdit() {
    if (!conversation || sending || savingTitle) return;
    setTitleDraft(conversation.title);
    setEditingTitle(true);
  }

  function cancelTitleEdit() {
    if (savingTitle) return;
    setEditingTitle(false);
    setTitleDraft("");
  }

  async function saveTitle() {
    if (!conversation || savingTitle) return;
    const title = titleDraft.trim();
    if (!title) {
      setError("Conversation title is required");
      return;
    }
    if (title === conversation.title) {
      cancelTitleEdit();
      return;
    }

    setSavingTitle(true);
    setError("");
    try {
      const updated = await updateConversationTitle(
        conversation.id,
        title,
        activePageId,
      );
      setConversation(updated);
      setConversations((current) =>
        current.map((item) =>
          item.id === updated.id
            ? { ...item, title: updated.title, updatedAt: updated.updatedAt }
            : item,
        ),
      );
      setEditingTitle(false);
      setTitleDraft("");
    } catch (requestError) {
      setError(messageFrom(requestError, "Unable to update conversation title"));
    } finally {
      setSavingTitle(false);
    }
  }

  function handleTitleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      void saveTitle();
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancelTitleEdit();
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || sending || !model) return;

    setSending(true);
    setError("");
    setDraft("");
    let selectedConversation = conversation;

    try {
      if (!selectedConversation) {
        const createdConversation = await withSelection(
          await createConversation(model, activePageId),
        );
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
          } else if (streamEvent.type === "instruction_proposal") {
            setProposals((current) => [...current, streamEvent.proposal]);
          } else if (streamEvent.type === "error") {
            setError(streamEvent.message);
          }
        },
        activePageId,
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
      pageId={activePageId}
      backTo={isPageChat ? "/pages" : undefined}
    >
      <section className="chat-page">
        <aside className="chat-sidebar" aria-label="Chat history">
          <div className="chat-history">
            <div className="chat-history-header">
              <button
                className="secondary-button small-button"
                type="button"
                onClick={() => void startConversation()}
                disabled={sending || !model}
              >
                <Plus className="chat-new-icon" size={17} strokeWidth={2} aria-hidden="true" />
                <span>New chat</span>
              </button>
            </div>
            {!isPageChat && (
              <label
                className="secondary-button small-button chat-all-chats-toggle"
              >
                <input
                  type="checkbox"
                  checked={showAllChats}
                  disabled={sending}
                  onChange={() => void toggleAllChats()}
                />
                <span>All chats</span>
              </label>
            )}
            {loading ? (
              <p className="chat-history-status">Loading chats...</p>
            ) : conversations.length === 0 ? (
              <p className="chat-history-status">No chats yet.</p>
            ) : (
              <div className="chat-history-list">
                <span className="sidebar-section-label">History</span>
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
                      <span className={`chat-history-scope ${scopeColorClass(item.pageId)}`}>
                        {item.pageName ?? "Global chat"}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          <InstructionFiles
            pageId={activePageId}
            selectedIds={selectedFileIds}
            disabled={sending}
            refreshKey={filesRefreshKey}
            onSelectionChange={(ids) => void changeSelection(ids)}
            onError={setError}
          />
        </aside>
        <div className="chat-workspace">
          <div className="chat-toolbar">
            <div className="chat-title">
              {editingTitle ? (
                <input
                  className="chat-title-input"
                  value={titleDraft}
                  maxLength={120}
                  autoFocus
                  disabled={savingTitle}
                  onChange={(event) => setTitleDraft(event.target.value)}
                  onBlur={() => void saveTitle()}
                  onKeyDown={handleTitleKeyDown}
                  aria-label="Conversation title"
                />
              ) : (
                <>
                  <h2>{conversation?.title ?? "New chat"}</h2>
                  {conversation && (
                    <button
                      className="chat-title-edit"
                      type="button"
                      onClick={beginTitleEdit}
                      disabled={sending || savingTitle}
                      aria-label="Edit conversation title"
                      title="Edit conversation title"
                    >
                      <Pencil size={15} strokeWidth={2} aria-hidden="true" />
                    </button>
                  )}
                </>
              )}
            </div>
            <div className="chat-toolbar-actions">
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
                {proposals.map((proposal) => {
                  const key =
                    "fileId" in proposal
                      ? `${proposal.fileId}-${proposal.proposedContent}`
                      : `create-${proposal.name}`;
                  const isUpdate = "fileId" in proposal;
                  const title = isUpdate ? `Proposed update: ${proposal.fileName}` : `Proposed new file: ${proposal.name}`;

                  return (
                    <article
                      className="chat-message assistant instruction-proposal"
                      key={key}
                    >
                      <span className="chat-message-role">{title}</span>
                      {isUpdate && (
                        <div className="instruction-proposal-diff">
                          <div>
                            <strong>Current</strong>
                            <pre>{proposal.currentContent}</pre>
                          </div>
                          <div>
                            <strong>Proposed</strong>
                            <pre>{proposal.proposedContent}</pre>
                          </div>
                        </div>
                      )}
                      {!isUpdate && (
                        <div className="instruction-proposal-content">
                          <strong>Content</strong>
                          <pre>{proposal.content}</pre>
                        </div>
                      )}
                      <div className="instruction-editor-actions">
                        <button
                          className="secondary-button small-button"
                          type="button"
                          onClick={() => void applyProposal(proposal)}
                        >
                          Apply
                        </button>
                        <button
                          className="secondary-button small-button"
                          type="button"
                          onClick={() =>
                            setProposals((current) => current.filter((item) => item !== proposal))
                          }
                        >
                          Dismiss
                        </button>
                      </div>
                    </article>
                  );
                })}
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
              placeholder="Pitch your idea"
              rows={2}
              maxLength={8000}
              disabled={sending}
              required
            />
            <div className="chat-composer-toolbar">
              <label className="chat-model-control">
                <span className="sr-only">Model</span>
                <span className="chat-model-select">
                  <select
                    value={model}
                    disabled={sending || chatModels.length === 0}
                    onChange={(event) => setModel(event.target.value)}
                  >
                    {chatModels.map((chatModel) => (
                      <option key={chatModel} value={chatModel}>
                        {chatModel}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="chat-model-chevron"
                    size={14}
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                </span>
              </label>
              <button
                className="chat-composer-submit"
                type="submit"
                aria-label={sending ? "Responding" : "Send message"}
                disabled={sending || !draft.trim()}
              >
                <ArrowUp size={19} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
          </form>
        </div>
      </section>
    </AppShell>
  );
}

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function scopeColorClass(pageId: string | null) {
  if (!pageId) return "scope-color-global";

  let hash = 0;
  for (const character of pageId) {
    hash = (hash * 31 + character.charCodeAt(0)) % 6;
  }
  return `scope-color-${hash}`;
}
