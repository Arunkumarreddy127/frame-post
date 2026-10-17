import type { Generation, MediaItem } from "../../types";
import { GenerationTile } from "./GenerationTile";

const PROMPT_PREVIEW_LENGTH = 120;

function truncatePrompt(prompt: string) {
  return prompt.length > PROMPT_PREVIEW_LENGTH
    ? `${prompt.slice(0, PROMPT_PREVIEW_LENGTH).trimEnd()}…`
    : prompt;
}

type GenerationArticleProps = {
  generation: Generation;
  onFullView: (item: MediaItem, alt: string) => void;
  onDownload: (item: MediaItem) => void;
  onDelete: (generation: Generation) => void;
  onShowPrompt: (text: string, anchor: HTMLElement) => void;
  onEdit?: (generation: Generation, output: MediaItem) => void;
};

function settingsLine(generation: Generation) {
  if (generation.provider === "OPENAI") {
    const { model, size, quality, count } = generation.inputs;
    return [model, size, quality, count].filter(Boolean).join(" · ");
  }
  const { prompt: _prompt, ...settings } = generation.inputs;
  return [generation.workflowKey ?? "Workflow", ...Object.values(settings)].join(" · ");
}

/** One generation: its outputs, or its progress or failure, plus settings and prompt. */
export function GenerationArticle({
  generation,
  onFullView,
  onDownload,
  onDelete,
  onShowPrompt,
  onEdit,
}: GenerationArticleProps) {
  const prompt = generation.inputs.prompt ?? "";
  const canEdit = onEdit !== undefined && generation.provider === "OPENAI";

  return (
    <article className="panel image-gen-result">
      {generation.status === "FAILED" && (
        <p className="error">{generation.error ?? "Generation failed"}</p>
      )}
      {generation.status === "PROCESSING" && (
        <div className="result-placeholder result-processing">
          <span className="result-loader" />
          <strong>
            Creating your {generation.mediaType === "VIDEO" ? "video" : "image"}
          </strong>
          <span>This can take several minutes.</span>
        </div>
      )}
      {generation.status === "COMPLETED" && (
        <div className="image-gen-grid">
          {generation.outputs.map((output) => (
            <GenerationTile
              key={output.id}
              item={output}
              alt={prompt || output.name}
              onFullView={onFullView}
              onDownload={onDownload}
              onDelete={() => onDelete(generation)}
              onEdit={
                canEdit && output.mediaType === "image"
                  ? () => onEdit(generation, output)
                  : undefined
              }
            />
          ))}
        </div>
      )}
      <div className="image-gen-meta">
        <p className="status">{settingsLine(generation)}</p>
        {generation.parentGenerationId && (
          <p className="status">Edited from a previous image</p>
        )}
        {!prompt && generation.inputFiles.length > 0 && (
          <p className="status">
            {generation.inputFiles.map((file) => file.name).join(", ")}
          </p>
        )}
        {prompt && (
          <button
            type="button"
            className="image-gen-result-prompt"
            title="View full prompt"
            onClick={(event) => onShowPrompt(prompt, event.currentTarget)}
          >
            {truncatePrompt(prompt)}
          </button>
        )}
      </div>
    </article>
  );
}
