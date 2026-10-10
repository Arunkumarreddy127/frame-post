export type User = { username: string };

export type Page = {
  id: string;
  name: string;
  description: string;
  bio: string;
  createdAt: string;
  updatedAt: string;
};

export type PageFormState = {
  name: string;
  description: string;
  bio: string;
};

export type ShellRouteProps = {
  user: User;
  onLogout: () => Promise<void>;
};

export type ChatRole = "user" | "assistant";
export type ChatMessageStatus = "completed" | "failed";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  model: string | null;
  status: ChatMessageStatus;
  createdAt: string;
};

export type ChatConversationSummary = {
  id: string;
  title: string;
  model: string;
  pageId: string | null;
  pageName: string | null;
  createdAt: string;
  updatedAt: string;
  instructionFileIds: string[];
};

export type ChatConversation = ChatConversationSummary & {
  messages: ChatMessage[];
};

export type InstructionFile = {
  id: string;
  pageId: string | null;
  scope: "user" | "page";
  name: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type InstructionProposal = {
  fileId: string;
  fileName: string;
  currentContent: string;
  proposedContent: string;
};

export type InstructionCreationProposal = {
  name: string;
  content: string;
};

export type InstructionFileProposal = InstructionProposal | InstructionCreationProposal;
