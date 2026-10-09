import { describe, expect, it } from "vitest";
import { parseSseFrame } from "./chatApi";

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
});
