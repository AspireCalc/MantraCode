import z from "zod";
import prettyMs from "pretty-ms";
import { useChat } from "../hooks/use-chat";
import { useKeyboard } from "@opentui/react";
import { apiClient } from "../lib/api-client";
import { useToast } from "../providers/toast";
import type { InferResponseType } from "hono";
import { useEffect, useMemo, useState } from "react";
import { getErrorMessage } from "../lib/https-errors";
import { MessageStatus } from "@mantracode/database/enums";
import { SessionShell } from "../components/session-shell";
import { usePromptConfig } from "../providers/prompt-config";
import { useKeyboardLayer } from "../providers/keyboard-layer";
import { useLocation, useNavigate, useParams } from "react-router";
import type { ClientMessagePart, Message } from "../hooks/use-chat";
import { BotMessage, ErrorMessage, UserMessage } from "../components/messages";
import { messagePartsSchema, type SupportedChatModelId } from "@mantracode/shared";

type SessionData = InferResponseType<typeof apiClient.sessions[":id"]["$get"], 200>;

const sessionLocationSchema = z.object({
    session: z.custom<SessionData>((val) => val != null && typeof val === "object" && "id" in val),
});

function mapDbMessages(dbMessages: SessionData["messages"]): Message[] {
    return dbMessages.map((m): Message => {
        if (m.role === "ERROR") {
            return { id: m.id, role: "error", content: m.content };
        }

        if (m.role === "USER") {
            return {
                id: m.id,
                role: "user",
                content: m.content,
                mode: m.mode,
                model: m.model as SupportedChatModelId,
            };
        }

        const parsedParts = m.parts == null ? null : messagePartsSchema.safeParse(m.parts);
        const parts: ClientMessagePart[] = parsedParts?.success
            ? parsedParts.data.map((p) =>
                p.type === "tool-call" ? { ...p, status: "done" as const } : p,
            )
            : (m.content ? [{ type: "text", text: m.content }] : []);

        return {
            id: m.id,
            role: "assistant",
            content: m.content,
            model: m.model as SupportedChatModelId,
            mode: m.mode,
            parts,
            ...(m.duration !== null ? { duration: prettyMs(m.duration * 1000) } : {}),
            interrupted: m.status === MessageStatus.INTERRUPTED,
        };
    })
}

function ChatMessage({ msg }: { msg: Message }) {
    if (msg.role === "user") {
        return <UserMessage message={msg.content} mode={msg.mode} />
    }

    if (msg.role === "error") {
        return <ErrorMessage message={msg.content} />
    }

    return <BotMessage
        parts={msg.parts}
        model={msg.model}
        mode={msg.mode}
        duration={msg.duration}
        streaming={false}
        interrupted={msg.interrupted}
    />
};

function SessionChat({ session }: { session: SessionData }) {
    const { mode, model } = usePromptConfig();
    const { isTopLayer } = useKeyboardLayer();
    const [initialMessages] = useState(() => mapDbMessages(session.messages));
    const { messages, streaming, submit, abort, interrupt } = useChat(session.id, initialMessages);
    const [totalTokens, setTotalTokens] = useState(session.totalTokens ?? 0);
    const [creditsUsed, setCreditsUsed] = useState(0);
    const [creditsTotal, setCreditsTotal] = useState(1000);

    useEffect(() => {
        const controller = new AbortController();
        const { signal } = controller;
        const fetch = async () => {
            try {
                const [tokensRes, creditsRes] = await Promise.all([
                    apiClient.sessions[":id"].tokens.$get({ param: { id: session.id }, signal }),
                    apiClient.billing.credits.$get({ signal }),
                ]);
                if (tokensRes.ok) {
                    const data = await tokensRes.json();
                    setTotalTokens(data.totalTokens);
                }
                if (creditsRes.ok) {
                    const data = await creditsRes.json();
                    setCreditsUsed(data.used);
                    setCreditsTotal(data.total);
                }
            } catch (err) {
                if (err instanceof Error && err.name !== "AbortError") {
                    console.error("Failed to poll session data:", err);
                }
            }
        };
        fetch();
        const interval = setInterval(fetch, 3000);
        return () => {
            clearInterval(interval);
            controller.abort();
        };
    }, [session.id]);

    useEffect(() => {
        return () => { abort(); };
    }, [abort]);

    useKeyboard((key) => {
        if (key.name === "escape" && isTopLayer("base") && streaming.status === "streaming") {
            key.preventDefault();
            interrupt();
        }
    });

    return (
        <SessionShell
            onSubmit={(text) => submit({ userText: text, mode, model })}
            loading={streaming.status === "streaming"}
            interruptible={streaming.status === "streaming"}
            totalTokens={totalTokens}
            creditsUsed={creditsUsed}
            creditsTotal={creditsTotal}
        >
            {[...messages, ...(streaming.status === "streaming" && streaming.parts.length > 0
                ? [{ _key: "__streaming__" as const, parts: streaming.parts, model: streaming.model, mode: streaming.mode, displayText: streaming.displayText, displayedReasoningText: streaming.displayedReasoningText, displayedToolCallText: streaming.displayedToolCallText, reasoningText: streaming.reasoningText, reasoningGroups: streaming.reasoningGroups, toolCallText: streaming.toolCallText }]
                : []
            )].map((item) => {
                if ("_key" in item) {
                    return (
                        <BotMessage
                            key="__streaming__"
                            parts={item.parts}
                            model={item.model}
                            mode={item.mode}
                            displayText={item.displayText}
                            displayedReasoningText={item.displayedReasoningText}
                            displayedToolCallText={item.displayedToolCallText}
                            reasoningText={item.reasoningText}
                            reasoningGroups={item.reasoningGroups}
                            toolCallText={item.toolCallText}
                            streaming
                        />
                    );
                }
                return <ChatMessage key={item.id} msg={item as Message} />;
            })}
        </SessionShell>
    )
}

export function Session() {
    const { id } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const toast = useToast();

    const reloadFlag = useMemo(() => {
        return (location.state as { _reload?: number })?._reload ?? 0;
    }, [location.state]);

    const prefetched = useMemo(() => {
        if (reloadFlag) return null;
        const parsed = sessionLocationSchema.safeParse(location.state);
        return parsed.success ? parsed.data.session : null;
    }, [location.state, reloadFlag]);

    const [session, setSession] = useState<SessionData | null>(prefetched);

    useEffect(() => {
        if (prefetched) return;
        setSession(null);
        if (!id) return;
        let ignore = false;

        const fetchSession = async () => {
            try {
                const res = await apiClient.sessions[":id"].$get({ param: { id } });
                if (ignore) return;
                if (!res.ok) throw new Error(await getErrorMessage(res));

                const resolved = await res.json();
                setSession(resolved);
            } catch (error) {
                if (ignore) return;
                toast.show({
                    variant: "error",
                    message: error instanceof Error ? error.message : "Failed to load session",
                });
                navigate("/", { replace: true });
            }
        };

        fetchSession();

        return () => {
            ignore = true;
        }
    }, [id, prefetched, reloadFlag, toast, navigate]);

    if (!session) {
        return <SessionShell onSubmit={() => { }} inputDisabled={true} loading />
    }

    return <SessionChat key={`${session.id}-${reloadFlag}`} session={session} />
};