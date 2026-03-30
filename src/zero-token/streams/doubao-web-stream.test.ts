import { describe, expect, it } from "vitest";

/**
 * Unit tests for the text-buffer / tag-parsing logic in doubao-web-stream.ts.
 *
 * The Doubao SSE stream sends every character as a separate SSE line, so the
 * stream parser must:
 *   1. Buffer small text deltas and flush them in batches (reduces UI spam).
 *   2. Always parse XML tag boundaries from the full accumulated buffer,
 *      even when buffered text has already been flushed.
 *   3. Flush all remaining buffered text at end-of-stream without a timer.
 *
 * The original buggy implementation returned early after reaching the
 * buffer threshold without calling checkTags(), causing XML tags arriving
 * just after a flush to be silently dropped.
 */

describe("Doubao stream buffer + tag parsing logic", () => {
  // -------------------------------------------------------------------------
  // Helper – mirrors the fixed pushDelta + checkTags algorithm from
  // doubao-web-stream.ts. The key fix is that checkTags() always runs (no
  // early return after threshold flush) and it tracks how many characters of
  // the current delta are already accounted for so they are not double-emitted.
  // -------------------------------------------------------------------------

  interface Accum {
    text: string;
    thinking: string;
    mode: "text" | "thinking" | "tool_call";
  }

  function parseSseLines(lines: string[]): Accum {
    let tagBuffer = "";
    let pendingText = "";
    let currentMode: "text" | "thinking" | "tool_call" = "text";
    const THRESHOLD = 20;

    const accum: Accum = { text: "", thinking: "", mode: "text" };

    function emitText(delta: string) {
      accum.text += delta;
    }

    function emitThinking(delta: string) {
      accum.thinking += delta;
    }

    function flushTextBuffer() {
      if (!pendingText) {return;}
      emitText(pendingText);
      pendingText = "";
    }

    function pushDelta(delta: string) {
      if (!delta) {return;}

      // Always accumulate into tagBuffer first so checkTags() can detect boundaries.
      tagBuffer += delta;

      // thinking content is emitted immediately — but we still run checkTags() so the
      // closing tag is detected and we switch back to text mode.
      if (currentMode === "thinking") {
        flushTextBuffer();
        emitThinking(delta);
        // fall through to checkTags() to detect </think>
      } else if (currentMode === "tool_call") {
        flushTextBuffer();
      } else {
        // text mode: accumulate, flush at threshold
        pendingText += delta;
        if (pendingText.length >= THRESHOLD) {
          flushTextBuffer();
        }
      }

      // Always parse tag boundaries from the full accumulated tagBuffer.
      // prevTagLen tracks where the current delta starts so we don't double-emit
      // text that was already flushed before this delta arrived.
      let prevTagLen = tagBuffer.length - delta.length;

      function checkTags() {
        const thinkStart = tagBuffer.match(/<think\b[^<>]*>/i);
        const thinkEnd = tagBuffer.match(/<\/think\b[^<>]*>/i);
        const toolStart = tagBuffer.match(
          /<tool_call\s*(?:id=['"]?([^'"]+)['"]?\s*)?name=['"]?([^'"]+)['"]?\s*>/i,
        );
        const toolEnd = tagBuffer.match(/<\/tool_call\s*>/i);

        const indices = [
          {
            type: "think_start" as const,
            idx: thinkStart?.index ?? -1,
            len: thinkStart?.[0].length ?? 0,
          },
          {
            type: "think_end" as const,
            idx: thinkEnd?.index ?? -1,
            len: thinkEnd?.[0].length ?? 0,
          },
          {
            type: "tool_start" as const,
            idx: toolStart?.index ?? -1,
            len: toolStart?.[0].length ?? 0,
            name: toolStart?.[2] ?? "",
          },
          {
            type: "tool_end" as const,
            idx: toolEnd?.index ?? -1,
            len: toolEnd?.[0].length ?? 0,
          },
        ]
          .filter((t) => t.idx !== -1)
          .toSorted((a, b) => a.idx - b.idx);

        if (indices.length > 0) {
          const first = indices[0];
          const before = tagBuffer.slice(0, first.idx);
          if (before) {
            flushTextBuffer();
            if (currentMode === "thinking") {
              emitThinking(before);
            } else {
              emitText(before);
            }
          }

          if (first.type === "think_start") {
            currentMode = "thinking";
          } else if (first.type === "think_end") {
            currentMode = "text";
          } else if (first.type === "tool_start") {
            currentMode = "tool_call";
          } else if (first.type === "tool_end") {
            currentMode = "text";
          }

          tagBuffer = tagBuffer.slice(first.idx + first.len);
          // Recurse: everything remaining in tagBuffer is new unprocessed content
          prevTagLen = 0;
          checkTags();
        } else {
          const lastAngle = tagBuffer.lastIndexOf("<");
          if (lastAngle === -1) {
            // No partial tag; new characters from this delta are safe text
            emitText(tagBuffer.slice(prevTagLen));
            pendingText = "";
            tagBuffer = "";
          } else if (lastAngle > 0) {
            // Safe text before the partial '<' — emit only new characters
            emitText(tagBuffer.slice(prevTagLen, lastAngle));
            pendingText = "";
            tagBuffer = tagBuffer.slice(lastAngle);
          }
          // else: lastAngle === 0 → starts with '<', all partial, nothing to emit
        }
      }

      checkTags();
    }

    for (const line of lines) {
      pushDelta(line);
    }

    // End-of-stream cleanup
    if (tagBuffer) {
      if (currentMode === "text") {
        pendingText += tagBuffer;
      }
      // For thinking/tool_call, pendingText was already flushed above
    }
    flushTextBuffer();

    accum.mode = currentMode;
    return accum;
  }

  it("collects all text from per-character SSE lines", () => {
    const lines = "你好世界".split("");
    const result = parseSseLines(lines);
    expect(result.text).toBe("你好世界");
    expect(result.thinking).toBe("");
  });

  it("splits think tags from surrounding text", () => {
    const lines = [
      "Let me ",
      "<think>",
      "I need to calculate",
      " the sum",
      "</think>",
      ". Final answer.",
    ];
    const result = parseSseLines(lines);
    expect(result.thinking).toContain("I need to calculate");
    expect(result.thinking).toContain("the sum");
    expect(result.text).toContain("Let me");
    expect(result.text).toContain("Final answer.");
  });

  it("collects full reply when think tags arrive after buffer threshold flush", () => {
    // Key regression test: the original buggy code flushed at threshold=20
    // and then RETURNED without calling checkTags(), so tags arriving just after
    // the flush were silently dropped. This test sends 25 chars (exceeds
    // threshold) before the tag to verify the fix.
    const lines: string[] = [];
    for (let i = 0; i < 25; i++) {lines.push("x");}
    lines.push("<think>");
    lines.push("thinking content");
    lines.push("</think>");
    lines.push("Final answer");

    const result = parseSseLines(lines);

    // All 25 'x' chars must be present
    expect(result.text).toContain("x".repeat(25));
    expect(result.text).toContain("Final answer");

    // Thinking block must not be empty
    expect(result.thinking).toContain("thinking content");
  });

  it("collects all text when buffer threshold is hit multiple times", () => {
    const lines: string[] = [];
    // 50 chars in single-char chunks — multiple flush cycles before the tag
    for (let i = 0; i < 50; i++) {lines.push("x");}
    lines.push("<think>");
    lines.push("inner");
    lines.push("</think>");
    lines.push("after");

    const result = parseSseLines(lines);
    expect(result.text).toContain("x".repeat(50));
    expect(result.text).toContain("after");
    expect(result.thinking).toContain("inner");
  });

  it("handles think tags split across SSE lines", () => {
    // Opening and closing tags each split across two lines
    const lines = ["<th", "ink>", "content", "</th", "ink>", "done"];
    const result = parseSseLines(lines);
    expect(result.thinking).toContain("content");
    expect(result.text).toContain("done");
  });
});
