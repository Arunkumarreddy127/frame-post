import type { Generation, MediaItem } from "../../types";
import { GenerationTile } from "./GenerationTile";

type GenerationArticleProps = {
  generation: Generation;
  onFullView: (item: MediaItem, alt: string) => void;
  onDownload: (item: MediaItem) => void;
  onDelete: (generation: Generation) => void;
  onShowParent: (generation: Generation) => void;
  onEdit?: (generation: Generation, output: MediaItem) => void;
};

/** One generation: its outputs, progress, failure, and source navigation. */
export function GenerationArticle({
  generation,
  onFullView,
  onDownload,
  onDelete,
  onShowParent,
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
      {(generation.parentGenerationId ||
        (!prompt && generation.inputFiles.length > 0)) && (
        <div className="image-gen-meta">
          {generation.parentGenerationId &&
            (generation.parentResultKey ? (
              <button
                type="button"
                className="image-gen-parent-link"
                onClick={() => onShowParent(generation)}
              >
                View original image
              </button>
            ) : (
              <p className="status">Original image is unavailable.</p>
            ))}
          {!prompt && generation.inputFiles.length > 0 && (
            <p className="status">
              {generation.inputFiles.map((file) => file.name).join(", ")}
            </p>
          )}
        </div>
      )}
    </article>
  );
}
