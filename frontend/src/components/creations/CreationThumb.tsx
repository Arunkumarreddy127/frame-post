import { Play } from "lucide-react";
import type { Generation, MediaItem } from "../../types";

export function toolLabel(generation: Generation) {
  if (generation.provider === "OPENAI") return "GPT Image";
  return generation.workflowKey
    ? `RunningHub · ${generation.workflowKey}`
    : "RunningHub";
}

export function CreationThumb({
  generation,
  onOpen,
}: {
  generation: Generation;
  onOpen: (item: MediaItem) => void;
}) {
  const output = generation.outputs[0];
  if (!output) {
    return (
      <div className="creation-thumb creation-thumb-empty">
        {generation.status === "FAILED" ? "Failed" : "Pending"}
      </div>
    );
  }
  if (output.mediaType === "video") {
    return (
      <button
        type="button"
        className="creation-thumb creation-thumb-button"
        aria-label={`View video: ${output.name}`}
        onClick={() => onOpen(output)}
      >
        <video src={output.url} muted playsInline preload="metadata" />
        <span className="creation-thumb-play" aria-hidden="true">
          <Play size={16} fill="currentColor" />
        </span>
      </button>
    );
  }
  return (
    <button
      type="button"
      className="creation-thumb creation-thumb-button"
      aria-label={`View image: ${output.name}`}
      onClick={() => onOpen(output)}
    >
      <img src={output.url} alt="" loading="lazy" />
    </button>
  );
}
