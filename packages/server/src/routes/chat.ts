import { z } from "zod";
import { Hono } from "hono";
import { createTools } from "../tools";
import { streamSSE } from "hono/streaming";
import type { LanguageModel, LanguageModelUsage } from "ai";
import { ingestAiUsage } from "../lib/polar";
import { zValidator } from "@hono/zod-validator";
import { db } from "@aspirenx/mantracode-database/client";
import type { Prisma } from "@aspirenx/mantracode-database";
import { buildSystemPrompt } from "../system-prompt";
import { calculateCreditsForUsage } from "../lib/credits";
import { Mode, MessageStatus } from "@aspirenx/mantracode-database/enums";
import type { AuthenticatedEnv } from "../middleware/require-auth";
import type { ChatStreamEvent, MessagePart } from "@aspirenx/mantracode-shared";
import { isSupportedChatModel, resolveChatModel } from "../lib/models";
import { toolCallArgsSchema, messagePartsSchema } from "@aspirenx/mantracode-shared";
import { streamText as aiStreamText, stepCountIs, type ToolSet } from "ai";
import { GoogleGenAI } from "@google/genai";
import { requireCreditsBalance } from "../middleware/require-credits-balance";


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
    interruptSnapshot?: { content?: string; parts?: Prisma.InputJsonValue };
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



function isTrivialQuery(text: string): boolean {
    const trimmed = text.trim().toLowerCase();
    if (trimmed.length < 3) return true;
    const normalized = trimmed.replace(/[.!?\s]+$/, "").trim();
    const greetings = new Set([
        "hey", "hi", "hello", "hii", "hey there", "hi there", "hello there",
        "thanks", "thank you", "good", "ok", "yes", "no", "okay", "sure",
        "great", "nice", "bye", "goodbye", "what's up", "how are you",
        "howdy", "yo", "sup", "good morning", "good afternoon", "good evening",
    ]);
    return greetings.has(normalized);
}

const NAMING_MODEL = "gemini-3.5-flash";

export async function nameSessionViaVertex(
    sessionId: string,
    userQuery: string
) {
    const cleanTitle = (value: string) => {
        return value
            .replace(/```[\s\S]*?```/g, "")
            .replace(/^\s*[-•*]\s*/gm, "")
            .replace(/^(title|session title|chat title)\s*:\s*/i, "")
            .replace(/^["'`]+|["'`]+$/g, "")
            .replace(/\s+/g, " ")
            .trim();
    };

    const limitToWords = (value: string, maxWords: number) => {
        const words = value.split(/\s+/).filter(Boolean);
        return words.slice(0, maxWords).join(" ");
    };

    try {
        const project =
            process.env.GOOGLE_VERTEX_PROJECT ??
            process.env.GOOGLE_PROJECT_ID ??
            process.env.GOOGLE_CLOUD_PROJECT;

        if (!project) {
            throw new Error(
                "Missing Google Cloud project. Set GOOGLE_VERTEX_PROJECT, GOOGLE_PROJECT_ID, or GOOGLE_CLOUD_PROJECT."
            );
        }

        const client = new GoogleGenAI({
            vertexai: true,
            project,
            location: process.env.GOOGLE_VERTEX_LOCATION ?? "global",
        });

        const prompt = `
            You are generating a short title for a chat session.

            Goal:
            Create a concise, specific session title that describes the user's main intent.

            Rules:
            - Base the title on the user's query.
            - Title length: 2 to 6 words.
            - Keep it natural, clear, and specific.
            - Do not use markdown, quotes, bullets, numbering, emojis, or code fences.
            - Do not prefix with labels like "Title:" or "Session:".
            - Avoid generic filler words like "Chat", "Conversation", "Help", or "Discussion".
            - Prefer noun phrases over full sentences.
            - Do not mention that this is a title.

            User query:
            ${userQuery}
            `.trim();

        const response = await client.models.generateContent({
            model: NAMING_MODEL,
            contents: prompt,
        });

        const rawTitle = response.text ?? "";
        const title = limitToWords(cleanTitle(rawTitle), 6).slice(0, 100);

        if (title) {
            await db.session.update({
                where: { id: sessionId },
                data: { title },
            });
            console.log("[naming] success", { sessionId, new_session_name: title });
        } else {
            console.error("[naming] failure - no title returned from Vertex AI", {
                sessionId,
                response,
            });
        }
    } catch (error) {
        console.error("[naming] failure - exception", { error, sessionId });
    }
    console.log("[naming] ai finished the naming process", { sessionId });
}

type StreamParams = {
    sessionId: string;
    userId: string;
    model: string;
    cwd: string | null;
    history: {
        role: "user" | "assistant";
        content: string;
    }[];
    mode: Mode;
    abortController: AbortController;
    streamState: StreamState;
    tools?: ToolSet;
    sessionTitle?: string;
};

type IngestUsageForMessageParams = {
    messageId: string;
    status: "complete" | "interrupted";
}


async function streamAIResponse(
    stream: Parameters<Parameters<typeof streamSSE>[1]>[0],
    params: StreamParams,
) {
    const { sessionId, userId, model, cwd, history, mode, abortController, streamState, tools } = params;
    const startTime = Date.now();
    const parts: MessagePart[] = [];
    const resolvedModel = resolveChatModel(model);
    const providerOptions = tools ? resolvedModel.providerOptions : undefined;
    let completedUsage: LanguageModelUsage | null = null;
    let totalTokens = 0;

    function finalizeReasoningDuration(parts: MessagePart[], startTime: number) {
        const elapsed = Date.now() - startTime;
        const lastPart = parts[parts.length - 1];
        if (lastPart?.type === "reasoning") {
            lastPart.durationMs = elapsed;
        }
    }

    const ingestUsageForMessage = async ({ messageId, status }: IngestUsageForMessageParams) => {
        if (!completedUsage) return;

        try {
            const billableUsage = calculateCreditsForUsage({
                provider: resolvedModel.provider,
                model: resolvedModel.modelId,
                usage: completedUsage,
            });

            await ingestAiUsage({
                externalCustomerId: userId,
                eventId: `chat-message:${messageId}`,
                credits: billableUsage.credits,
            });
        } catch (error) {
            console.error("Failed to ingest Polar AI usage for chat message", {
                error,
                sessionId,
                messageId,
                userId,
            });
        }
    };

    const persistInterruptedMessage = async () => {
        const snap = streamState.interruptSnapshot;

        const interruptedMessage = await db.message.create({
            data: {
                sessionId,
                role: "ASSISTANT",
                status: MessageStatus.INTERRUPTED,
                model: streamState.model,
                content: snap?.content ?? streamState.content,
                mode: streamState.mode,
                parts: snap?.parts ?? messagePartsSchema.parse(parts),
            },
        });

        if (completedUsage) {
            await ingestUsageForMessage({
                messageId: interruptedMessage.id,
                status: "interrupted",
            });
            if (totalTokens > 0) {
                await db.session.update({ where: { id: sessionId }, data: { totalTokens: { increment: totalTokens } } });
            }
        }
    };

    try {
        const result = aiStreamText({
            tools,
            messages: history,
            model: resolvedModel.model,
            abortSignal: abortController.signal,
            system: buildSystemPrompt({ cwd, mode }),
            stopWhen: tools ? stepCountIs(50) : undefined,
            providerOptions,
            onFinish(event) {
                completedUsage = event.totalUsage;
                totalTokens = (event.totalUsage.inputTokens ?? 0) + (event.totalUsage.outputTokens ?? 0);
            }
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
            await persistInterruptedMessage();
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

        await ingestUsageForMessage({
            messageId: assistantMessage.id,
            status: "complete",
        });

        if (totalTokens > 0) {
            await db.session.update({ where: { id: sessionId }, data: { totalTokens: { increment: totalTokens } } });
        }

        const doneEvent: ChatStreamEvent = {
            type: "done",
            messageId: assistantMessage.id,
            durationMs: elapsedMs,
        };

        await stream.writeSSE({ event: "done", data: JSON.stringify(doneEvent) });
    } catch (err) {
        if (abortController.signal.aborted) {
            await persistInterruptedMessage();
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
    .post("/:sessionId/resume", requireCreditsBalance, async (c) => {
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

        const resumeCwd = session.cwd;
        const resumeQuery = session.messages.at(-1)?.content ?? "";
        const needsTools = !isTrivialQuery(resumeQuery) && !!resumeCwd;
        const tools = needsTools && resumeCwd ? createTools(resumeCwd, resumableMessage.mode, userId) : undefined;

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
                        if (session.title === "New Session" && session.messages.length > 0) {
                            const userQuery = session.messages.at(-1)?.content;
                            if (userQuery) {
                                console.log("[naming] backend ai for naming triggered and currently running", { sessionId, query: userQuery.slice(0, 50) });
                                nameSessionViaVertex(sessionId, userQuery);
                            }
                        }
                    await streamAIResponse(stream, {
                        tools,
                        userId,
                        history,
                        sessionId,
                        streamState,
                        abortController,
                        cwd: session.cwd,
                        mode: resumableMessage.mode,
                        model: resumableMessage.model,
                        sessionTitle: session.title,
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
    .post("/:sessionId", requireCreditsBalance,  submitValidator, async (c) => {
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

        if (session.title === "New Session") {
            console.log("[naming] backend ai for naming triggered and currently running", { sessionId, query: data.content.slice(0, 50) });
            nameSessionViaVertex(sessionId, data.content);
        }

        const history = buildConversationHistory([
            ...session.messages,
            {
                role: "USER" as const,
                content: data.content,
                status: MessageStatus.COMPLETE,
            },
        ]);

        const submitCwd = session.cwd;
        const query = data.content;
        const needsTools = !isTrivialQuery(query) && !!submitCwd;
        const tools = needsTools && submitCwd ? createTools(submitCwd, data.mode, userId) : undefined;

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

                try {
                    await streamAIResponse(stream, {
                        tools,
                        userId,
                        history,
                        sessionId,
                        streamState,
                        abortController,
                        mode: data.mode,
                        cwd: session.cwd,
                        model: data.model,
                        sessionTitle: session.title,
                    });
                } finally {
                    activeStreamControllers.delete(sessionId);
                }
            },
            async (err, stream) => {
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
            streamState.interruptSnapshot = { content: interruptedContent, parts: interruptedParts as Prisma.InputJsonValue | undefined };
            streamState.controller.abort();
            activeStreamControllers.delete(sessionId);
        }

        return c.json({ success: true });
    });

export default app;