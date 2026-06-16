import { useState, useRef, useCallback, useEffect } from "react";
import { EventSourceParserStream } from "eventsource-parser/stream";
import prettyMs from "pretty-ms";
import type { ClientResponse } from "hono/client";
import { apiClient } from "../lib/api-client";
import { getErrorMessage } from "../lib/https-errors";
import type { Mode } from "@mantracode/database/enums";
import { chatStreamEventSchema, type SupportedChatModelId } from "@mantracode/shared";

const REVEAL_CHARS_PER_TICK = 4;
const REVEAL_TICK_MS = 16;

export type ClientToolCallPart = {
    type: "tool-call",
    id: string;
    name: string;
    args: Record<string, unknown>;
    result?: string;
    status: "calling" | "done";
};

export type ClientMessagePart =
    | { type: "reasoning", text: string }
    | ClientToolCallPart
    | { type: "text", text: string }

export type Message =
    | {
        id: string;
        role: "user";
        content: string;
        mode: Mode;
        model: SupportedChatModelId
    } | {
        id: string;
        role: "assistant";
        content: string;
        mode: Mode;
        model: SupportedChatModelId;
        parts: ClientMessagePart[];
        duration?: string;
        interrupted?: boolean;
    } | {
        id: string;
        role: "error";
        content: string;
    };

type StreamingState =
    | { status: "idle" }
    | {
        status: "streaming";
        parts: ClientMessagePart[];
        fullText: string;
        displayText: string;
        reasoningText: string;
        displayedReasoningText: string;
        toolCallText: string;
        displayedToolCallText: string;
        mode: Mode;
        model: SupportedChatModelId;
    };

type ActiveStream = {
    requestId: string;
    controller: AbortController;
    mode: Mode;
    model: SupportedChatModelId;
    parts: ClientMessagePart[];
    interruptedCaptured: boolean;
    done: boolean;
};

type SubmitParams = {
    userText: string;
    mode: Mode;
    model: SupportedChatModelId;
};

type RunStreamParams = {
    mode: Mode;
    model: SupportedChatModelId;
    request: (controller: AbortController) => Promise<ClientResponse<unknown>>;
};

export function useChat(
    sessionId: string,
    initialMessages: Message[],
) {
    const [messages, setMessages] = useState<Message[]>(initialMessages);
    const [streaming, setStreaming] = useState<StreamingState>({ status: "idle" });
    const activeStreamRef = useRef<ActiveStream | null>(null);
    const fullTextRef = useRef("");
    const displayedTextRef = useRef("");
    const reasoningTextRef = useRef("");
    const displayedReasoningRef = useRef("");
    const toolCallTextRef = useRef("");
    const displayedToolCallRef = useRef("");
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const streamDoneRef = useRef(false);
    const pendingMessageRef = useRef<{
        id: string;
        parts: ClientMessagePart[];
        fullText: string;
        durationMs: number;
        mode: Mode;
        model: SupportedChatModelId;
    } | null>(null);

    const updateMessages = useCallback((updater: (prev: Message[]) => Message[]) => {
        setMessages((prev) => updater(prev));
    }, []);

    const isActiveRequest = useCallback((requestId: string) => {
        return activeStreamRef.current?.requestId === requestId;
    }, []);

    const emitParts = useCallback((requestId: string, parts: ClientMessagePart[]) => {
        if (!isActiveRequest(requestId)) return;

        const snapshot = [...parts];
        const activeStream = activeStreamRef.current;
        if (!activeStream) return;

        activeStream.parts = snapshot;
        setStreaming((prev) => {
            if (prev.status !== "streaming") return prev;
            return {
                ...prev,
                parts: snapshot,
                fullText: fullTextRef.current,
                reasoningText: reasoningTextRef.current,
                toolCallText: toolCallTextRef.current,
            };
        });
    }, [isActiveRequest]);

    const captureInterruptedMessage = useCallback((activeStream: ActiveStream, partsSnapshot?: ClientMessagePart[], displayedTextSnapshot?: string) => {
        if (activeStream.interruptedCaptured) return;
        if (activeStream.done) return;

        activeStream.interruptedCaptured = true;

        const parts = partsSnapshot ?? activeStream.parts;
        if (parts.length === 0) return;

        let messageParts: ClientMessagePart[];
        let content: string;

        if (displayedTextSnapshot) {
            const nonTextParts = parts.filter((p) => p.type !== "text");
            messageParts = [
                ...nonTextParts,
                { type: "text", text: displayedTextSnapshot },
            ];
            content = displayedTextSnapshot;
        } else {
            messageParts = [...parts];
            content = parts
                .filter((p) => p.type === "text")
                .map((p) => p.text)
                .join("");
        }

        updateMessages((prev) => [
            ...prev,
            {
                id: crypto.randomUUID(),
                role: "assistant",
                content,
                mode: activeStream.mode,
                model: activeStream.model,
                parts: messageParts,
                interrupted: true,
            },
        ]);
    }, [updateMessages]);

    const startReveal = useCallback(() => {
        if (intervalRef.current) return;

        intervalRef.current = setInterval(() => {
            const full = fullTextRef.current;
            const reasoningFull = reasoningTextRef.current;
            const toolCallFull = toolCallTextRef.current;

            setStreaming((prev) => {
                if (prev.status !== "streaming") return prev;

                const bothDone = prev.displayText.length >= full.length
                    && prev.displayedReasoningText.length >= reasoningFull.length
                    && prev.displayedToolCallText.length >= toolCallFull.length;

                if (bothDone) {
                    if (streamDoneRef.current) {
                        return { status: "idle" };
                    }
                    return prev;
                }

                const nextTextLen = Math.min(
                    prev.displayText.length + REVEAL_CHARS_PER_TICK,
                    full.length,
                );
                const nextText = full.slice(0, nextTextLen);
                displayedTextRef.current = nextText;

                const nextReasonLen = Math.min(
                    prev.displayedReasoningText.length + REVEAL_CHARS_PER_TICK,
                    reasoningFull.length,
                );
                const nextReason = reasoningFull.slice(0, nextReasonLen);
                displayedReasoningRef.current = nextReason;

                const nextToolCallLen = Math.min(
                    prev.displayedToolCallText.length + REVEAL_CHARS_PER_TICK,
                    toolCallFull.length,
                );
                const nextToolCall = toolCallFull.slice(0, nextToolCallLen);
                displayedToolCallRef.current = nextToolCall;

                return {
                    ...prev,
                    displayText: nextText,
                    displayedReasoningText: nextReason,
                    displayedToolCallText: nextToolCall,
                };
            });

            if (streamDoneRef.current
                && displayedTextRef.current.length >= fullTextRef.current.length
                && displayedReasoningRef.current.length >= reasoningTextRef.current.length
                && displayedToolCallRef.current.length >= toolCallTextRef.current.length) {
                const pending = pendingMessageRef.current;
                if (pending) {
                    pendingMessageRef.current = null;
                    updateMessages((prev) => {
                        if (prev.some((m) => m.id === pending.id)) return prev;
                        return [
                            ...prev,
                            {
                                id: pending.id,
                                role: "assistant",
                                content: pending.fullText,
                                mode: pending.mode,
                                model: pending.model,
                                duration: prettyMs(pending.durationMs),
                                parts: pending.parts,
                            },
                        ];
                    });
                }
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                }
            }
        }, REVEAL_TICK_MS);
    }, [updateMessages]);

    const stopReveal = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    const clearStream = useCallback((requestId: string) => {
        if (!isActiveRequest(requestId)) return;

        activeStreamRef.current = null;

        if (streamDoneRef.current) {
            return;
        }

        stopReveal();
        setStreaming({ status: "idle" });
    }, [isActiveRequest, stopReveal]);

    const handleStream = useCallback(async (response: ClientResponse<unknown>, activeStream: ActiveStream) => {
        if (!isActiveRequest(activeStream.requestId)) return;

        if (!response.ok) {
            const message = await getErrorMessage(response);
            updateMessages((prev) => [
                ...prev,
                {
                    id: crypto.randomUUID(),
                    role: "error",
                    content: message,
                },
            ]);
            return;
        }

        const parts: ClientMessagePart[] = [];

        const stream = response
            .body!.pipeThrough(new TextDecoderStream())
            .pipeThrough(new EventSourceParserStream());

        for await (const { data } of stream) {
            if (!isActiveRequest(activeStream.requestId)) return;

            let event;

            try {
                event = chatStreamEventSchema.parse(JSON.parse(data));
            } catch (err) {
                const message = err instanceof Error ? err.message : "Invalid stream event";
                updateMessages((prev) => [
                    ...prev,
                    {
                        id: crypto.randomUUID(),
                        role: "error",
                        content: message,
                    },
                ]);
                break;
            }

            switch (event.type) {
                case "reasoning-delta": {
                    reasoningTextRef.current += event.text;
                    const last = parts[parts.length - 1];
                    if (last && last.type === "reasoning") {
                        last.text += event.text;
                    } else {
                        parts.push({ type: "reasoning", text: event.text });
                    }
                    emitParts(activeStream.requestId, parts);
                    break;
                }
                case "tool-call": {
                    const tcArgs = event.args as Record<string, unknown>;
                    const formattedArgs = Object.entries(tcArgs)
                        .filter(([k]) => k !== "timeout")
                        .map(([, v]) => String(v))
                        .join(" ");
                    const formattedName = event.toolName.replace(/([A-Z])/g, " $1").trim().replace(/^./, (c) => c.toUpperCase());
                    const tcText = `${formattedName}: ${formattedArgs}`;

                    toolCallTextRef.current += (toolCallTextRef.current ? "\n" : "") + tcText;

                    parts.push({
                        type: "tool-call",
                        id: event.toolCallId,
                        name: event.toolName,
                        args: tcArgs,
                        status: "calling",
                    });
                    emitParts(activeStream.requestId, parts);
                    break;
                }
                case "tool-result": {
                    const tc = parts.find((p): p is ClientToolCallPart => p.type === "tool-call" && p.id === event.toolCallId,);
                    if (tc) {
                        tc.result = event.result;
                        tc.status = "done";
                    }
                    emitParts(activeStream.requestId, parts);
                    break;
                }
                case "text-delta": {
                    const last = parts[parts.length - 1];
                    if (last && last.type === "text") {
                        last.text += event.text;
                    } else {
                        parts.push({ type: "text", text: event.text });
                    }
                    fullTextRef.current += event.text;
                    emitParts(activeStream.requestId, parts);
                    break;
                }
                case "done": {
                    if (!isActiveRequest(activeStream.requestId)) return;
                    activeStream.done = true;
                    streamDoneRef.current = true;

                    fullTextRef.current = parts
                        .filter((p) => p.type === "text")
                        .map((p) => p.text)
                        .join("");

                    pendingMessageRef.current = {
                        id: event.messageId,
                        parts: [...parts],
                        fullText: fullTextRef.current,
                        durationMs: event.durationMs,
                        mode: activeStream.mode,
                        model: activeStream.model,
                    };

                    setStreaming((prev) => {
                        if (prev.status !== "streaming") return prev;
                        return {
                            ...prev,
                            parts: [...parts],
                            fullText: fullTextRef.current,
                        };
                    });
                    break;
                }
                case "error":
                    updateMessages((prev) => [
                        ...prev,
                        {
                            id: crypto.randomUUID(),
                            role: "error",
                            content: event.message,
                        },
                    ]);
                    break;
            }
        }
    }, [updateMessages, emitParts, isActiveRequest]);

    const runStream = useCallback(async ({ mode, model, request }: RunStreamParams) => {
        const controller = new AbortController();
        const activeStream: ActiveStream = {
            requestId: crypto.randomUUID(),
            controller,
            mode,
            model,
            parts: [],
            interruptedCaptured: false,
            done: false,
        };

        stopReveal();
        streamDoneRef.current = false;
        pendingMessageRef.current = null;
        fullTextRef.current = "";
        displayedTextRef.current = "";
        reasoningTextRef.current = "";
        displayedReasoningRef.current = "";
        toolCallTextRef.current = "";
        displayedToolCallRef.current = "";
        activeStreamRef.current = activeStream;
        setStreaming({
            status: "streaming",
            parts: [],
            fullText: "",
            displayText: "",
            reasoningText: "",
            displayedReasoningText: "",
            toolCallText: "",
            displayedToolCallText: "",
            mode,
            model,
        });
        startReveal();

        try {
            const response = await request(controller);
            await handleStream(response, activeStream);
        } catch (err) {
            if (err instanceof DOMException && err.name === "AbortError") return;

            if (!isActiveRequest(activeStream.requestId)) return;

            const msg = err instanceof Error ? err.message : String(err);
            updateMessages((prev) => [
                ...prev,
                {
                    id: crypto.randomUUID(),
                    role: "error",
                    content: msg,
                },
            ]);
        } finally {
            clearStream(activeStream.requestId);
        }
    }, [clearStream, handleStream, isActiveRequest, startReveal, updateMessages]);

    const stopActiveStream = useCallback(async (capturePartial: boolean) => {
        const activeStream = activeStreamRef.current;
        if (!activeStream) return;

        if (activeStream.done) {
            activeStreamRef.current = null;
            const pending = pendingMessageRef.current;
            pendingMessageRef.current = null;
            if (pending) {
                updateMessages((prev) => {
                    if (prev.some((m) => m.id === pending.id)) return prev;
                    return [
                        ...prev,
                        {
                            id: pending.id,
                            role: "assistant",
                            content: pending.fullText,
                            mode: pending.mode,
                            model: pending.model,
                            duration: prettyMs(pending.durationMs),
                            parts: pending.parts,
                        },
                    ];
                });
            }
            stopReveal();
            setStreaming({ status: "idle" });
            return;
        }

        if (capturePartial) {
            const partsSnapshot = [...activeStream.parts];
            const displayedTextSnapshot = displayedTextRef.current;
            const capturedText = partsSnapshot
                .filter((p) => p.type === "text")
                .map((p) => p.text)
                .join("");

            apiClient.chat[":sessionId"].interrupt.$post({
                param: { sessionId },
                json: {
                    content: displayedTextSnapshot || capturedText,
                    parts: partsSnapshot.length > 0 ? partsSnapshot as any : undefined,
                },
            }).catch(() => { });

            captureInterruptedMessage(activeStream, partsSnapshot, displayedTextSnapshot);

            activeStreamRef.current = null;
            activeStream.controller.abort();
            stopReveal();
            setStreaming({ status: "idle" });
            return;
        }

        activeStreamRef.current = null;
        stopReveal();
        setStreaming({ status: "idle" });
        activeStream.controller.abort();
    }, [captureInterruptedMessage, stopReveal, updateMessages]);

    const resume = useCallback(async ({ mode, model }: Omit<SubmitParams, "userText">) => {
        await runStream({
            mode,
            model,
            request: async (controller) => {
                return apiClient.chat[":sessionId"].resume.$post(
                    { param: { sessionId } },
                    { init: { signal: controller.signal } }
                );
            }
        });
    }, [runStream, sessionId]);

    const hasAutoResumedRef = useRef(false);
    useEffect(() => {
        if (hasAutoResumedRef.current) return;
        const last = initialMessages[initialMessages.length - 1];
        if (!last || last.role !== "user") return;

        hasAutoResumedRef.current = true;

        void resume({ mode: last.mode, model: last.model });
    }, [initialMessages, resume]);

    const submit = useCallback(async ({ userText, mode, model }: SubmitParams) => {
        await stopActiveStream(true);

        const userMessage: Message = {
            id: crypto.randomUUID(),
            role: "user",
            content: userText,
            mode,
            model
        };

        updateMessages((prev) => [...prev, userMessage]);

        await runStream({
            mode,
            model,
            request: async (controller) => {
                return apiClient.chat[":sessionId"].$post(
                    {
                        param: { sessionId },
                        json: {
                            content: userText,
                            mode,
                            model
                        }
                    },
                    { init: { signal: controller.signal } }
                );
            },
        });
    }, [runStream, sessionId, updateMessages, stopActiveStream]);

    const abort = useCallback(async () => {
        await stopActiveStream(false);
    }, [stopActiveStream]);

    const interrupt = useCallback(async () => {
        await stopActiveStream(true);
    }, [stopActiveStream]);

    return {
        messages,
        streaming,
        submit,
        abort,
        interrupt,
    };
};