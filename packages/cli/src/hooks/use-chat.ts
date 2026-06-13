import { useState, useRef, useCallback, useEffect } from "react";
import { EventSourceParserStream } from "eventsource-parser/stream";
import prettyMs from "pretty-ms";
import type { ClientResponse } from "hono/client";
import { apiClient } from "../lib/api-client";
import { getErrorMessage } from "../lib/https-errors";
import type { Mode } from "@mantracode/database/enums";
import { chatStreamEventSchema, type SupportedChatModelId } from "@mantracode/shared";

const REVEAL_CHARS_PER_TICK = 2;
const REVEAL_TICK_MS = 16;

export type ClientMessagePart = { type: "text", text: string };

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
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
            };
        });
    }, [isActiveRequest]);

    const captureInterruptedMessage = useCallback((activeStream: ActiveStream) => {
        if (activeStream.interruptedCaptured) return;

        const capturedText = displayedTextRef.current;
        if (!capturedText) return;

        activeStream.interruptedCaptured = true;

        updateMessages((prev) => [
            ...prev,
            {
                id: crypto.randomUUID(),
                role: "assistant",
                content: capturedText,
                mode: activeStream.mode,
                model: activeStream.model,
                parts: [{ type: "text", text: capturedText }],
                interrupted: true,
            },
        ]);
    }, [updateMessages]);

    const startReveal = useCallback(() => {
        if (intervalRef.current) return;

        intervalRef.current = setInterval(() => {
            const full = fullTextRef.current;
            setStreaming((prev) => {
                if (prev.status !== "streaming") return prev;
                if (prev.displayText.length >= full.length) return prev;
                const nextLen = Math.min(
                    prev.displayText.length + REVEAL_CHARS_PER_TICK,
                    full.length,
                );
                const next = full.slice(0, nextLen);
                displayedTextRef.current = next;
                return {
                    ...prev,
                    displayText: next,
                };
            });
        }, REVEAL_TICK_MS);
    }, []);

    const stopReveal = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    const clearStream = useCallback((requestId: string) => {
        if (!isActiveRequest(requestId)) return;

        activeStreamRef.current = null;
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

                    fullTextRef.current = parts
                        .filter((p) => p.type === "text")
                        .map((p) => p.text)
                        .join("");
                    displayedTextRef.current = fullTextRef.current;

                    stopReveal();

                    setStreaming((prev) => {
                        if (prev.status !== "streaming") return prev;
                        return {
                            ...prev,
                            parts: [...parts],
                            fullText: fullTextRef.current,
                            displayText: fullTextRef.current,
                        };
                    });

                    const fullText = fullTextRef.current;

                    updateMessages((prev) => [
                        ...prev,
                        {
                            id: event.messageId,
                            role: "assistant",
                            content: fullText,
                            mode: activeStream.mode,
                            model: activeStream.model,
                            duration: prettyMs(event.durationMs),
                            parts: [...parts],
                        },
                    ]);
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
    }, [updateMessages, emitParts, isActiveRequest, stopReveal]);

    const runStream = useCallback(async ({ mode, model, request }: RunStreamParams) => {
        const controller = new AbortController();
        const activeStream: ActiveStream = {
            requestId: crypto.randomUUID(),
            controller,
            mode,
            model,
            parts: [],
            interruptedCaptured: false,
        };

        fullTextRef.current = "";
        displayedTextRef.current = "";
        activeStreamRef.current = activeStream;
        setStreaming({
            status: "streaming",
            parts: [],
            fullText: "",
            displayText: "",
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

        if (capturePartial) {
            const capturedText = displayedTextRef.current;
            if (capturedText) {
                try {
                    await apiClient.chat[":sessionId"].interrupt.$post({
                        param: { sessionId },
                        json: { content: capturedText, model: activeStream.model, mode: activeStream.mode },
                    });
                } catch {}
            }
            captureInterruptedMessage(activeStream);
        }

        activeStreamRef.current = null;
        stopReveal();
        setStreaming({ status: "idle" });
        activeStream.controller.abort();
    }, [captureInterruptedMessage, stopReveal]);

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