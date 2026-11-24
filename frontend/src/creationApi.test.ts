import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addCreationItem,
  getOutline,
  listCreations,
  moveCreationItem,
  updateShot,
} from "./creationApi";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("creationApi", () => {
  it("scopes list requests to the page when a page id is given", async () => {
    const fetchMock = stubFetch([]);

    await listCreations("page-1");

    expect(fetchMock.mock.calls[0][0]).toContain("/api/pages/page-1/creations");
  });

  it("uses global routes without a page id", async () => {
    const fetchMock = stubFetch([]);

    await listCreations(undefined);

    expect(fetchMock.mock.calls[0][0]).toMatch(/\/api\/creations$/);
  });

  it("posts optional shot, tool, and parent placement", async () => {
    const fetchMock = stubFetch({});

    await addCreationItem("page-1", "creation-1", {
      generationId: "gen-1",
      shotId: "shot-1",
      tool: "IMAGE",
      parentItemId: "item-0",
    });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      generationId: "gen-1",
      shotId: "shot-1",
      tool: "IMAGE",
      parentItemId: "item-0",
    });
  });

  it("moves an item to a shot, or to Unassigned with a null shot id", async () => {
    const fetchMock = stubFetch({});

    await moveCreationItem("page-1", "creation-1", "item-1", null);

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("PUT");
    expect(fetchMock.mock.calls[0][0]).toContain(
      "/api/pages/page-1/creations/creation-1/items/item-1/shot",
    );
    expect(JSON.parse(init.body as string)).toEqual({ shotId: null });
  });

  it("loads the production outline for a creation", async () => {
    const fetchMock = stubFetch({ creationId: "creation-1", scenes: [], unassigned: [] });

    await expect(getOutline(undefined, "creation-1")).resolves.toEqual({
      creationId: "creation-1",
      scenes: [],
      unassigned: [],
    });

    expect(fetchMock.mock.calls[0][0]).toMatch(/\/api\/creations\/creation-1\/outline$/);
  });

  it("includes the shot scene when updating shot details", async () => {
    const fetchMock = stubFetch({});

    await updateShot("page-1", "creation-1", "shot-1", {
      sceneId: "scene-1",
      title: "Shot",
      brief: "Updated brief",
      shotSize: null,
      shotTypes: [],
      movement: null,
      durationSeconds: null,
    });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual({
      sceneId: "scene-1",
      title: "Shot",
      brief: "Updated brief",
      shotSize: null,
      shotTypes: [],
      movement: null,
      durationSeconds: null,
    });
  });
});
