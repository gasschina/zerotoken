import { describe, expect, it } from "vitest";
import { getWebStreamFactory, listWebStreamApiIds } from "./web-stream-factories.js";

describe("web-stream-factories", () => {
  it("lists stable web stream api ids", () => {
    const ids = listWebStreamApiIds().slice().toSorted();
    expect(ids).toEqual(
      [
        "chatgpt-web",
        "claude-web",
        "deepseek-web",
        "doubao-web",
        "gemini-web",
        "glm-intl-web",
        "glm-web",
        "grok-web",
        "kimi-web",
        "perplexity-web",
        "qwen-cn-web",
        "qwen-web",
        "xiaomimo-web",
      ].toSorted(),
    );
  });

  it("returns a factory function for each listed api", () => {
    for (const id of listWebStreamApiIds()) {
      const f = getWebStreamFactory(id);
      expect(f, id).toBeTypeOf("function");
      // Do not invoke f(cookie): some factories validate cookie/session at construction time.
    }
  });

  it("returns undefined for non-web api", () => {
    expect(getWebStreamFactory("openai")).toBeUndefined();
  });
});
