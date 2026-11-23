import { describe, expect, it } from "vitest";
import type { CreationOutline, Shot, WorkflowInput } from "../../types";
import {
  adjacentShots,
  findSecondsInput,
  findShot,
  latestOutput,
  parseCreationTool,
  secondsForInput,
} from "./shotTarget";

function output(id: string) {
  return {
    id,
    generationId: `gen-${id}`,
    pageId: null,
    slot: null,
    type: null,
    position: 0,
    key: id,
    url: `/media/${id}`,
    name: id,
    contentType: "image/png",
    mediaType: "image" as const,
  };
}

function invocation(id: string, tool: "IMAGE" | "VIDEO", outputId: string) {
  return {
    id,
    creationId: "c1",
    position: 0,
    parentItemId: null,
    sceneId: "s1",
    shotId: "sh1",
    tool,
    addedAt: "",
    generation: { outputs: [output(outputId)] },
  } as unknown as Shot["invocations"][number];
}

const shot: Shot = {
  id: "sh1",
  creationId: "c1",
  sceneId: "s1",
  position: 0,
  title: "Aerial",
  brief: null,
  shotSize: null,
  shotTypes: [],
  movement: null,
  durationSeconds: 5,
  finalItemId: null,
  status: "IMAGE_READY",
  invocations: [
    invocation("i1", "IMAGE", "img-1"),
    invocation("i2", "VIDEO", "vid-1"),
    invocation("i3", "IMAGE", "img-2"),
  ],
};

const outline: CreationOutline = {
  creationId: "c1",
  unassigned: [],
  scenes: [
    { id: "s0", creationId: "c1", position: 0, title: "A", description: null, shots: [] },
    { id: "s1", creationId: "c1", position: 1, title: "B", description: null, shots: [shot] },
  ],
};

const secondsInput: WorkflowInput = {
  name: "seconds",
  type: "number",
  label: "Duration (seconds)",
  required: false,
  accept: null,
  maxBytes: null,
  maxLength: null,
  options: null,
  default: null,
  min: 1,
  max: 10,
};

describe("shotTarget helpers", () => {
  it("parses only known creation tools", () => {
    expect(parseCreationTool("video")).toBe("VIDEO");
    expect(parseCreationTool("bogus")).toBeNull();
    expect(parseCreationTool(null)).toBeNull();
  });

  it("locates a shot with 1-based scene and shot numbers", () => {
    const location = findShot(outline, "sh1");
    expect(location?.sceneNumber).toBe(2);
    expect(location?.shotNumber).toBe(1);
    expect(findShot(outline, "missing")).toBeNull();
  });

  it("finds neighbouring shots across scene boundaries", () => {
    const second = { ...shot, id: "sh2", title: "Street" };
    const crossScene: CreationOutline = {
      ...outline,
      scenes: [
        { ...outline.scenes[0], shots: [shot] },
        { ...outline.scenes[1], shots: [second] },
      ],
    };
    const first = adjacentShots(crossScene, "sh1");
    expect(first.previous).toBeNull();
    expect(first.next?.shot.id).toBe("sh2");
    expect(first.next?.sceneNumber).toBe(2);
    expect(first.position).toBe(1);
    expect(first.total).toBe(2);
    const last = adjacentShots(crossScene, "sh2");
    expect(last.previous?.shot.id).toBe("sh1");
    expect(last.next).toBeNull();
    expect(adjacentShots(crossScene, "missing").position).toBe(0);
  });

  it("returns the latest output for a tool", () => {
    expect(latestOutput(shot, "IMAGE")?.id).toBe("img-2");
    expect(latestOutput(shot, "VIDEO")?.id).toBe("vid-1");
    expect(latestOutput(shot, "EDIT")).toBeNull();
  });

  it("finds a seconds input among workflow inputs", () => {
    expect(findSecondsInput([{ ...secondsInput, type: "text" }])).toBeNull();
    expect(findSecondsInput([secondsInput])?.name).toBe("seconds");
  });

  it("only passes seconds that fit the input range", () => {
    expect(secondsForInput(secondsInput, 5)).toBe("5");
    expect(secondsForInput(secondsInput, 11)).toBeNull();
    expect(secondsForInput(secondsInput, null)).toBeNull();
  });
});
