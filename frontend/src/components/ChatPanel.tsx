import {
  FormEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUp,
  ChevronDown,
  FileText,
  FolderOpen,
  Paperclip,
  Pencil,
  RotateCcw,
  Square,
  X,
} from "lucide-react";
import {
  type ChatStreamEvent,
  type ChatModel,
  createConversation,
  deleteConversation,
  editMessageAndStream,
  getConversation,
  listChatModels,
  listAllConversations,
  listConversations,
  retryAssistantResponse,
  streamMessage,
  updateConversationInstructions,
  updateConversationTitle,
} from "../chatApi";
import { API_BASE_URL } from "../api";
import { ChatInstructionPicker } from "./ChatInstructionPicker";
import { ChatMarkdown, ChatMessageCopyButton } from "./ChatMarkdown";
import { useConfirm } from "./ConfirmDialog";
import { LibraryPicker } from "./library/LibraryPicker";
import {
  notifyInstructionFilesChanged,
  updateInstructionFile,
} from "../instructionApi";
import type {
  ChatConversation,
  ChatConversationSummary,
  ChatMessage,
  InstructionFile,
  InstructionFileProposal,
  InstructionProposal,
  InstructionCreationProposal,
  MediaItem,
} from "../types";

type ChatPanelProps = {
  pageId?: string;
};

type ChatView = "list" | "conversation";

const CHAT_ATTACHMENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
];
const MAX_CHAT_ATTACHMENTS = 4;
const MAX_CHAT_ATTACHMENT_BYTES = 20 * 1024 * 1024;

export function ChatPanel({ pageId }: ChatPanelProps) {
  const activePageId = pageId;
  const [view, setView] = useState<ChatView>("list");
  const [chatModels, setChatModels] = useState<ChatModel[]>([]);
  const [conversations, setConversations] = useState<ChatConversationSummary[]>(
    [],
  );
  const [conversation, setConversation] = useState<ChatConversation | null>(
    null,
  );
  const [model, setModel] = useState<ChatModel>("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  const [draft, setDraft] = useState("");
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [libraryImages, setLibraryImages] = useState<MediaItem[]>([]);
  const [libraryPickerOpen, setLibraryPickerOpen] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [showAllChats, setShowAllChats] = useState(false);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [instructionFiles, setInstructionFiles] = useState<InstructionFile[]>([]);
  const [proposals, setProposals] = useState<InstructionFileProposal[]>([]);
  const { confirm, dialog: confirmDialog } = useConfirm();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fileInput = useRef<HTMLInputElement>(null);
  const messageInput = useRef<HTMLTextAreaElement>(null);
  const transcript = useRef<HTMLDivElement>(null);
  const streamController = useRef<AbortController | null>(null);
  const requestedConversationId = searchParams.get("conversation");

  const isPageChat = Boolean(activePageId);
  const attachmentCount = attachmentFiles.length + libraryImages.length;
  const selectedInstructionFiles = instructionFiles.filter((file) =>
    selectedFileIds.includes(file.id),
  );
  const messageBeingEdited = conversation?.messages.find(
    (message) => message.id === editingMessageId,
  );

  useEffect(
    () => () => streamController.current?.abort(),
    [],
  );

  useLayoutEffect(() => {
    const textarea = messageInput.current;
    if (!textarea) return;

    const styles = window.getComputedStyle(textarea);
    const lineHeight = Number.parseFloat(styles.lineHeight);
    const verticalPadding =
      Number.parseFloat(styles.paddingTop) +
      Number.parseFloat(styles.paddingBottom);
    const minHeight = lineHeight * 2 + verticalPadding;
    const maxHeight = lineHeight * 10 + verticalPadding;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.max(
      minHeight,
      Math.min(textarea.scrollHeight, maxHeight),
    )}px`;
    textarea.style.overflowY =
      textarea.scrollHeight > textarea.clientHeight ? "auto" : "hidden";
  }, [draft]);

  useLayoutEffect(() => {
    if (view !== "conversation" || !conversation) return;
    const element = transcript.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [view, conversation?.id]);

  useEffect(() => {
    let active = true;

    async function loadInitialConversations() {
      setLoading(true);
      setConversation(null);
      setEditingTitle(false);
      setTitleDraft("");
      setConversations([]);
      setView("list");
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
        const requestedConversation = loaded.find(
          (item) => item.id === requestedConversationId,
        );
        if (requestedConversation) {
          await loadConversation(
            requestedConversation.id,
            active,
            availableModels,
          );
          if (active) setView("conversation");
        }
      } catch (requestError) {
        if (active)
          setError(messageFrom(requestError, "Unable to load conversations"));
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
      const updated = await updateConversationInstructions(
        conversation.id,
        ids,
        activePageId,
      );
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
      return await updateConversationInstructions(
        created.id,
        selectedFileIds,
        activePageId,
      );
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
          body: JSON.stringify({
            name: proposal.name,
            content: proposal.content,
          }),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(
            body?.detail ??
              body?.message ??
              "Unable to create instruction file",
          );
        }
      }
      setProposals((current) => current.filter((item) => item !== proposal));
      notifyInstructionFilesChanged();
    } catch (requestError) {
      setError(
        messageFrom(requestError, "Unable to apply the instruction proposal"),
      );
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
      if (!active) return false;
      setConversation(loaded);
      setEditingMessageId(null);
      setEditingTitle(false);
      setModel(
        availableModels.includes(loaded.model)
          ? loaded.model
          : (availableModels[0] ?? ""),
      );
      return true;
    } catch (requestError) {
      if (active)
        setError(messageFrom(requestError, "Unable to load conversation"));
      return false;
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
      navigate(`/pages/${item.pageId}?conversation=${item.id}`);
      return;
    }
    if (await loadConversation(item.id)) setView("conversation");
  }

  function backToList() {
    if (sending) return;
    setError("");
    setEditingMessageId(null);
    setConversation(null);
    setEditingTitle(false);
    setTitleDraft("");
    setStreamingText("");
    setView("list");
  }

  async function removeConversation() {
    if (!conversation || sending) return;
    const accepted = await confirm({
      title: `Delete “${conversation.title}”?`,
      message: "This conversation will be permanently deleted. This cannot be undone.",
      confirmLabel: "Delete conversation",
      danger: true,
    });
    if (!accepted) return;
    try {
      await deleteConversation(conversation.id, activePageId);
      const remaining = conversations.filter(
        (item) => item.id !== conversation.id,
      );
      setConversations(remaining);
      setConversation(null);
      setEditingMessageId(null);
      setEditingTitle(false);
      setTitleDraft("");
      setStreamingText("");
      setView("list");
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
      setError(
        messageFrom(requestError, "Unable to update conversation title"),
      );
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

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  function addAttachments(files: FileList | null) {
    if (!files) return;
    const selected = Array.from(files);
    if (fileInput.current) fileInput.current.value = "";
    const valid = selected.filter(
      (file) => {
        const type = file.type.toLowerCase();
        const isPdf =
          type === "application/pdf" ||
          ((type === "" || type === "application/octet-stream") &&
            file.name.toLowerCase().endsWith(".pdf"));
        return (
          (CHAT_ATTACHMENT_TYPES.includes(type) || isPdf) &&
          file.size <= MAX_CHAT_ATTACHMENT_BYTES
        );
      },
    );
    setAttachmentFiles((current) =>
      [...current, ...valid].slice(
        0,
        Math.max(0, MAX_CHAT_ATTACHMENTS - libraryImages.length),
      ),
    );
    if (valid.length !== selected.length) {
      setError(
        "Choose PNG, JPEG, or WebP images, or PDF files up to 20 MB each.",
      );
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    const messageToEdit = editingMessageId
      ? conversation?.messages.find((message) => message.id === editingMessageId)
      : undefined;
    if (
      (!content &&
        attachmentCount === 0 &&
        !messageToEdit?.attachments.length) ||
      sending ||
      !model
    ) {
      return;
    }
    if (editingMessageId && !messageToEdit) {
      setError("The message being edited is no longer available");
      return;
    }

    setSending(true);
    setError("");
    setDraft("");
    setEditingMessageId(null);
    setStreamingText("");
    const controller = new AbortController();
    streamController.current = controller;
    let selectedConversation = conversation;

    try {
      if (!selectedConversation) {
        const createdConversation = await withSelection(
          await createConversation(model, activePageId),
        );
        selectedConversation = createdConversation;
        setConversations((current) => [createdConversation, ...current]);
        setConversation(createdConversation);
        setView("conversation");
      }

      if (controller.signal.aborted) return;

      if (messageToEdit) {
        const messageIndex =
          selectedConversation.messages.findIndex(
            (message) => message.id === messageToEdit.id,
          );
        setConversation((current) =>
          current
            ? {
                ...current,
                messages: [
                  ...current.messages.slice(0, messageIndex),
                  { ...messageToEdit, content },
                ],
              }
            : current,
        );
        await editMessageAndStream(
          selectedConversation.id,
          messageToEdit.id,
          content,
          model,
          handleStreamEvent,
          activePageId,
          controller.signal,
        );
      } else {
        const temporaryMessage: ChatMessage = {
          id: `pending-${Date.now()}`,
          role: "user",
          content,
          model: null,
          status: "completed",
          createdAt: new Date().toISOString(),
          attachments: [],
        };
        setConversation((current) =>
          current
            ? { ...current, messages: [...current.messages, temporaryMessage] }
            : current,
        );
        await streamMessage(
          selectedConversation.id,
          content,
          model,
          handleStreamEvent,
          activePageId,
          attachmentFiles,
          libraryImages.map((item) => item.key),
          controller.signal,
        );
        setAttachmentFiles([]);
        setLibraryImages([]);
      }

      if (!controller.signal.aborted) {
        await Promise.all([
          loadConversation(selectedConversation.id),
          refreshConversations(),
        ]);
      }
    } catch (requestError) {
      const requestErrorMessage = controller.signal.aborted
        ? ""
        : messageFrom(requestError, "Unable to send message");
      if (selectedConversation) {
        await Promise.all([
          loadConversation(selectedConversation.id),
          refreshConversations(),
        ]).catch((refreshError) => {
          if (!requestErrorMessage) {
            setError(messageFrom(refreshError, "Unable to refresh conversation"));
          }
        });
      }
      if (requestErrorMessage) {
        setError(requestErrorMessage);
      }
    } finally {
      if (streamController.current === controller) {
        streamController.current = null;
      }
      setStreamingText("");
      setSending(false);
    }
  }

  function handleStreamEvent(streamEvent: ChatStreamEvent) {
    if (streamEvent.type === "delta") {
      setStreamingText((current) => current + streamEvent.text);
    } else if (streamEvent.type === "instruction_proposal") {
      setProposals((current) => [...current, streamEvent.proposal]);
    } else if (streamEvent.type === "error") {
      setError(streamEvent.message);
    }
  }

  function beginMessageEdit(message: ChatMessage) {
    if (sending || attachmentCount > 0) return;
    setEditingMessageId(message.id);
    setDraft(message.content);
    setError("");
    messageInput.current?.focus();
  }

  function cancelMessageEdit() {
    setEditingMessageId(null);
    setDraft("");
  }

  function stopGeneration() {
    streamController.current?.abort();
  }

  async function retryFailedReply(message: ChatMessage) {
    if (!conversation || sending) return;
    const failedIndex = conversation.messages.findIndex(
      (entry) => entry.id === message.id,
    );
    if (failedIndex < 0) return;

    setSending(true);
    setError("");
    setStreamingText("");
    setConversation((current) =>
      current
        ? { ...current, messages: current.messages.slice(0, failedIndex) }
        : current,
    );
    const controller = new AbortController();
    streamController.current = controller;

    try {
      await retryAssistantResponse(
        conversation.id,
        message.id,
        handleStreamEvent,
        activePageId,
        controller.signal,
      );
      if (!controller.signal.aborted) {
        await Promise.all([
          loadConversation(conversation.id),
          refreshConversations(),
        ]);
      }
    } catch (requestError) {
      const requestErrorMessage = controller.signal.aborted
        ? ""
        : messageFrom(requestError, "Unable to retry the response");
      await Promise.all([
        loadConversation(conversation.id),
        refreshConversations(),
      ]).catch((refreshError) => {
        if (!requestErrorMessage) {
          setError(messageFrom(refreshError, "Unable to refresh conversation"));
        }
      });
      if (requestErrorMessage) setError(requestErrorMessage);
    } finally {
      if (streamController.current === controller) {
        streamController.current = null;
      }
      setStreamingText("");
      setSending(false);
    }
  }

  const composer = (
    <form
      className={`chat-composer${attachmentCount > 0 || selectedInstructionFiles.length > 0 ? " has-attachments" : ""}${editingMessageId ? " is-editing" : ""}`}
      onSubmit={submit}
      aria-busy={sending}
    >
      {editingMessageId && (
        <div className="chat-editing-banner">
          <span>Editing message</span>
          <button type="button" onClick={cancelMessageEdit} disabled={sending}>
            Cancel
          </button>
        </div>
      )}
      {(attachmentCount > 0 || selectedInstructionFiles.length > 0) && (
        <div className="chat-attachment-tray">
          {selectedInstructionFiles.length > 0 && (
            <div
              className="chat-instruction-attachments"
              aria-label="Instruction files"
            >
              {selectedInstructionFiles.map((file) => (
                <div
                  className="chat-instruction-attachment"
                  key={file.id}
                  title={file.name}
                >
                  <FileText size={15} aria-hidden="true" />
                  <span>{file.name}</span>
                  <button
                    type="button"
                    className="chat-instruction-attachment-remove"
                    aria-label={`Remove ${file.name}`}
                    disabled={sending}
                    onClick={() =>
                      void changeSelection(
                        selectedFileIds.filter((id) => id !== file.id),
                      )
                    }
                  >
                    <X size={13} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {attachmentCount > 0 && (
            <div className="chat-media-attachments" aria-label="Message attachments">
              {attachmentFiles.map((file, index) => (
                <LocalAttachmentPreview
                  key={`${file.name}-${file.size}-${index}`}
                  file={file}
                  onRemove={() =>
                    setAttachmentFiles((current) =>
                      current.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                />
              ))}
              {libraryImages.map((item) => (
                <div className="chat-attachment-preview" key={item.key}>
                  <img src={item.url} alt={item.name} />
                  <button
                    type="button"
                    className="chat-attachment-remove"
                    aria-label={`Remove ${item.name}`}
                    onClick={() =>
                      setLibraryImages((current) =>
                        current.filter((entry) => entry.key !== item.key),
                      )
                    }
                  >
                    <X size={13} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <label className="sr-only" htmlFor="chat-message">
        Message
      </label>
      <textarea
        ref={messageInput}
        id="chat-message"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleComposerKeyDown}
        placeholder="Pitch your idea"
        rows={2}
        maxLength={8000}
        disabled={sending}
      />
      <div className="chat-composer-toolbar">
        <div className="chat-attachment-actions">
          <input
            ref={fileInput}
            className="sr-only"
            type="file"
            accept={`${CHAT_ATTACHMENT_TYPES.join(",")},.pdf`}
            multiple
            onChange={(event) => addAttachments(event.target.files)}
            aria-label="Attach images or PDFs"
          />
          <button
            type="button"
            className="chat-attachment-button"
            aria-label="Attach images or PDFs"
            title="Attach images or PDFs"
            disabled={
              sending ||
              Boolean(editingMessageId) ||
              attachmentCount >= MAX_CHAT_ATTACHMENTS
            }
            onClick={() => fileInput.current?.click()}
          >
            <Paperclip size={17} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="chat-attachment-button"
            aria-label="Browse Library"
            title="Browse Library"
            disabled={
              sending ||
              Boolean(editingMessageId) ||
              attachmentCount >= MAX_CHAT_ATTACHMENTS
            }
            onClick={() => setLibraryPickerOpen(true)}
          >
            <FolderOpen size={17} aria-hidden="true" />
          </button>
          {attachmentCount > 0 && (
            <span className="chat-attachment-count">
              {attachmentCount}/{MAX_CHAT_ATTACHMENTS}
            </span>
          )}
          <ChatInstructionPicker
            pageId={activePageId}
            selectedIds={selectedFileIds}
            disabled={sending}
            onSelectionChange={(ids) => void changeSelection(ids)}
            onFilesChange={setInstructionFiles}
            onError={setError}
          />
        </div>
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
        {sending ? (
          <button
            className="chat-stop-button"
            type="button"
            onClick={stopGeneration}
            aria-label="Stop generating"
            title="Stop generating"
          >
            <Square size={14} fill="currentColor" aria-hidden="true" />
            <span>Stop</span>
          </button>
        ) : (
          <button
            className="chat-composer-submit"
            type="submit"
            aria-label="Send message"
            disabled={
              !draft.trim() &&
              attachmentCount === 0 &&
              !messageBeingEdited?.attachments.length
            }
          >
            <ArrowUp size={19} strokeWidth={2} aria-hidden="true" />
          </button>
        )}
      </div>
    </form>
  );

  return (
    <section className="chat-panel" aria-label="Chat">
      {view === "list" ? (
        <aside className="chat-sidebar" aria-label="Chat history">
          <div className="chat-history">
            {!isPageChat && (
              <label className="secondary-button small-button chat-all-chats-toggle">
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
                    title={item.title}
                    onClick={() => void selectConversation(item)}
                  >
                    <span>{item.title}</span>
                    {showAllChats && (
                      <span
                        className={`chat-history-scope ${scopeColorClass(item.pageId)}`}
                      >
                        {item.pageName ?? "Global chat"}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>
      ) : (
        <div className="chat-workspace">
          <div className="chat-toolbar">
            <button
              className="chat-back-button"
              type="button"
              onClick={backToList}
              disabled={sending}
              aria-label="Back to chats"
              title="Back to chats"
            >
              <ArrowLeft size={18} strokeWidth={2} aria-hidden="true" />
            </button>
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
          <div
            className="chat-transcript"
            aria-live="polite"
            ref={transcript}
          >
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
                    <div className="chat-message-header">
                      <span className="chat-message-role">{message.role}</span>
                      <div className="chat-message-actions">
                        {message.content.trim() && (
                          <ChatMessageCopyButton content={message.content} />
                        )}
                        {message.role === "user" && (
                          <button
                            className="chat-message-action"
                            type="button"
                            aria-label="Edit and resend message"
                            title={
                              attachmentCount > 0
                                ? "Remove pending attachments before editing"
                                : "Edit and resend"
                            }
                            disabled={sending || attachmentCount > 0}
                            onClick={() => beginMessageEdit(message)}
                          >
                            <Pencil size={14} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </div>
                    {message.content && (
                      <ChatMarkdown content={message.content} />
                    )}
                    {message.attachments?.length > 0 && (
                      <div className="chat-message-attachments">
                        {message.attachments.map((attachment) => {
                          const url = `${API_BASE_URL}${activePageId ? `/api/pages/${activePageId}` : "/api"}/chats/${conversation?.id}/attachments/${message.id}/${attachment.index}`;
                          return attachment.contentType === "application/pdf" ? (
                            <a
                              className="chat-pdf-attachment"
                              key={attachment.index}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <FileText size={18} aria-hidden="true" />
                              {attachment.name}
                            </a>
                          ) : (
                            <img
                              key={attachment.index}
                              src={url}
                              alt={attachment.name}
                              loading="lazy"
                            />
                          );
                        })}
                      </div>
                    )}
                    {message.status === "failed" && (
                      <div className="chat-message-failure">
                        <span className="chat-message-status">
                          Response failed
                        </span>
                        {message.role === "assistant" && (
                          <button
                            className="chat-retry-button"
                            type="button"
                            disabled={sending}
                            onClick={() => void retryFailedReply(message)}
                          >
                            <RotateCcw size={13} aria-hidden="true" />
                            Retry
                          </button>
                        )}
                      </div>
                    )}
                  </article>
                ))}
                {proposals.map((proposal) => {
                  const key =
                    "fileId" in proposal
                      ? `${proposal.fileId}-${proposal.proposedContent}`
                      : `create-${proposal.name}`;
                  const isUpdate = "fileId" in proposal;
                  const title = isUpdate
                    ? `Proposed update: ${proposal.fileName}`
                    : `Proposed new file: ${proposal.name}`;

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
                            setProposals((current) =>
                              current.filter((item) => item !== proposal),
                            )
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
                    <ChatMarkdown content={streamingText} copyable={false} />
                  </article>
                )}
              </>
            )}
          </div>
        </div>
      )}
      <div className="chat-composer-dock">
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {composer}
      </div>
      {libraryPickerOpen && (
        <LibraryPicker
          pageId={activePageId}
          accept={CHAT_ATTACHMENT_TYPES.filter((type) =>
            type.startsWith("image/"),
          )}
          limit={MAX_CHAT_ATTACHMENTS - attachmentFiles.length}
          onSelect={(items) => {
            setLibraryImages(
              items.slice(
                0,
                Math.max(0, MAX_CHAT_ATTACHMENTS - attachmentFiles.length),
              ),
            );
            setLibraryPickerOpen(false);
          }}
          onClose={() => setLibraryPickerOpen(false)}
        />
      )}
      {confirmDialog}
    </section>
  );
}

function LocalAttachmentPreview({
  file,
  onRemove,
}: {
  file: File;
  onRemove: () => void;
}) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (file.type === "application/pdf") return;
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  return (
    <div className="chat-attachment-preview">
      {file.type === "application/pdf" ? (
        <div className="chat-pdf-preview">
          <FileText size={22} aria-hidden="true" />
          <span>{file.name}</span>
        </div>
      ) : (
        url && <img src={url} alt={file.name} />
      )}
      <button
        type="button"
        className="chat-attachment-remove"
        aria-label={`Remove ${file.name}`}
        onClick={onRemove}
      >
        <X size={13} aria-hidden="true" />
      </button>
    </div>
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
