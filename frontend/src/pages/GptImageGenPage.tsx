import { ArrowLeft, ArrowUp, ChevronDown, Download, Maximize2, Paperclip, Pencil, Trash2, X } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import {
  deleteImageGeneration,
  generateImages,
  listImageGenerations,
  listImageModels,
  type ImageGeneration,
} from "../imageApi";
import type { ShellRouteProps } from "../types";

type GptImageGenPageProps = ShellRouteProps & {
  pageId?: string;
};

const FALLBACK_MODELS = ["gpt-image-2.5-sunburst", "gpt-image-2.5-flare"];

const PROMPT_PREVIEW_LENGTH = 120;

function truncatePrompt(prompt: string) {
  return prompt.length > PROMPT_PREVIEW_LENGTH ? `${prompt.slice(0, PROMPT_PREVIEW_LENGTH).trimEnd()}…` : prompt;
}

const POPOVER_WIDTH = 480;
const POPOVER_GAP = 8;

function popoverPosition(anchor: HTMLElement): React.CSSProperties {
  const rect = anchor.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const width = Math.min(POPOVER_WIDTH, viewportWidth - POPOVER_GAP * 2);
  const left = Math.min(Math.max(rect.left, POPOVER_GAP), viewportWidth - width - POPOVER_GAP);
  const spaceBelow = viewportHeight - rect.bottom;
  const spaceAbove = rect.top;
  if (spaceBelow >= 200 || spaceBelow >= spaceAbove) {
    return { top: rect.bottom + POPOVER_GAP, left, width, maxHeight: spaceBelow - POPOVER_GAP * 2 };
  }
  return { bottom: viewportHeight - rect.top + POPOVER_GAP, left, width, maxHeight: spaceAbove - POPOVER_GAP * 2 };
}

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

export function GptImageGenPage({ user, onLogout, pageId }: GptImageGenPageProps) {
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
  const [history, setHistory] = useState<ImageGeneration[]>([]);
  const [parent, setParent] = useState<{ generationId: string; resultKey: string; url: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const promptInput = useRef<HTMLTextAreaElement>(null);
  const [promptPopover, setPromptPopover] = useState<{ text: string; anchor: HTMLElement } | null>(null);
  const [, setLayoutTick] = useState(0);
  const [fullView, setFullView] = useState<{ url: string; alt: string } | null>(null);

  useEffect(() => {
    if (!fullView) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setFullView(null);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [fullView]);

  useEffect(() => {
    if (!promptPopover) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setPromptPopover(null);
    }
    function onLayoutChange() {
      setLayoutTick((tick) => tick + 1);
    }
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onLayoutChange, true);
    window.addEventListener("resize", onLayoutChange);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onLayoutChange, true);
      window.removeEventListener("resize", onLayoutChange);
    };
  }, [promptPopover]);

  useEffect(() => {
    let cancelled = false;
    listImageModels()
      .then((available) => {
        if (cancelled || available.length === 0) return;
        setModels(available);
        setModel((current) => (available.includes(current) ? current : available[0]));
      })
      .catch(() => undefined);
    listImageGenerations(activePageId)
      .then((items) => {
        if (!cancelled) setHistory(items);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [activePageId]);

  function addFiles(files: FileList | null) {
    if (!files) return;
    setAttachments((current) => [...current, ...Array.from(files)].slice(0, MAX_ATTACHMENTS));
    if (fileInput.current) fileInput.current.value = "";
  }

  async function startEdit(item: ImageGeneration, result: { key: string; url: string }) {
    setError("");
    setPrompt(item.prompt);
    if (models.includes(item.model)) setModel(item.model);
    setSize(item.size);
    setQuality(item.quality);
    setCount(item.imageCount);
    setParent({ generationId: item.id, resultKey: result.key, url: result.url });
    setAttachments([]);
    promptInput.current?.focus();
    promptInput.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    try {
      const files = await Promise.all(
        (item.inputs ?? []).map(async (input, index) => {
          const response = await fetch(input.url);
          if (!response.ok) throw new Error("Unable to load input image");
          const blob = await response.blob();
          const extension = blob.type.split("/")[1] ?? "png";
          return new File([blob], `input-${index + 1}.${extension}`, { type: blob.type });
        }),
      );
      setAttachments(files.slice(0, MAX_ATTACHMENTS));
    } catch {
      setError("Original input images could not be loaded; add them again if needed.");
    }
  }

  async function downloadResult(item: ImageGeneration, result: { key: string; url: string }, index: number) {
    setError("");
    try {
      const response = await fetch(result.url);
      if (!response.ok) throw new Error("Unable to download the image");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `framepost-${item.id}-${index + 1}.${item.outputFormat || "png"}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to download the image");
    }
  }

  async function removeGeneration(item: ImageGeneration) {
    if (!window.confirm("Delete this generated image? This cannot be undone.")) return;
    setError("");
    try {
      await deleteImageGeneration(item.id, activePageId);
      setHistory((current) => current.filter((entry) => entry.id !== item.id));
      setParent((current) => (current?.generationId === item.id ? null : current));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to delete the image");
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
      const generation = await generateImages(input, activePageId);
      setHistory((current) => [generation, ...current]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to generate images");
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
            <div className="image-gen-prompt">
              {parent && (
                <div className="image-gen-parent">
                  <img src={parent.url} alt="Original image" />
                  <span>Editing from this image</span>
                  <button type="button" aria-label="Cancel edit" onClick={() => setParent(null)}>
                    <X size={12} aria-hidden="true" />
                  </button>
                </div>
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
                {attachments.length > 0 && (
                  <ul className="image-gen-attachments">
                    {attachments.map((file, index) => (
                      <li key={`${file.name}-${index}`}>
                        <img src={URL.createObjectURL(file)} alt={file.name} />
                        <button
                          type="button"
                          aria-label={`Remove ${file.name}`}
                          onClick={() =>
                            setAttachments((current) => current.filter((_, i) => i !== index))
                          }
                        >
                          <X size={12} aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div style={{ flex: 1 }} />
                <label className="image-gen-control">
                  <span className="image-gen-control-label">Model</span>
                  <div className="image-gen-select-wrapper">
                    <select value={model} onChange={(event) => setModel(event.target.value)} disabled={generating}>
                      {models.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="image-gen-select-icon" size={14} aria-hidden="true" />
                  </div>
                </label>
                <label className="image-gen-control">
                  <span className="image-gen-control-label">Size</span>
                  <div className="image-gen-select-wrapper">
                    <select value={size} onChange={(event) => setSize(event.target.value)} disabled={generating}>
                      {SIZES.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="image-gen-select-icon" size={14} aria-hidden="true" />
                  </div>
                </label>
                <label className="image-gen-control">
                  <span className="image-gen-control-label">Quality</span>
                  <div className="image-gen-select-wrapper">
                    <select value={quality} onChange={(event) => setQuality(event.target.value)} disabled={generating}>
                      {QUALITIES.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="image-gen-select-icon" size={14} aria-hidden="true" />
                  </div>
                </label>
                <label className="image-gen-control">
                  <span className="image-gen-control-label">Count</span>
                  <div className="image-gen-select-wrapper">
                    <select value={count} onChange={(event) => setCount(Number(event.target.value))} disabled={generating}>
                      {Array.from({ length: MAX_IMAGES }, (_, index) => index + 1).map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="image-gen-select-icon" size={14} aria-hidden="true" />
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

        <section className="image-gen-results">
          {history.map((item) => (
            <article className="panel image-gen-result" key={item.id}>
              {item.status === "FAILED" ? (
                <p className="error">{item.error ?? "Generation failed"}</p>
              ) : (
                <div className="image-gen-grid">
                  {item.results.map((result, index) => (
                    <div className="image-gen-tile" key={result.key}>
                      <img src={result.url} alt={item.prompt} />
                      <div className="image-gen-tile-actions">
                        <button
                          type="button"
                          className="image-gen-icon-button"
                          aria-label="View full image"
                          title="Full view"
                          onClick={() => setFullView({ url: result.url, alt: item.prompt })}
                        >
                          <Maximize2 size={14} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="image-gen-icon-button"
                          aria-label="Edit image"
                          title="Edit"
                          onClick={() => startEdit(item, result)}
                        >
                          <Pencil size={14} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="image-gen-icon-button"
                          aria-label="Download image"
                          title="Download"
                          onClick={() => downloadResult(item, result, index)}
                        >
                          <Download size={14} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="image-gen-icon-button"
                          aria-label="Delete image"
                          title="Delete"
                          onClick={() => removeGeneration(item)}
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="image-gen-meta">
                <p className="status">
                  {item.model} · {item.size} · {item.quality} · {item.imageCount}
                </p>
                {item.parentGenerationId && (
                  <p className="status">Edited from a previous image</p>
                )}
                <button
                  type="button"
                  className="image-gen-result-prompt"
                  title="View full prompt"
                  onClick={(event) =>
                    setPromptPopover({ text: item.prompt, anchor: event.currentTarget })
                  }
                >
                  {truncatePrompt(item.prompt)}
                </button>
              </div>
            </article>
          ))}
        </section>
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
      {promptPopover && (
        <div className="image-gen-popover-layer" onMouseDown={() => setPromptPopover(null)}>
          <div
            className="panel image-gen-popover"
            role="dialog"
            aria-modal="false"
            aria-labelledby="image-gen-popover-title"
            style={popoverPosition(promptPopover.anchor)}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="image-gen-popover-header">
              <h3 id="image-gen-popover-title">Prompt</h3>
              <button
                type="button"
                className="secondary-button"
                aria-label="Close"
                onClick={() => setPromptPopover(null)}
              >
                <X size={14} aria-hidden="true" />
              </button>
            </header>
            <p className="image-gen-popover-body">{promptPopover.text}</p>
          </div>
        </div>
      )}
    </AppShell>
  );
}
