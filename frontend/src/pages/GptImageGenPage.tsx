import {
  ArrowLeft,
  ArrowUp,
  ChevronDown,
  FolderOpen,
  Paperclip,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { LibraryPicker } from "../components/library/LibraryPicker";
import { GenerationFeed } from "../components/generations/GenerationFeed";
import {
  createImageGeneration,
  downloadFile,
  getCatalog,
  getGeneration,
} from "../generationApi";
import { useGenerationPages } from "../hooks/useGenerationPages";
import { addCreationItem, errorMessage } from "../creationApi";
import {
  CreationTargetBanner,
  creationQuery,
} from "../components/creations/CreationTargetBanner";
import {
  parseCreationTool,
  useShotTarget,
} from "../components/creations/shotTarget";
import type { CreationTool, Generation, MediaItem, ShellRouteProps } from "../types";

type GptImageGenPageProps = ShellRouteProps & {
  pageId?: string;
  embedded?: boolean;
  creationId?: string;
  shotId?: string | null;
  sceneId?: string | null;
  shotTool?: CreationTool | null;
  onGenerationTriggered?: () => void;
  onCreationItemAdded?: () => void;
  onCreationItemError?: (message: string) => void;
};

const FALLBACK_MODELS = ["gpt-image-2.5-sunburst", "gpt-image-2.5-flare"];

const SIZES = [
  { value: "auto", label: "Auto" },
  { value: "1024x1024", label: "Square 1024x1024" },
  { value: "1024x1536", label: "Portrait 1024x1536" },
  { value: "1536x1024", label: "Landscape 1536x1024" },
];

const QUALITIES = [
  { value: "auto", label: "Auto" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "xhigh", label: "Extra High" },
  { value: "max", label: "Max" },
];

const MAX_IMAGES = 4;
const MAX_ATTACHMENTS = 4;

export function GptImageGenPage({
  user,
  onLogout,
  pageId,
  embedded = false,
  creationId: creationIdProp,
  shotId: shotIdProp,
  sceneId: sceneIdProp,
  shotTool: shotToolProp,
  onGenerationTriggered,
  onCreationItemAdded,
  onCreationItemError,
}: GptImageGenPageProps) {
  const { pageId: routePageId } = useParams<{ pageId?: string }>();
  const [searchParams] = useSearchParams();
  const activePageId = pageId ?? routePageId;
  const creationId = creationIdProp ?? searchParams.get("creationId");
  const shotId = embedded ? (shotIdProp ?? null) : searchParams.get("shotId");
  const sceneId = embedded ? (sceneIdProp ?? null) : searchParams.get("sceneId");
  const shotTool = embedded
    ? (shotToolProp ?? null)
    : parseCreationTool(searchParams.get("tool"));
  const shotTarget = useShotTarget(activePageId, creationId, shotId);
  const createPath =
    (activePageId ? `/pages/${activePageId}/create` : "/create") +
    creationQuery(creationId, { shotId, sceneId, tool: shotTool });

  const [models, setModels] = useState(FALLBACK_MODELS);
  const [prompt, setPrompt] = useState("");
  const prefilledShotId = useRef<string | null>(null);
  useEffect(() => {
    const brief = shotTarget?.shot.brief?.trim();
    if (!shotId || !brief || prefilledShotId.current === shotId) return;
    prefilledShotId.current = shotId;
    setPrompt((current) => (current.trim() ? current : brief));
  }, [shotId, shotTarget]);
  const [model, setModel] = useState(FALLBACK_MODELS[0]);
  const [size, setSize] = useState("auto");
  const [quality, setQuality] = useState("auto");
  const [count, setCount] = useState(1);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [libraryItems, setLibraryItems] = useState<MediaItem[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const attachmentCount = attachments.length + libraryItems.length;
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const {
    items: history,
    hasMore,
    loading: historyLoading,
    error: historyError,
    loadMore,
    prepend,
    update,
    removeWhere,
  } = useGenerationPages({
    pageId: activePageId,
    provider: "OPENAI",
    globalOnly: true,
  }, !embedded);
  const [parent, setParent] = useState<{
    generationId: string;
    resultKey: string;
    url: string;
  } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const promptInput = useRef<HTMLTextAreaElement>(null);
  const restoredFrom = useRef("");
  const [fullView, setFullView] = useState<{ url: string; alt: string } | null>(
    null,
  );

  useEffect(() => {
    if (!fullView) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setFullView(null);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [fullView]);

  useEffect(() => {
    let cancelled = false;
    getCatalog()
      .then(({ imageModels }) => {
        if (cancelled || imageModels.length === 0) return;
        setModels(imageModels);
        setModel((current) =>
          imageModels.includes(current) ? current : imageModels[0],
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  function addFiles(files: FileList | null) {
    if (!files) return;
    const selected = Array.from(files);
    if (fileInput.current) fileInput.current.value = "";
    setAttachments((current) =>
      [...current, ...selected].slice(
        0,
        Math.max(0, MAX_ATTACHMENTS - libraryItems.length),
      ),
    );
  }

  async function startEdit(item: Generation, result: MediaItem) {
    setError("");
    setPrompt(item.inputs.prompt ?? "");
    if (item.inputs.model) {
      if (!models.includes(item.inputs.model)) {
        setModels((current) => [...current, item.inputs.model]);
      }
      setModel(item.inputs.model);
    }
    setSize(item.inputs.size ?? "auto");
    setQuality(item.inputs.quality ?? "auto");
    setCount(Number(item.inputs.count) || 1);
    setParent({
      generationId: item.id,
      resultKey: result.key,
      url: result.url,
    });
    setAttachments([]);
    promptInput.current?.focus();
    promptInput.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    try {
      const files = await Promise.all(
        item.inputFiles.map(async (input, index) => {
          const blob = await downloadFile(input.key);
          const extension = blob.type.split("/")[1] ?? "png";
          return new File([blob], `input-${index + 1}.${extension}`, {
            type: blob.type,
          });
        }),
      );
      setLibraryItems([]);
      setAttachments(files.slice(0, MAX_ATTACHMENTS));
    } catch {
      setError(
        "Original input images could not be loaded; add them again if needed.",
      );
    }
  }

  async function startFromInput(item: Generation, input: MediaItem) {
    setError("");
    setPrompt(item.inputs.prompt ?? "");
    if (item.inputs.model) {
      if (!models.includes(item.inputs.model)) {
        setModels((current) => [...current, item.inputs.model]);
      }
      setModel(item.inputs.model);
    }
    setSize(item.inputs.size ?? "auto");
    setQuality(item.inputs.quality ?? "auto");
    setCount(Number(item.inputs.count) || 1);
    setParent(null);
    setAttachments([]);
    setLibraryItems([]);
    if (fileInput.current) fileInput.current.value = "";
    try {
      const blob = await downloadFile(input.key);
      const extension = blob.type.split("/")[1] ?? "png";
      setAttachments([
        new File([blob], input.name || `input.${extension}`, { type: blob.type }),
      ]);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The selected source image could not be loaded; add it again if needed.",
      );
      return;
    }
    promptInput.current?.focus();
    promptInput.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }

  useEffect(() => {
    const generationId = searchParams.get("from");
    const resultKey = searchParams.get("result");
    const restoreKey = `${generationId ?? ""}:${resultKey ?? ""}`;
    if (!generationId || !resultKey || restoredFrom.current === restoreKey) return;
    restoredFrom.current = restoreKey;
    let cancelled = false;
    getGeneration(generationId, activePageId)
      .then(async (generation) => {
        if (cancelled) return;
        if (generation.provider !== "OPENAI") {
          throw new Error("This result cannot be opened in the image generator.");
        }
        const output = generation.outputs.find((item) => item.key === resultKey);
        if (output) {
          await startEdit(generation, output);
          return;
        }
        const input = generation.inputFiles.find((item) => item.key === resultKey);
        if (!input) throw new Error("The selected result is no longer available.");
        await startFromInput(generation, input);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Unable to restore this generation");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activePageId, searchParams]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!prompt.trim() || generating) return;
    const input = {
      prompt,
      model,
      size,
      quality,
      count,
      attachments,
      attachmentKeys: libraryItems.map((item) => item.key),
      parentGenerationId: parent?.generationId,
      parentResultKey: parent?.resultKey,
    };
    const previousLibraryItems = libraryItems;
    const previousParent = parent;
    setPrompt("");
    setModel(models[0] ?? FALLBACK_MODELS[0]);
    setSize("auto");
    setQuality("auto");
    setCount(1);
    setAttachments([]);
    setLibraryItems([]);
    setParent(null);
    if (fileInput.current) fileInput.current.value = "";
    setGenerating(true);
    setError("");
    try {
      const generation = await createImageGeneration(input, activePageId);
      prepend(generation);
      onGenerationTriggered?.();
      if (creationId) {
        try {
          await addCreationItem(activePageId, creationId, {
            generationId: generation.id,
            ...(shotId
              ? { shotId, tool: "IMAGE" as const }
              : sceneId
                ? { sceneId, tool: "IMAGE" as const }
                : {}),
          });
          onCreationItemAdded?.();
        } catch (attachError) {
          const message = `Generated, but it was not added to the creation: ${errorMessage(attachError, "unknown error")}`;
          if (onCreationItemError) onCreationItemError(message);
          else setError(message);
        }
      }
    } catch (requestError) {
      // Give the user their work back unless they have already started a new prompt.
      if (!(promptInput.current?.value ?? "").trim()) {
        setPrompt(input.prompt);
        setModel(input.model);
        setSize(input.size);
        setQuality(input.quality);
        setCount(input.count);
        setAttachments(input.attachments);
        setLibraryItems(previousLibraryItems);
        setParent(previousParent);
      }
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to generate images",
      );
    } finally {
      setGenerating(false);
    }
  }

  const composer = (
    <>
      {!embedded && (
        <>
          <Link to={createPath} className="secondary-button">
            <ArrowLeft size={16} strokeWidth={1.8} aria-hidden="true" />
            Back to Create
          </Link>
          {creationId && (
            <CreationTargetBanner
              pageId={activePageId}
              creationId={creationId}
              shotId={shotId}
              sceneId={sceneId}
              tool={shotId || sceneId ? "IMAGE" : null}
            />
          )}
        </>
      )}
      <div className="image-gen-layout">
        <form className="panel image-gen-form" onSubmit={submit}>
          <h2 className="app-page-title">Images</h2>
          <p className="app-page-description">
            Generate images from a prompt with optional image references.
          </p>
          <section className="image-gen-section">
            <h3>Prompt</h3>
            {/* GenerationComposer */}
            <div className="image-gen-prompt">
              {parent && (
                <div className="image-gen-parent">
                  <img src={parent.url} alt="Original image" />
                  <span>Editing from this image</span>
                  <button
                    type="button"
                    aria-label="Cancel edit"
                    onClick={() => setParent(null)}
                  >
                    <X size={12} aria-hidden="true" />
                  </button>
                </div>
              )}
              {attachmentCount > 0 && (
                <ul className="image-gen-attachments">
                  {libraryItems.map((item) => (
                    <li key={item.key}>
                      <img
                        src={item.url}
                        alt={item.name}
                        title="From Library"
                      />
                      <button
                        type="button"
                        aria-label={`Remove ${item.name}`}
                        onClick={() =>
                          setLibraryItems((current) =>
                            current.filter((entry) => entry.key !== item.key),
                          )
                        }
                      >
                        <X size={12} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                  {attachments.map((file, index) => (
                    <li key={`${file.name}-${index}`}>
                      <img
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        title="Double-click to view"
                        onDoubleClick={() =>
                          setFullView({
                            url: URL.createObjectURL(file),
                            alt: file.name,
                          })
                        }
                      />
                      <button
                        type="button"
                        aria-label={`Remove ${file.name}`}
                        onClick={() =>
                          setAttachments((current) =>
                            current.filter((_, i) => i !== index),
                          )
                        }
                      >
                        <X size={12} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <textarea
                ref={promptInput}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder="Describe what you want to see..."
                rows={6}
                maxLength={32000}
                aria-label="Prompt"
              />
              <div className="image-gen-prompt-actions">
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  hidden
                  onChange={(event) => addFiles(event.target.files)}
                />
                <button
                  type="button"
                  className="secondary-button"
                  aria-label="Attach images"
                  disabled={attachmentCount >= MAX_ATTACHMENTS}
                  onClick={() => fileInput.current?.click()}
                >
                  <Paperclip size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  aria-label="Choose images from Library"
                  title="Choose from Library"
                  disabled={attachmentCount >= MAX_ATTACHMENTS}
                  onClick={() => setPickerOpen(true)}
                >
                  <FolderOpen size={16} aria-hidden="true" />
                </button>
                <div style={{ flex: 1 }} />
                <label className="image-gen-control">
                  <span className="image-gen-control-label">Model</span>
                  <div className="image-gen-select-wrapper">
                    <select
                      value={model}
                      onChange={(event) => setModel(event.target.value)}
                      disabled={generating}
                    >
                      {models.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      className="image-gen-select-icon"
                      size={14}
                      aria-hidden="true"
                    />
                  </div>
                </label>
                <label className="image-gen-control">
                  <span className="image-gen-control-label">Size</span>
                  <div className="image-gen-select-wrapper">
                    <select
                      value={size}
                      onChange={(event) => setSize(event.target.value)}
                      disabled={generating}
                    >
                      {SIZES.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      className="image-gen-select-icon"
                      size={14}
                      aria-hidden="true"
                    />
                  </div>
                </label>
                <label className="image-gen-control">
                  <span className="image-gen-control-label">Quality</span>
                  <div className="image-gen-select-wrapper">
                    <select
                      value={quality}
                      onChange={(event) => setQuality(event.target.value)}
                      disabled={generating}
                    >
                      {QUALITIES.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      className="image-gen-select-icon"
                      size={14}
                      aria-hidden="true"
                    />
                  </div>
                </label>
                <label className="image-gen-control">
                  <span className="image-gen-control-label">Count</span>
                  <div className="image-gen-select-wrapper">
                    <select
                      value={count}
                      onChange={(event) => setCount(Number(event.target.value))}
                      disabled={generating}
                    >
                      {Array.from(
                        { length: MAX_IMAGES },
                        (_, index) => index + 1,
                      ).map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      className="image-gen-select-icon"
                      size={14}
                      aria-hidden="true"
                    />
                  </div>
                </label>
                <button
                  type="submit"
                  className="primary-button"
                  aria-label="Generate"
                  title="Generate (Ctrl/⌘ + Enter)"
                  disabled={generating || !prompt.trim()}
                >
                  <ArrowUp size={16} aria-hidden="true" />
                </button>
              </div>
            </div>
          </section>

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {generating && (
            <p className="status" role="status">
              Generating images...
            </p>
          )}
        </form>

        {!embedded && (
          <GenerationFeed
            items={history}
            hasMore={hasMore}
            loading={historyLoading}
            loadError={historyError}
            emptyMessage="No images yet."
            onLoadMore={loadMore}
            onUpdate={update}
            onDeleted={(generation) => {
              removeWhere((item) => item.id === generation.id);
              setParent((current) =>
                current?.generationId === generation.id ? null : current,
              );
            }}
            onEdit={startEdit}
          />
        )}
      </div>
      {pickerOpen && (
        <LibraryPicker
          pageId={activePageId}
          accept={["image/png", "image/jpeg", "image/webp"]}
          limit={MAX_ATTACHMENTS - attachmentCount}
          onClose={() => setPickerOpen(false)}
          onSelect={(items) => {
            setLibraryItems((current) => [
              ...current,
              ...items.filter(
                (item) => !current.some((entry) => entry.key === item.key),
              ),
            ]);
            setPickerOpen(false);
          }}
        />
      )}
      {fullView && (
        <div
          className="image-gen-fullview-layer"
          role="dialog"
          aria-modal="true"
          aria-label="Full image view"
          onMouseDown={() => setFullView(null)}
        >
          <button
            type="button"
            className="secondary-button image-gen-fullview-close"
            aria-label="Close"
            onClick={() => setFullView(null)}
          >
            <X size={16} aria-hidden="true" />
          </button>
          <img
            src={fullView.url}
            alt={fullView.alt}
            onMouseDown={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </>
  );
  return embedded ? (
    <div className="creation-generator">{composer}</div>
  ) : (
    <AppShell
      user={user}
      onLogout={onLogout}
      pageTitle="Image"
      sidebar={activePageId ? "page" : "global"}
      pageId={activePageId}
      backTo={createPath}
    >
      {composer}
    </AppShell>
  );
}
