import {
  ArrowLeft,
  ArrowUp,
  ChevronDown,
  Paperclip,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { GenerationFeed } from "../components/generations/GenerationFeed";
import {
  createImageGeneration,
  downloadFile,
  getCatalog,
} from "../generationApi";
import { useGenerationPages } from "../hooks/useGenerationPages";
import type { Generation, MediaItem, ShellRouteProps } from "../types";

type GptImageGenPageProps = ShellRouteProps & {
  pageId?: string;
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
}: GptImageGenPageProps) {
  const { pageId: routePageId } = useParams<{ pageId?: string }>();
  const activePageId = pageId ?? routePageId;
  const createPath = activePageId ? `/pages/${activePageId}/create` : "/create";

  const [models, setModels] = useState(FALLBACK_MODELS);
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState(FALLBACK_MODELS[0]);
  const [size, setSize] = useState("auto");
  const [quality, setQuality] = useState("auto");
  const [count, setCount] = useState(1);
  const [attachments, setAttachments] = useState<File[]>([]);
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
  });
  const [parent, setParent] = useState<{
    generationId: string;
    resultKey: string;
    url: string;
  } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const promptInput = useRef<HTMLTextAreaElement>(null);
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
      [...current, ...selected].slice(0, MAX_ATTACHMENTS),
    );
  }

  async function startEdit(item: Generation, result: MediaItem) {
    setError("");
    setPrompt(item.inputs.prompt ?? "");
    if (item.inputs.model && models.includes(item.inputs.model)) {
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
      setAttachments(files.slice(0, MAX_ATTACHMENTS));
    } catch {
      setError(
        "Original input images could not be loaded; add them again if needed.",
      );
    }
  }

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
      parentGenerationId: parent?.generationId,
      parentResultKey: parent?.resultKey,
    };
    setPrompt("");
    setModel(models[0] ?? FALLBACK_MODELS[0]);
    setSize("auto");
    setQuality("auto");
    setCount(1);
    setAttachments([]);
    setParent(null);
    if (fileInput.current) fileInput.current.value = "";
    setGenerating(true);
    setError("");
    try {
      const generation = await createImageGeneration(input, activePageId);
      prepend(generation);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to generate images",
      );
    } finally {
      setGenerating(false);
    }
  }

  return (
    <AppShell
      user={user}
      onLogout={onLogout}
      pageTitle="Image"
      sidebar={activePageId ? "page" : "global"}
      pageId={activePageId}
      backTo={createPath}
    >
      <Link to={createPath} className="secondary-button">
        <ArrowLeft size={16} strokeWidth={1.8} aria-hidden="true" />
        Back to Create
      </Link>
      <div className="image-gen-layout">
        <form className="panel image-gen-form" onSubmit={submit}>
          <h2>Images</h2>
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
              {attachments.length > 0 && (
                <ul className="image-gen-attachments">
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
                  disabled={attachments.length >= MAX_ATTACHMENTS}
                  onClick={() => fileInput.current?.click()}
                >
                  <Paperclip size={16} aria-hidden="true" />
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
                  disabled={generating || !prompt.trim()}
                >
                  <ArrowUp size={16} aria-hidden="true" />
                </button>
              </div>
            </div>
          </section>

          {error && <p className="error">{error}</p>}
          {generating && <p className="status">Generating images...</p>}
        </form>

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
      </div>
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
    </AppShell>
  );
}
