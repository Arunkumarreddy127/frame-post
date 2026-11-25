import { describe, expect, it } from "vitest";
import type { CreationOutline, Scene, Shot } from "../../types";
import {
  adjacentScenes,
  findScene,
  outlineFinalVideoItems,
  sceneFinalVideoItems,
  shotCoverItem,
} from "./sceneTarget";

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
  return {
    id,
    creationId: "c1",
    position: 0,
    title: id,
    description: null,
    outputs: [],
    shots,
  };
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

function finalItem(
  id: string,
  outputs: { id: string; mediaType: "image" | "video" }[],
) {
  return {
    id,
    generation: { outputs },
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

describe("sceneFinalVideoItems", () => {
  it("returns only video outputs from final invocations in shot order", () => {
    const first = shot(
      "first",
      [
        finalItem("draft", [{ id: "draft-video", mediaType: "video" }]),
        finalItem("final-1", [
          { id: "final-1-image", mediaType: "image" },
          { id: "final-1-video", mediaType: "video" },
        ]),
      ],
      "final-1",
    );
    const second = shot(
      "second",
      [finalItem("final-2", [{ id: "final-2-video", mediaType: "video" }])],
      "final-2",
    );
    const notFinal = shot("not-final", [
      finalItem("video", [{ id: "unselected-video", mediaType: "video" }]),
    ]);

    expect(
      sceneFinalVideoItems(scene("s1", [first, second, notFinal])).map(
        (output) => output.id,
      ),
    ).toEqual(["final-1-video", "final-2-video"]);
  });
});

describe("outlineFinalVideoItems", () => {
  it("returns final videos in scene and shot order", () => {
    const first = shot(
      "first",
      [finalItem("final-1", [{ id: "final-1-video", mediaType: "video" }])],
      "final-1",
    );
    const second = shot(
      "second",
      [finalItem("final-2", [{ id: "final-2-video", mediaType: "video" }])],
      "final-2",
    );
    const productionOutline: CreationOutline = {
      creationId: "c1",
      scenes: [scene("s1", [first]), scene("s2", [second])],
      unassigned: [],
    };

    expect(
      outlineFinalVideoItems(productionOutline).map((output) => output.id),
    ).toEqual(["final-1-video", "final-2-video"]);
  });
});
