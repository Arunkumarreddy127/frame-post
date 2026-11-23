import { describe, expect, it } from "vitest";
import type { CreationOutline, Scene, Shot } from "../../types";
import { adjacentScenes, findScene, shotCoverItem } from "./sceneTarget";

function shot(id: string, invocations: Shot["invocations"] = [], finalItemId: string | null = null): Shot {
  return {
    id,
    creationId: "c1",
    sceneId: "s",
    position: 0,
    title: id,
    brief: null,
    shotSize: null,
    shotTypes: [],
    movement: null,
    durationSeconds: null,
    finalItemId,
    status: "NOT_STARTED",
    invocations,
  };
}

function scene(id: string, shots: Shot[] = []): Scene {
  return { id, creationId: "c1", position: 0, title: id, description: null, shots };
}

const outline: CreationOutline = {
  creationId: "c1",
  scenes: [scene("s1"), scene("s2"), scene("s3")],
  unassigned: [],
};

function item(id: string, withOutput: boolean) {
  return {
    id,
    generation: { outputs: withOutput ? [{ id: `out-${id}` }] : [] },
  } as unknown as Shot["invocations"][number];
}

describe("findScene", () => {
  it("returns the scene with its one-based number", () => {
    expect(findScene(outline, "s2")?.sceneNumber).toBe(2);
    expect(findScene(outline, "missing")).toBeNull();
  });
});

describe("adjacentScenes", () => {
  it("returns neighbours and position", () => {
    const middle = adjacentScenes(outline, "s2");
    expect(middle.position).toBe(2);
    expect(middle.total).toBe(3);
    expect(middle.previous?.scene.id).toBe("s1");
    expect(middle.next?.scene.id).toBe("s3");
  });

  it("has no previous on the first scene and no next on the last", () => {
    expect(adjacentScenes(outline, "s1").previous).toBeNull();
    expect(adjacentScenes(outline, "s3").next).toBeNull();
  });
});

describe("shotCoverItem", () => {
  it("prefers the final item", () => {
    const shotWithFinal = shot("a", [item("i1", true), item("i2", true)], "i1");
    expect(shotCoverItem(shotWithFinal)?.id).toBe("i1");
  });

  it("falls back to the latest invocation with an output", () => {
    const shotNoFinal = shot("a", [item("i1", true), item("i2", true), item("i3", false)]);
    expect(shotCoverItem(shotNoFinal)?.id).toBe("i2");
  });

  it("returns null when nothing has an output", () => {
    expect(shotCoverItem(shot("a", [item("i1", false)]))).toBeNull();
  });
});
