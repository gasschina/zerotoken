import type { StreamFn } from "@mariozechner/pi-agent-core";
import {
  createAssistantMessageEventStream,
  type AssistantMessage,
  type TextContent,
  type ThinkingContent,
  type ToolCall,
  type ToolResultMessage,
} from "@mariozechner/pi-ai";
import {
  DoubaoWebClientBrowser,
  type DoubaoWebClientOptions,
} from "../providers/doubao-web-client-browser.js";

const sessionMap = new Map<string, string>();

export function createDoubaoWebStreamFn(cookieOrJson: string): StreamFn {
  let options: DoubaoWebClientOptions;
  try {
    const parsed = JSON.parse(cookieOrJson);
    options = parsed;
  } catch {
    options = { cookie: cookieOrJson, sessionid: "" };
  }
  const client = new DoubaoWebClientBrowser(options);

  return (model, context, streamOptions) => {
    const stream = createAssistantMessageEventStream();

    const run = async () => {
      try {
        await client.init();

        const sessionKey = (context as unknown as { sessionId?: string }).sessionId || "default";
        let sessionId = sessionMap.get(sessionKey);

        const messages = context.messages || [];

        // Build tool prompt if tools are available
        const tools = context.tools || [];
        let toolPrompt = "";

        if (tools.length > 0) {
          toolPrompt = "\n## Available Tools\n";
          for (const tool of tools) {
            toolPrompt += `- ${tool.name}: ${tool.description}\n`;
          }
        }

        // Build prompt based on conversation state
        let prompt = "";

        if (!sessionId) {
          // First turn: send only the last user message to avoid exceeding
          // Doubao's prompt length limit. Full conversation history is only
          // needed after a session ID is established.
          const lastUserMessage = [...messages].toReversed().find((m) => m.role === "user");
          if (lastUserMessage) {
            if (typeof lastUserMessage.content === "string") {
              prompt = lastUserMessage.content;
            } else if (Array.isArray(lastUserMessage.content)) {
              prompt = lastUserMessage.content
                .filter((part) => part.type === "text")
                .map((part) => part.text)
                .join("");
            }
          }
          // Add tool reminder if tools are available
          if (toolPrompt && prompt) {
            prompt +=
              "\n\n[SYSTEM HINT]: Keep in mind your available tools. To use a tool, you MUST output the EXACT XML format: <tool_call id=\"unique_id\" name=\"tool_name\">{\"arg\": \"value\"}</tool_call>.";
          }
        } else {
          // Continuing turn: check if last message is toolResult or user
          const lastMsg = messages[messages.length - 1];
          if (lastMsg?.role === "toolResult") {
            const tr = lastMsg as unknown as ToolResultMessage;
            let resultText = "";
            if (Array.isArray(tr.content)) {
              for (const part of tr.content) {
                if (part.type === "text") {
                  resultText += part.text;
                }
              }
            }
            prompt = `\n<tool_response id="${tr.toolCallId}" name="${tr.toolName}">\n${resultText}\n</tool_response>\n\nPlease proceed based on this tool result.`;
          } else {
            const lastUserMessage = [...messages].toReversed().find((m) => m.role === "user");
            if (lastUserMessage) {
              if (typeof lastUserMessage.content === "string") {
                prompt = lastUserMessage.content;
              } else if (Array.isArray(lastUserMessage.content)) {
                prompt = lastUserMessage.content
                  .filter((part) => part.type === "text")
                  .map((part) => part.text)
                  .join("");
              }
            }
          }
        }

        // Add tool reminder for continuing conversations
        if (toolPrompt && sessionId) {
          prompt +=
            '\n\n[SYSTEM HINT]: Keep in mind your available tools. To use a tool, you MUST output the EXACT XML format: <tool_call id="unique_id" name="tool_name">{"arg": "value"}</tool_call>. Using plain text to describe your action will FAIL to execute the tool.';
        }

        if (!prompt) {
          throw new Error("No message found to send to DoubaoWeb API");
        }

        console.log(`[DoubaoWebStream] Starting run for session: ${sessionKey}`);
        console.log(`[DoubaoWebStream] Conversation ID: ${sessionId || "new"}`);
        console.log(`[DoubaoWebStream] Tools available: ${tools.length}`);
        console.log(`[DoubaoWebStream] Prompt length: ${prompt.length}`);

        const responseStream = await client.chatCompletions({
          messages: [{ role: "user", content: prompt }],
          model: model.id,
          signal: streamOptions?.signal,
        });

        if (!responseStream) {
          throw new Error("DoubaoWeb API returned empty response body");
        }

        const reader = responseStream.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const indexMap = new Map<string, number>();
        let nextIndex = 0;
        const contentParts: (TextContent | ThinkingContent | ToolCall)[] = [];
        const accumulatedToolCalls: {
          id: string;
          name: string;
          arguments: string;
          index: number;
        }[] = [];

        const createPartial = (): AssistantMessage => {
          const msg: AssistantMessage = {
            role: "assistant",
            content: [...contentParts],
            api: model.api,
            provider: model.provider,
            model: model.id,
            usage: {
              input: 0,
              output: 0,
              cacheRead: 0,
              cacheWrite: 0,
              totalTokens: 0,
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
            },
            stopReason: accumulatedToolCalls.length > 0 ? "toolUse" : "stop",
            timestamp: Date.now(),
          };
          (msg as AssistantMessage & { thinking_enabled?: boolean }).thinking_enabled =
            contentParts.some((p) => p.type === "thinking");
          return msg;
        };

        let currentMode: "text" | "thinking" | "tool_call" = "text";
        let currentToolName = "";
        let currentToolIndex = 0;
        let tagBuffer = "";

        const emitDelta = (
          type: "text" | "thinking" | "toolcall",
          delta: string,
          forceId?: string,
        ) => {
          if (delta === "" && type !== "toolcall") {
            return;
          }
          const key = type === "toolcall" ? `tool_${currentToolIndex}` : type;

          if (!indexMap.has(key)) {
            const index = nextIndex++;
            indexMap.set(key, index);
            if (type === "text") {
              contentParts[index] = { type: "text", text: "" };
              stream.push({ type: "text_start", contentIndex: index, partial: createPartial() });
            } else if (type === "thinking") {
              contentParts[index] = { type: "thinking", thinking: "" };
              stream.push({
                type: "thinking_start",
                contentIndex: index,
                partial: createPartial(),
              });
            } else if (type === "toolcall") {
              const toolId = forceId || `call_${Date.now()}_${index}`;
              contentParts[index] = {
                type: "toolCall",
                id: toolId,
                name: currentToolName,
                arguments: {},
              };
              accumulatedToolCalls[currentToolIndex] = {
                id: toolId,
                name: currentToolName,
                arguments: "",
                index: currentToolIndex,
              };
              stream.push({
                type: "toolcall_start",
                contentIndex: index,
                partial: createPartial(),
              });
            }
          }

          const index = indexMap.get(key)!;
          if (type === "text") {
            (contentParts[index] as TextContent).text += delta;
            stream.push({
              type: "text_delta",
              contentIndex: index,
              delta,
              partial: createPartial(),
            });
          } else if (type === "thinking") {
            (contentParts[index] as ThinkingContent).thinking += delta;
            stream.push({
              type: "thinking_delta",
              contentIndex: index,
              delta,
              partial: createPartial(),
            });
          } else if (type === "toolcall") {
            accumulatedToolCalls[currentToolIndex].arguments += delta;
            stream.push({
              type: "toolcall_delta",
              contentIndex: index,
              delta,
              partial: createPartial(),
            });
          }
        };

        // Accumulate raw text in a simple buffer and flush in batches to reduce
        // UI update frequency. Doubao sends every single Chinese character as a
        // separate SSE line, which floods the UI with tiny text_delta events.
        let textBuffer = "";
        const textFlushThreshold = 20;

        const flushTextBuffer = () => {
          if (!textBuffer) {return;}
          const text = textBuffer;
          textBuffer = "";
          emitDelta("text", text);
        };

        const pushDelta = (delta: string, forceType?: "text" | "thinking") => {
          if (!delta) {return;}

          // Always accumulate into tagBuffer first so checkTags() can detect boundaries.
          tagBuffer += delta;

          // thinking content is emitted immediately — but we still need checkTags()
          // to run so the closing </think> tag is detected and we switch back to text.
          if (forceType === "thinking" || currentMode === "thinking") {
            flushTextBuffer();
            emitDelta("thinking", delta);
            if (forceType === "thinking") {
              tagBuffer = ""; // consumed the whole delta
              return;
            }
            // fall through to checkTags() to detect </think>
          }

          // tool_call args are emitted immediately — checkTags() still runs for 」
          if (currentMode === "tool_call") {
            flushTextBuffer();
            emitDelta("toolcall", delta);
          } else {
            // text mode: accumulate, flush at threshold
            textBuffer += delta;
            if (textBuffer.length >= textFlushThreshold) {
              flushTextBuffer();
            }
          }

          // Always parse tag boundaries from the full accumulated tagBuffer,
          // regardless of how much text has been buffered or flushed.
          // prevTagLen = where delta starts in tagBuffer; used in the else branch to
          // avoid double-emitting text that was already flushed before this delta.
          let prevTagLen = tagBuffer.length - delta.length;
          const checkTags = () => {
            const thinkStart = tagBuffer.match(/<think\b[^<>]*>/i);
            const thinkEnd = tagBuffer.match(/<\/think\b[^<>]*>/i);
            const toolCallStart = tagBuffer.match(
              /<tool_call\s*(?:id=['"]?([^'"]+)['"]?\s*)?name=['"]?([^'"]+)['"]?\s*>/i,
            );
            const toolCallEnd = tagBuffer.match(/<\/tool_call\s*>/i);

            const indices = [
              {
                type: "think_start",
                idx: thinkStart?.index ?? -1,
                len: thinkStart?.[0].length ?? 0,
              },
              { type: "think_end", idx: thinkEnd?.index ?? -1, len: thinkEnd?.[0].length ?? 0 },
              {
                type: "tool_start",
                idx: toolCallStart?.index ?? -1,
                len: toolCallStart?.[0].length ?? 0,
                id: toolCallStart?.[1],
                name: toolCallStart?.[2],
              },
              {
                type: "tool_end",
                idx: toolCallEnd?.index ?? -1,
                len: toolCallEnd?.[0].length ?? 0,
              },
            ]
              .filter((t) => t.idx !== -1)
              .toSorted((a, b) => a.idx - b.idx);

            if (indices.length > 0) {
              const first = indices[0];
              const before = tagBuffer.slice(0, first.idx);
              if (before) {
                // Flush pending text (which includes the "before" content).
                // Then emit "before" as thinking/toolcall if needed.
                flushTextBuffer();
                if (currentMode === "thinking") {
                  emitDelta("thinking", before);
                } else if (currentMode === "tool_call") {
                  emitDelta("toolcall", before);
                }
                // If text mode: textBuffer (which included "before") was already
                // emitted by flushTextBuffer(); do NOT emit again (would double).
              }

              if (first.type === "think_start") {
                currentMode = "thinking";
              } else if (first.type === "think_end") {
                currentMode = "text";
              } else if (first.type === "tool_start") {
                currentMode = "tool_call";
                currentToolName = first.name!;
                emitDelta("toolcall", "", first.id);
              } else if (first.type === "tool_end") {
                const index = indexMap.get(`tool_${currentToolIndex}`);
                if (index !== undefined) {
                  const part = contentParts[index] as ToolCall;
                  const argStr = accumulatedToolCalls[currentToolIndex].arguments || "{}";

                  let cleanedArg = argStr.trim();
                  if (cleanedArg.startsWith("```json")) {
                    cleanedArg = cleanedArg.substring(7);
                  } else if (cleanedArg.startsWith("```")) {
                    cleanedArg = cleanedArg.substring(3);
                  }
                  if (cleanedArg.endsWith("```")) {
                    cleanedArg = cleanedArg.substring(0, cleanedArg.length - 3);
                  }
                  cleanedArg = cleanedArg.trim();

                  try {
                    part.arguments = JSON.parse(cleanedArg);
                  } catch (e) {
                    part.arguments = { raw: argStr };
                    console.error(
                      `[Doubao Stream] Failed to parse JSON for tool call ${currentToolName}:`,
                      argStr,
                      "\nError:",
                      e,
                    );
                  }
                  stream.push({
                    type: "toolcall_end",
                    contentIndex: index,
                    toolCall: part,
                    partial: createPartial(),
                  });
                }
                currentMode = "text";
                currentToolIndex++;
              }
              tagBuffer = tagBuffer.slice(first.idx + first.len);
              // Recurse: everything remaining in tagBuffer is new unprocessed content.
              prevTagLen = 0;
              checkTags();
            } else {
              // No tags found — check for partial tag at the end of buffer.
              // prevTagLen (from pushDelta closure) tells us where new delta starts so
              // we only emit characters not already accounted for by a previous flush.
              const lastAngle = tagBuffer.lastIndexOf("<");
              if (lastAngle === -1) {
                // No partial tag; new characters from this delta are safe text
                textBuffer += tagBuffer.slice(prevTagLen);
                tagBuffer = "";
              } else if (lastAngle > 0) {
                const safe = tagBuffer.slice(0, lastAngle);
                textBuffer += safe;
                tagBuffer = tagBuffer.slice(lastAngle);
              }
              // else: lastAngle === 0 → starts with '<', all in tagBuffer, nothing to flush
            }
          };
          checkTags();
        };

        const processLine = (line: string) => {
          if (!line || !line.startsWith("data:")) {
            return;
          }

          const dataStr = line.slice(5).trim();
          if (dataStr === "[DONE]" || !dataStr) {
            return;
          }

          try {
            const data = JSON.parse(dataStr);

            // Extract conversation ID
            if (data.sessionId) {
              sessionMap.set(sessionKey, data.sessionId);
            }

            // Handle Doubao's event-based response format
            // event_type 2002 = message created, event_type 2003 = content delta
            let delta = "";

            if (data.event_type === 2003 && data.event_data) {
              // Content delta event - extract text from event_data
              try {
                const eventData = JSON.parse(data.event_data);
                delta = eventData.text || eventData.content || eventData.delta || "";
              } catch {
                delta = data.event_data;
              }
            } else if (data.event_data) {
              // Try to parse event_data for content
              try {
                const eventData =
                  typeof data.event_data === "string"
                    ? JSON.parse(data.event_data)
                    : data.event_data;
                delta =
                  eventData.text ||
                  eventData.content ||
                  eventData.delta ||
                  eventData.message?.content ||
                  "";
              } catch {
                // event_data is not JSON
              }
            }

            // Also try standard format
            if (!delta) {
              delta = data.choices?.[0]?.delta?.content ?? data.text ?? data.content ?? data.delta;
            }

            if (typeof delta === "string" && delta) {
              pushDelta(delta);
            }
          } catch {
            // Ignore parse errors
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            if (buffer.trim()) {
              processLine(buffer.trim());
            }
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          const combined = buffer + chunk;
          const parts = combined.split("\n");
          buffer = parts.pop() || "";

          for (const part of parts) {
            processLine(part.trim());
          }
        }

        // Flush any remaining text buffer and tag buffer at end of stream
        if (tagBuffer) {
          const mode =
            (currentMode as string) === "thinking"
              ? "thinking"
              : (currentMode as string) === "tool_call"
                ? "toolcall"
                : "text";
          if (mode === "text") {
            // All remaining tagBuffer content is text
            textBuffer += tagBuffer;
          } else {
            // thinking or tool_call mode: flush pending text, then emit the
            // trailing tagBuffer content as the appropriate delta type
            flushTextBuffer();
            emitDelta(mode, tagBuffer);
          }
        }
        flushTextBuffer();

        console.log(
          `[DoubaoWebStream] Stream completed. Parts: ${contentParts.length}, Tools: ${accumulatedToolCalls.length}`,
        );

        stream.push({
          type: "done",
          reason: accumulatedToolCalls.length > 0 ? "toolUse" : "stop",
          message: createPartial(),
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        stream.push({
          type: "error",
          reason: "error",
          error: {
            role: "assistant",
            content: [],
            stopReason: "error",
            errorMessage,
            api: model.api,
            provider: model.provider,
            model: model.id,
            usage: {
              input: 0,
              output: 0,
              cacheRead: 0,
              cacheWrite: 0,
              totalTokens: 0,
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
            },
            timestamp: Date.now(),
          },
        } as any);
      } finally {
        stream.end();
      }
    };

    queueMicrotask(() => void run());
    return stream;
  };
}
