import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addCreationItem,
  groupedGenerationIds,
  listCreations,
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

  it("sends each generation id as a repeated query parameter", async () => {
    const fetchMock = stubFetch(["a"]);

    await expect(groupedGenerationIds(undefined, ["a", "b"])).resolves.toEqual(["a"]);

    expect(fetchMock.mock.calls[0][0]).toMatch(
      /\/api\/creations\/grouped\?generationIds=a&generationIds=b$/,
    );
  });

  it("posts optional lane and parent placement", async () => {
    const fetchMock = stubFetch({});

    await addCreationItem("page-1", "creation-1", {
      generationId: "gen-1",
      laneId: "Reel A",
    });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      generationId: "gen-1",
      laneId: "Reel A",
    });
  });
});
