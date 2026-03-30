import type { StreamFn } from "@mariozechner/pi-agent-core";
import {
  createAssistantMessageEventStream,
  type AssistantMessage,
  type AssistantMessageEvent,
  type TextContent,
  type ThinkingContent,
  type ToolCall,
  type ToolResultMessage,
} from "@mariozechner/pi-ai";
import {
  DeepSeekWebClient,
  type DeepSeekWebClientOptions,
} from "../providers/deepseek-web-client.js";

// Helper to strip messages for web providers
function stripForWebProvider(prompt: string): string {
  return prompt;
}

// Keep track of session IDs per session key to avoid creating too many web chat sessions
const sessionMap = new Map<string, string>();
const parentMessageMap = new Map<string, string | number>();

type MessageContentPart = {
  type: string;
  text?: string;
  name?: string;
  arguments?: string;
  index?: number;
  id?: string;
};

export function createDeepseekWebStreamFn(cookieOrJson: string): StreamFn {
  let options: string | DeepSeekWebClientOptions;
  try {
    const parsed = JSON.parse(cookieOrJson);
    if (typeof parsed === "string") {
      options = { cookie: parsed };
    } else {
      options = parsed;
    }
  } catch {
    options = { cookie: cookieOrJson };
  }
  const client = new DeepSeekWebClient(options);

  return (model, context, options) => {
    const stream = createAssistantMessageEventStream();

    const run = async () => {
      try {
        await client.init();

        const sessionKey = (context as unknown as { sessionId?: string }).sessionId || "default";
        let dsSessionId = sessionMap.get(sessionKey);
        let parentId = parentMessageMap.get(sessionKey);

        if (!dsSessionId) {
          const session = await client.createChatSession();
          dsSessionId = session.chat_session_id || "";
          sessionMap.set(sessionKey, dsSessionId);
          parentId = undefined; // New session starts fresh
        }

        const messages = context.messages || [];
        const systemPrompt = (context as unknown as { systemPrompt?: string }).systemPrompt || "";
        console.log(
          `[DeepseekWebStream] Context messages count: ${messages.length}, hasSystemPrompt: ${!!systemPrompt}`,
        );
        let prompt = "";

        if (!parentId) {
          // First turn or new session: Aggregate all history including System Prompt
          const historyParts: string[] = [];

          const tools = context.tools || [];
          let systemPromptContent = systemPrompt;

          if (tools.length > 0) {
            let toolPrompt = "\n## Available Tools\n";
            for (const tool of tools) {
              toolPrompt += `- ${tool.name}: ${tool.description}\n`;
            }
            systemPromptContent += toolPrompt;
          }

          if (systemPromptContent && !messages.some((m) => (m.role as string) === "system")) {
            console.log(
              `[DeepseekWebStream] Prepending separate systemPrompt (length=${systemPromptContent.length})`,
            );
            historyParts.push(`System: ${systemPromptContent}`);
          }

          for (const m of messages) {
            const role =
              (m.role as string) === "user" || (m.role as string) === "toolResult"
                ? "User"
                : "Assistant";
            let content = "";

            if (m.role === "toolResult") {
              const tr = m as unknown as ToolResultMessage;
              let resultText = "";
              if (Array.isArray(tr.content)) {
                for (const part of tr.content) {
                  if (part.type === "text") {
                    resultText += part.text;
                  }
                }
              }
              content = `\n<tool_response id="${tr.toolCallId}" name="${tr.toolName}">\n${resultText}\n</tool_response>\n`;
            } else if (Array.isArray(m.content)) {
              for (const part of m.content) {
                if (part.type === "text") {
                  content += part.text;
                } else if (part.type === "thinking") {
                  content += `<think>\n${part.thinking}\n</think>\n`;
                } else if (part.type === "toolCall") {
                  const tc = part;
                  content += `<tool_call id="${tc.id}" name="${tc.name}">${JSON.stringify(tc.arguments)}</tool_call>`;
                }
              }
            } else {
              content = String(m.content);
            }

            if ((m.role as string) === "user" && content) {
              content = stripForWebProvider(content) || content;
            }

            console.log(
              `[DeepseekWebStream] Message[${messages.indexOf(m)}] role=${m.role} length=${content.length} preview=${content.slice(0, 50).replace(/\n/g, " ")}`,
            );
            historyParts.push(`${role}: ${content}`);
          }

          prompt = historyParts.join("\n\n");
        } else {
          // Continuing turn: Check if the last record is a ToolResult or User message
          const lastMsg = messages[messages.length - 1];
          if (lastMsg.role === "toolResult") {
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
            // Standard user message logic
            const lastUserMessage = [...messages].toReversed().find((m) => m.role === "user");
            if (lastUserMessage) {
              if (typeof lastUserMessage.content === "string") {
                prompt = stripForWebProvider(lastUserMessage.content) || lastUserMessage.content;
              } else if (Array.isArray(lastUserMessage.content)) {
                const raw = (lastUserMessage.content as MessageContentPart[])
                  .filter((part) => part.type === "text")
                  .map((part) => (part as TextContent).text)
                  .join("");
                prompt = stripForWebProvider(raw) || raw;
              }
            }
          }
        }

        console.log(
          `[DeepseekWebStream] Starting run for session: ${sessionKey}. DS session: ${dsSessionId}. Parent: ${parentId}. Prompt length: ${prompt.length}`,
        );
        console.log(`[DeepseekWebStream] Full Prompt Preview: ${prompt.slice(0, 500)}...`);

        if (!prompt) {
          console.error(`[DeepseekWebStream] No prompt to send:`, JSON.stringify(messages));
          throw new Error("No message found to send to DeepSeek web API");
        }

        const searchEnabled =
          (options as unknown as { searchEnabled?: boolean })?.searchEnabled ?? true;
        const preempt = (options as unknown as { preempt?: boolean })?.preempt ?? false;
        const fileIds = (options as unknown as { fileIds?: string[] })?.fileIds || [];

        const responseStream = await client.chatCompletions({
          sessionId: dsSessionId,
          parentMessageId: parentId,
          message: prompt,
          model: model.id,
          searchEnabled,
          preempt,
          fileIds,
          signal: options?.signal,
        });

        if (!responseStream) {
          throw new Error("DeepSeek Web API returned empty response body");
        }

        const reader = responseStream.getReader();
        const decoder = new TextDecoder();
        let accumulatedContent = "";
        let accumulatedReasoning = "";
        const accumulatedToolCalls: MessageContentPart[] = [];
        let buffer = "";

        // Sequential indexing for pi-ai AssistantMessage events
        const indexMap = new Map<string, number>();
        let nextIndex = 0;
        const contentParts: (TextContent | ThinkingContent | ToolCall)[] = [];

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
          (msg as unknown as { thinking_enabled: boolean }).thinking_enabled =
            !!accumulatedReasoning;
          return msg;
        };

        // Stateful parser for tags in the text stream
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
                type: "tool_call",
                name: currentToolName,
                arguments: "",
                index: currentToolIndex,
                id: toolId,
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
            accumulatedContent += delta;
            stream.push({
              type: "text_delta",
              contentIndex: index,
              delta,
              partial: createPartial(),
            });
          } else if (type === "thinking") {
            (contentParts[index] as ThinkingContent).thinking += delta;
            accumulatedReasoning += delta;
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

        const pushDelta = (delta: string, forceType?: "text" | "thinking") => {
          if (!delta) {
            return;
          }

          // Junk token filtering
          const JUNK_TOKENS = ["<｜end▁of▁thinking｜>", "<|endoftext|>"];
          if (JUNK_TOKENS.includes(delta)) {
            console.log(`[DeepseekWebStream] Filtering junk token: ${delta}`);
            return;
          }

          if (forceType === "thinking") {
            emitDelta("thinking", delta);
            return;
          }

          tagBuffer += delta;

          const checkTags = () => {
            const thinkStartMatch = tagBuffer.match(/<(?:think(?:ing)?|thought)\b[^<>]*>/i);
            const thinkEndMatch = tagBuffer.match(/<\/(?:think(?:ing)?|thought)\b[^<>]*>/i);
            const finalStartMatch = tagBuffer.match(/<final\b[^<>]*>/i);
            const finalEndMatch = tagBuffer.match(/<\/final\b[^<>]*>/i);
            const toolCallStartMatch = tagBuffer.match(
              /<tool_call\s+(?:id=['"]?([^'"]+)['"]?\s+)?name=['"]?([^'"]+)['"]?\s*>/i,
            );
            const toolCallEndMatch = tagBuffer.match(/<\/tool_call\b[^<>]*>/i);
            const replyMatch = tagBuffer.match(/\[\[reply_to_current\]\]/i);
            const malformedThinkMatch = tagBuffer.match(/\n?think\s*>/i);

            // Priority: find the first occurring tag
            const indices = [
              {
                type: "think_start",
                idx: thinkStartMatch ? thinkStartMatch.index! : -1,
                len: thinkStartMatch ? thinkStartMatch[0].length : 0,
              },
              {
                type: "think_end",
                idx: thinkEndMatch ? thinkEndMatch.index! : -1,
                len: thinkEndMatch ? thinkEndMatch[0].length : 0,
              },
              {
                type: "final_start",
                idx: finalStartMatch ? finalStartMatch.index! : -1,
                len: finalStartMatch ? finalStartMatch[0].length : 0,
              },
              {
                type: "final_end",
                idx: finalEndMatch ? finalEndMatch.index! : -1,
                len: finalEndMatch ? finalEndMatch[0].length : 0,
              },
              {
                type: "tool_call_start",
                idx: toolCallStartMatch ? toolCallStartMatch.index! : -1,
                len: toolCallStartMatch ? toolCallStartMatch[0].length : 0,
                id: toolCallStartMatch ? toolCallStartMatch[1] : null,
                name: toolCallStartMatch ? toolCallStartMatch[2] : "",
              },
              {
                type: "tool_call_end",
                idx: toolCallEndMatch ? toolCallEndMatch.index! : -1,
                len: toolCallEndMatch ? toolCallEndMatch[0].length : 0,
              },
              {
                type: "reply_marker",
                idx: replyMatch ? replyMatch.index! : -1,
                len: replyMatch ? replyMatch[0].length : 0,
              },
              {
                type: "think_start", // Treat malformed think> as start
                idx: malformedThinkMatch ? malformedThinkMatch.index! : -1,
                len: malformedThinkMatch ? malformedThinkMatch[0].length : 0,
              },
            ]
              .filter((tag) => tag.idx !== -1)
              .toSorted((a, b) => a.idx - b.idx);

            if (indices.length > 0) {
              const first = indices[0];
              console.log(`[DeepseekWebStream] Tag detected: ${first.type} at ${first.idx}`);
              const before = tagBuffer.slice(0, first.idx);

              if (before) {
                if (currentMode === "thinking") {
                  emitDelta("thinking", before);
                } else if (currentMode === "tool_call") {
                  emitDelta("toolcall", before);
                } else {
                  emitDelta("text", before);
                }
              }

              if (first.type === "think_start") {
                currentMode = "thinking";
              } else if (first.type === "think_end") {
                currentMode = "text";
              } else if (first.type === "final_start") {
                currentMode = "text";
              } else if (first.type === "final_end") {
                currentMode = "text";
              } else if (first.type === "reply_marker") {
                currentMode = "text";
              } else if (first.type === "tool_call_start") {
                currentMode = "tool_call";
                currentToolName = first.name!;
                const toolId = first.id || `call_${Date.now()}_${currentToolIndex}`;
                emitDelta("toolcall", "", toolId); // Trigger start event with specific ID
              } else if (first.type === "tool_call_end") {
                const key = `tool_${currentToolIndex}`;
                const index = indexMap.get(key);
                if (index !== undefined) {
                  const part = contentParts[index] as ToolCall;
                  const argStr = accumulatedToolCalls[currentToolIndex].arguments || "{}";
                  try {
                    part.arguments = JSON.parse(argStr);
                  } catch {
                    part.arguments = { raw: argStr };
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
                currentToolName = "";
              }

              tagBuffer = tagBuffer.slice(first.idx + first.len);
              checkTags();
            } else {
              // No complete tags. Emit "safe" part of buffer.
              // Safe part is anything before the last '<'
              const lastAngle = tagBuffer.lastIndexOf("<");
              if (lastAngle === -1) {
                if (currentMode === "thinking") {
                  emitDelta("thinking", tagBuffer);
                } else if (currentMode === "tool_call") {
                  emitDelta("toolcall", tagBuffer);
                } else {
                  emitDelta("text", tagBuffer);
                }
                tagBuffer = "";
              } else if (lastAngle > 0) {
                const safe = tagBuffer.slice(0, lastAngle);
                if (currentMode === "thinking") {
                  emitDelta("thinking", safe);
                } else if (currentMode === "tool_call") {
                  emitDelta("toolcall", safe);
                } else {
                  emitDelta("text", safe);
                }
                tagBuffer = tagBuffer.slice(lastAngle);
              }
              // If lastAngle is 0, we must keep it in buffer to see if it's a tag
            }
          };

          checkTags();
        };

        const processLine = (line: string) => {
          if (!line) {
            return;
          }

          if (line.startsWith("event: ")) {
            return; // We don't strictly need currentEvent if we trust the data structure
          }

          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6).trim();
            if (dataStr === "[DONE]") {
              return;
            }
            if (!dataStr) {
              return;
            }

            try {
              const data = JSON.parse(dataStr);
              // Verbose logging for debugging
              // console.log(`[DeepseekWebStream] SSE Data: ${dataStr}`);

              // Capture session/message continuity
              if (data.response_message_id) {
                if (data.response_message_id !== parentMessageMap.get(sessionKey)) {
                  console.log(
                    `[DeepseekWebStream] New parentMessageId: ${data.response_message_id}`,
                  );
                  parentMessageMap.set(sessionKey, data.response_message_id);
                }
              }

              // 1. Path update or explicit type for reasoning
              if (
                (data.p?.includes("reasoning") || data.type === "thinking") &&
                typeof data.v === "string"
              ) {
                pushDelta(data.v, "thinking");
                return;
              }
              if (data.type === "thinking" && typeof data.content === "string") {
                pushDelta(data.content, "thinking");
                return;
              }

              // 2. Direct string value, content path, or explicit type (XML tags might be here)
              if (
                typeof data.v === "string" &&
                (!data.p || data.p.includes("content") || data.p.includes("choices"))
              ) {
                pushDelta(data.v);
                return;
              }
              if (data.type === "text" && typeof data.content === "string") {
                pushDelta(data.content);
                return;
              }

              // 2.5 search results (if enabled)
              if (data.type === "search_result" || data.p?.includes("search_results")) {
                const searchData = data.v || data.content;
                const query =
                  typeof searchData === "string"
                    ? searchData
                    : (searchData as { query?: string })?.query;
                if (query) {
                  const searchMsg = `\n> [Researching: ${query}...]\n`;
                  if (currentMode === "thinking") {
                    emitDelta("thinking", searchMsg);
                  } else {
                    emitDelta("text", searchMsg);
                  }
                }
                return;
              }

              // 3. Nested fragments (init)
              const fragments = data.v?.response?.fragments;
              if (Array.isArray(fragments)) {
                for (const frag of fragments) {
                  if (frag.type === "THINKING" || frag.type === "reasoning") {
                    pushDelta(frag.content || "", "thinking");
                  } else if (frag.content) {
                    pushDelta(frag.content);
                  }
                }
                return;
              }

              // 4. Standard OpenAI-like choices (just in case)
              const choice = data.choices?.[0];
              if (choice) {
                if (choice.delta?.reasoning_content) {
                  pushDelta(choice.delta.reasoning_content, "thinking");
                }
                if (choice.delta?.content) {
                  pushDelta(choice.delta.content);
                }
              }
            } catch {
              // Ignore partial JSON
            }
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            if (buffer.trim()) {
              processLine(buffer.trim());
            }

            // Flush any remaining tag buffer
            // Flush any remaining tag buffer
            if (tagBuffer) {
              const mode = currentMode as unknown as string;
              if (mode === "thinking") {
                emitDelta("thinking", tagBuffer);
              } else if (mode === "tool_call") {
                emitDelta("toolcall", tagBuffer);
              } else {
                emitDelta("text", tagBuffer);
              }
              tagBuffer = "";
            }
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          const combined = buffer + chunk;
          const parts = combined.split("\n");
          buffer = parts.pop() || ""; // Save partial line

          for (const part of parts) {
            processLine(part.trim());
          }
        }

        console.log(
          `[DeepseekWebStream] Stream completed. Content: ${accumulatedContent.length}, reasoning: ${accumulatedReasoning.length}, toolCalls: ${accumulatedToolCalls.length}`,
        );

        // Filter internal tools from final message as per original logic,
        // but keep them in the stream parts for UI continuity.
        const INTERNAL_TOOLS = new Set(["web_search"]);
        const finalContent = contentParts.filter((part) => {
          if (part.type === "toolCall") {
            return !INTERNAL_TOOLS.has(part.name);
          }
          // Filter out empty thinking/text if they are totally empty to keep final message clean
          if (part.type === "thinking" && !part.thinking) {
            return false;
          }
          if (part.type === "text" && !part.text) {
            return false;
          }
          return true;
        });

        const assistantMessage: AssistantMessage = {
          role: "assistant",
          content: finalContent,
          stopReason: finalContent.some((p) => p.type === "toolCall") ? "toolUse" : "stop",
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
        };
        (assistantMessage as unknown as { thinking_enabled: boolean }).thinking_enabled =
          !!accumulatedReasoning;

        stream.push({
          type: "done",
          reason: assistantMessage.stopReason as "stop" | "length" | "toolUse",
          message: assistantMessage,
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
        } as AssistantMessageEvent);
      } finally {
        stream.end();
      }
    };

    queueMicrotask(() => void run());
    return stream;
  };
}
