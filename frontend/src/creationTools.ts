import type { CreationTool, Workflow } from "./types";

/** Create actions shown across the app, in display order. */
export const ACTION_TOOLS: CreationTool[] = ["IMAGE", "VIDEO", "UPSCALE"];

export function actionLabel(tool: CreationTool, workflows: Workflow[]): string {
  if (tool === "IMAGE") return "Create Image";
  if (tool === "VIDEO") return "Create Video";
  if (tool === "UPSCALE") {
    const isVideo = workflows.some(
      (workflow) => workflow.tool === "UPSCALE" && workflow.outputType === "video",
    );
    return isVideo ? "Upscale Video" : "Upscale Image";
  }
  return tool;
}
