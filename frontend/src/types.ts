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

export type InstructionFileProposal =
  | InstructionProposal
  | InstructionCreationProposal;

export type GenerationProvider = "OPENAI" | "RUNNINGHUB";
export type GenerationStatus = "PROCESSING" | "COMPLETED" | "FAILED";

/** A stored input (`slot` set) or output (`type` set) file. */
export type MediaItem = {
  id: string;
  generationId: string;
  pageId: string | null;
  slot: string | null;
  type: string | null;
  position: number;
  key: string;
  url: string;
  name: string;
  contentType: string;
  mediaType: "image" | "video";
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  createdAt: string;
};

export type Generation = {
  id: string;
  pageId: string | null;
  provider: GenerationProvider;
  mediaType: "IMAGE" | "VIDEO";
  workflowKey: string | null;
  inputs: Record<string, string>;
  status: GenerationStatus;
  error: string | null;
  createdAt: string;
  parentGenerationId: string | null;
  parentResultKey: string | null;
  inputFiles: MediaItem[];
  outputs: MediaItem[];
};

export type Paged<T> = {
  items: T[];
  nextCursor: string | null;
};

export type WorkflowInputType =
  | "image"
  | "video"
  | "text"
  | "textarea"
  | "select"
  | "number";

export type InstanceType = "default" | "plus" | "ultra";

export type WorkflowInput = {
  name: string;
  type: WorkflowInputType;
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

export type Workflow = {
  key: string;
  label: string;
  description: string;
  group: string;
  configured: boolean;
  inputs: WorkflowInput[];
  outputType: string;
  outputContentType: string;
};

export type Catalog = {
  imageModels: string[];
  runningHubWorkflows: Workflow[];
};
