import { afterEach, describe, expect, it, vi } from "vitest";
import {
  editMessageAndStream,
  parseSseFrame,
  retryAssistantResponse,
  streamMessage,
} from "./chatApi";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseSseFrame", () => {
  it("parses a response delta", () => {
    expect(parseSseFrame('event: delta\ndata: {"text":"Hello"}')).toEqual({
      type: "delta",
      text: "Hello",
    });
  });

  it("parses completion and error events", () => {
    expect(parseSseFrame("event: complete\ndata: {}")).toEqual({
      type: "complete",
    });
    expect(
      parseSseFrame('event: error\ndata: {"message":"Rate limited"}'),
    ).toEqual({ type: "error", message: "Rate limited" });
  });

  it("parses an instruction proposal", () => {
    const proposal = {
      fileId: "f1",
      fileName: "Tone",
      currentContent: "old",
      proposedContent: "new",
    };
    expect(
      parseSseFrame(
        `event: instruction_proposal\ndata: ${JSON.stringify(proposal)}`,
      ),
    ).toEqual({ type: "instruction_proposal", proposal });
  });

  it("sends uploaded images and Library keys as multipart fields", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response("event: complete\ndata: {}\n\n", {
          headers: { "Content-Type": "text/event-stream" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const file = new File([new Uint8Array([1, 2, 3])], "reference.png", {
      type: "image/png",
    });

    await streamMessage(
      "conversation",
      "describe",
      "model",
      () => undefined,
      undefined,
      [file],
      ["outputs/key.png"],
    );

    const [requestUrl, request] = fetchMock.mock.calls[0];
    expect(requestUrl).toContain("/api/chats/conversation/messages/stream");
    expect(request.credentials).toBe("include");
    expect(request.headers).toBeUndefined();
    expect(request.body.get("content")).toBe("describe");
    expect(request.body.get("model")).toBe("model");
    expect(request.body.get("attachments")).toBe(file);
    expect(request.body.get("attachmentKeys")).toBe("outputs/key.png");
  });

  it("edits a user message and starts a replacement response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("event: complete\ndata: {}\n\n", {
        headers: { "Content-Type": "text/event-stream" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    await editMessageAndStream(
      "conversation",
      "message-id",
      "updated prompt",
      "model",
      () => undefined,
      "page-id",
      controller.signal,
    );

    const [requestUrl, request] = fetchMock.mock.calls[0];
    expect(requestUrl).toContain(
      "/api/pages/page-id/chats/conversation/messages/message-id/stream",
    );
    expect(request.method).toBe("PUT");
    expect(request.credentials).toBe("include");
    expect(request.signal).toBe(controller.signal);
    expect(JSON.parse(request.body)).toEqual({
      content: "updated prompt",
      model: "model",
    });
  });

  it("retries a failed assistant message with an abort signal", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("event: complete\ndata: {}\n\n", {
        headers: { "Content-Type": "text/event-stream" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    await retryAssistantResponse(
      "conversation",
      "failed-message",
      () => undefined,
      undefined,
      controller.signal,
    );

    const [requestUrl, request] = fetchMock.mock.calls[0];
    expect(requestUrl).toContain(
      "/api/chats/conversation/messages/failed-message/retry",
    );
    expect(request.method).toBe("POST");
    expect(request.signal).toBe(controller.signal);
  });
});
