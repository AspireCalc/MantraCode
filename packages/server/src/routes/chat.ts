import { z } from "zod";
import { Hono } from "hono";
import { createTools } from "../tools";
import { streamSSE } from "hono/streaming";
import { streamText as aiStreamText, stepCountIs } from "ai";
import { zValidator } from "@hono/zod-validator";
import { db } from "@mantracode/database/client";
import type { Prisma } from "@mantracode/database";
import { buildSystemPrompt } from "../system-prompt";
import { Mode, MessageStatus } from "@mantracode/database/enums";
import type { ChatStreamEvent, MessagePart } from "@mantracode/shared";
import { isSupportedChatModel, resolveChatModel } from "../lib/models";
import { toolCallArgsSchema, messagePartsSchema } from "@mantracode/shared";
import type { AuthenticatedEnv } from "../middleware/require-auth";

const submitSchema = z.object({
    content: z.string(),
    mode: z.enum(Mode),
    model: z.string().refine(isSupportedChatModel, "Unsupported model"),
});

const submitValidator = zValidator("json", submitSchema, (result, c) => {
    if (!result.success) {
        return c.json({ error: "Invalid request body" }, 400);
    }
});

type StreamState = {
    controller: AbortController;
    content: string;
    model: string;
    mode: Mode;
    done?: boolean;
};

const activeResumeSessionIds = new Set<string>();
const activeStreamControllers = new Map<string, StreamState>();

function buildConversationHistory(
    messages: {
        role: "USER" | "ASSISTANT" | "ERROR";
        content: string;
        status: MessageStatus
    }[],
) {
    return messages.flatMap((m) => {
        if (m.role === "ERROR") return [];
        if (m.role === "ASSISTANT" && m.content.length === 0) return [];
        return [
            {
                role: m.role === "USER" ? ("user" as const) : ("assistant" as const),
                content: m.content
            },
        ]
    })
};

function getResumableUserMessage(
    messages: {
        role: "USER" | "ASSISTANT" | "ERROR";
        model: string;
        mode: Mode;
    }[],
) {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== "USER") {
        return null;
    }

    return lastMessage;
};



type StreamParams = {
    sessionId: string;
    model: string;
    cwd: string | null;
    history: {
        role: "user" | "assistant";
        content: string;
    }[];
    mode: Mode;
    abortController: AbortController;
    streamState: StreamState;
};

async function streamAIResponse(
    stream: Parameters<Parameters<typeof streamSSE>[1]>[0],
    params: StreamParams,
) {
    const { sessionId, model, cwd, history, mode, abortController, streamState } = params;
    const startTime = Date.now();
    const parts: MessagePart[] = [];
    const resolvedModel = resolveChatModel(model);
    const tools = cwd ? createTools(cwd, mode) : undefined;

    function finalizeReasoningDuration(parts: MessagePart[], startTime: number) {
        const elapsed = Date.now() - startTime;
        const lastPart = parts[parts.length - 1];
        if (lastPart?.type === "reasoning") {
            lastPart.durationMs = elapsed;
        }
    }

    try {
        const result = aiStreamText({
            tools,
            messages: history,
            model: resolvedModel.model,
            abortSignal: abortController.signal,
            system: buildSystemPrompt({ cwd, mode }),
            stopWhen: tools ? stepCountIs(50) : undefined,
            providerOptions: resolvedModel.providerOptions,
        });

        let reasoningGroupStartTime: number | null = null;

        for await (const part of result.fullStream) {
            if (stream.aborted) break;

            if (part.type === "reasoning-delta") {
                if (reasoningGroupStartTime === null) {
                    reasoningGroupStartTime = Date.now();
                }
                const last = parts[parts.length - 1];
                if (last && last.type === "reasoning") {
                    last.text += part.text;
                } else {
                    parts.push({ type: "reasoning", text: part.text });
                }

                const event: ChatStreamEvent = { type: "reasoning-delta", text: part.text };
                await stream.writeSSE({ event: "reasoning-delta", data: JSON.stringify(event) });
            }

            if (part.type === "text-delta") {
                if (reasoningGroupStartTime !== null) {
                    finalizeReasoningDuration(parts, reasoningGroupStartTime);
                    reasoningGroupStartTime = null;
                }
                const last = parts[parts.length - 1];
                if (last && last.type === "text") {
                    last.text += part.text;
                } else {
                    parts.push({ type: "text", text: part.text });
                }

                streamState.content += part.text;
                const event: ChatStreamEvent = { type: "text-delta", text: part.text };
                await stream.writeSSE({ event: "text-delta", data: JSON.stringify(event) });
            }

            if (part.type === "tool-call") {
                if (reasoningGroupStartTime !== null) {
                    finalizeReasoningDuration(parts, reasoningGroupStartTime);
                    reasoningGroupStartTime = null;
                }
                const args = toolCallArgsSchema.parse(part.input);

                parts.push({
                    type: "tool-call",
                    id: part.toolCallId,
                    name: part.toolName,
                    args,
                });

                const event: ChatStreamEvent = {
                    type: "tool-call",
                    toolCallId: part.toolCallId,
                    toolName: part.toolName,
                    args,
                };

                await stream.writeSSE({ event: "tool-call", data: JSON.stringify(event) });
            }

            if (part.type === "tool-result") {
                const resultString = typeof part.output === "string" ? part.output : JSON.stringify(part.output);

                const tcPart = parts.find((p): p is Extract<MessagePart, { type: "tool-call" }> => p.type === "tool-call" && p.id === part.toolCallId);

                if (tcPart) {
                    tcPart.result = resultString;
                }

                const event: ChatStreamEvent = {
                    type: "tool-result",
                    toolCallId: part.toolCallId,
                    result: resultString,
                };

                await stream.writeSSE({ event: "tool-result", data: JSON.stringify(event) });
            }

            if (part.type === "error") {
                throw part.error;
            }
        }

        if (reasoningGroupStartTime !== null) {
            finalizeReasoningDuration(parts, reasoningGroupStartTime);
            reasoningGroupStartTime = null;
        }

        if (!stream.aborted && !abortController.signal.aborted) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        if (stream.aborted || abortController.signal.aborted) {
            return;
        }

        const elapsedMs = Date.now() - startTime;

        const validatedParts: Prisma.InputJsonValue | undefined = parts.length > 0 ? messagePartsSchema.parse(parts) : undefined;

        const assistantMessage = await db.message.create({
            data: {
                sessionId,
                role: "ASSISTANT",
                status: MessageStatus.COMPLETE,
                parts: validatedParts,
                model,
                content: streamState.content,
                mode,
                duration: Math.round(elapsedMs / 1000),
            },
        });

        streamState.done = true;

        const doneEvent: ChatStreamEvent = {
            type: "done",
            messageId: assistantMessage.id,
            durationMs: elapsedMs,
        };

        await stream.writeSSE({ event: "done", data: JSON.stringify(doneEvent) });
    } catch (err) {
        if (abortController.signal.aborted) {
            return;
        }

        const message = err instanceof Error ? err.message : String(err);

        await db.message.create({
            data: {
                sessionId,
                role: "ERROR",
                status: MessageStatus.COMPLETE,
                model,
                content: message,
                mode,
            }
        });

        streamState.done = true;

        const errorEvent: ChatStreamEvent = { type: "error", message };
        await stream.writeSSE({ event: "error", data: JSON.stringify(errorEvent) });
    }
};

const app = new Hono<AuthenticatedEnv>()
    .post("/:sessionId/resume", async (c) => {
        const sessionId = c.req.param("sessionId");
        const userId = c.get("userId");

        const session = await db.session.findUnique({
            where: { id: sessionId, userId },
            include: { messages: { orderBy: { createdAt: "asc" } } },
        });

        if (!session) {
            return c.json({ error: "Session not found" }, 404);
        }

        const resumableMessage = getResumableUserMessage(session.messages);
        if (!resumableMessage) {
            return c.json({ error: "Session has no pending user message to resume" }, 409);
        }

        if (!isSupportedChatModel(resumableMessage.model)) {
            return c.json({ error: `Session uses unsupported model: ${resumableMessage.model}` }, 409);
        }

        if (activeStreamControllers.has(sessionId)) {
            return c.json({ error: "Session already has an active stream" }, 409);
        }

        const history = buildConversationHistory(session.messages);
        const abortController = new AbortController();
        const streamState: StreamState = {
            controller: abortController,
            content: "",
            model: resumableMessage.model,
            mode: resumableMessage.mode,
        };

        activeResumeSessionIds.add(sessionId);
        activeStreamControllers.set(sessionId, streamState);

        try {
            return streamSSE(
                c,
                async (stream) => {
                    stream.onAbort(() => {
                        abortController.abort();
                    });

                    try {
                        await streamAIResponse(stream, {
                            history,
                            sessionId,
                            streamState,
                            abortController,
                            cwd: session.cwd,
                            mode: resumableMessage.mode,
                            model: resumableMessage.model,
                        });
                    } finally {
                        activeResumeSessionIds.delete(sessionId);
                        activeStreamControllers.delete(sessionId);
                    }
                },
                async (err, stream) => {
                    activeResumeSessionIds.delete(sessionId);
                    activeStreamControllers.delete(sessionId);
                    const message = err instanceof Error ? err.message : String(err);
                    const errorEvent: ChatStreamEvent = { type: "error", message };
                    await stream.writeSSE({ event: "error", data: JSON.stringify(errorEvent) });
                },
            );
        } catch (error) {
            activeResumeSessionIds.delete(sessionId);
            activeStreamControllers.delete(sessionId);
            throw error;
        }
    })
    .post("/:sessionId", submitValidator, async (c) => {
        const sessionId = c.req.param("sessionId");
        const userId = c.get("userId");

        const session = await db.session.findUnique({
            where: { id: sessionId, userId },
            include: { messages: { orderBy: { createdAt: "asc" } } },
        });

        if (!session) {
            return c.json({ error: "Session not found" }, 404);
        }

        const data = c.req.valid("json");

        await db.message.create({
            data: {
                sessionId,
                role: "USER",
                status: MessageStatus.COMPLETE,
                model: data.model,
                content: data.content,
                mode: data.mode
            },
        });

        const history = buildConversationHistory([
            ...session.messages,
            {
                role: "USER" as const,
                content: data.content,
                status: MessageStatus.COMPLETE,
            },
        ]);

        const abortController = new AbortController();
        const streamState: StreamState = {
            controller: abortController,
            content: "",
            model: data.model,
            mode: data.mode,
        };
        activeStreamControllers.set(sessionId, streamState);

        return streamSSE(
            c,
            async (stream) => {
                stream.onAbort(() => {
                    abortController.abort();
                });

                await streamAIResponse(stream, {
                    history,
                    sessionId,
                    streamState,
                    abortController,
                    mode: data.mode,
                    cwd: session.cwd,
                    model: data.model,
                });
            },
            async (err, stream) => {
                activeStreamControllers.delete(sessionId);
                const message = err instanceof Error ? err.message : String(err);
                const errorEvent: ChatStreamEvent = { type: "error", message };
                await stream.writeSSE({ event: "error", data: JSON.stringify(errorEvent) });
            }
        )
    })
    .post("/:sessionId/interrupt", zValidator("json", z.object({
        content: z.string().optional(),
        parts: messagePartsSchema.optional(),
    })), async (c) => {
        const sessionId = c.req.param("sessionId");
        const { content: interruptedContent, parts: interruptedParts } = c.req.valid("json");

        const streamState = activeStreamControllers.get(sessionId);
        if (streamState) {
            streamState.controller.abort();

            if (!streamState.done) {
                await db.message.create({
                    data: {
                        sessionId,
                        role: "ASSISTANT",
                        status: MessageStatus.INTERRUPTED,
                        model: streamState.model,
                        content: interruptedContent ?? streamState.content,
                        mode: streamState.mode,
                        parts: interruptedParts as Prisma.InputJsonValue | undefined,
                    },
                });
            }

            activeStreamControllers.delete(sessionId);
        }

        return c.json({ success: true });
    });

export default app;