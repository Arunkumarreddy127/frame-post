import { ArrowLeft, ArrowUp, Paperclip, X } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import {
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
  const fileInput = useRef<HTMLInputElement>(null);

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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!prompt.trim() || generating) return;
    setGenerating(true);
    setError("");
    try {
      const generation = await generateImages(
        { prompt, model, size, quality, count, attachments },
        activePageId,
      );
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
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Describe what you want to see..."
                rows={6}
                maxLength={32000}
                aria-label="Prompt"
              />
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

          <section className="image-gen-section">
            <h3>Model</h3>
            <label className="image-gen-row">
              Model
              <select value={model} onChange={(event) => setModel(event.target.value)}>
                {models.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="image-gen-section">
            <h3>Image settings</h3>
            <label className="image-gen-row">
              Size &amp; orientation
              <select value={size} onChange={(event) => setSize(event.target.value)}>
                {SIZES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="image-gen-row">
              Quality
              <select value={quality} onChange={(event) => setQuality(event.target.value)}>
                {QUALITIES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="image-gen-row">
              Number of images
              <select value={count} onChange={(event) => setCount(Number(event.target.value))}>
                {Array.from({ length: MAX_IMAGES }, (_, index) => index + 1).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </section>
          {error && <p className="error">{error}</p>}
          {generating && <p className="status">Generating images...</p>}
        </form>

        <section className="image-gen-results">
          {history.map((item) => (
            <article className="panel image-gen-result" key={item.id}>
              <p className="image-gen-result-prompt">{item.prompt}</p>
              <p className="status">
                {item.model} · {item.size} · {item.quality} · {item.imageCount}
              </p>
              {item.status === "FAILED" ? (
                <p className="error">{item.error ?? "Generation failed"}</p>
              ) : (
                <div className="image-gen-grid">
                  {item.results.map((result) => (
                    <img key={result.key} src={result.url} alt={item.prompt} />
                  ))}
                </div>
              )}
            </article>
          ))}
        </section>
      </div>
    </AppShell>
  );
}
