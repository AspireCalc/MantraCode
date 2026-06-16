import { useState, useEffect } from "react";
import { Mode } from "@mantracode/database/enums";
import type { ClientMessagePart, ClientToolCallPart } from "../../hooks/use-chat";
import { useTheme } from "../../providers/theme";
import { TextAttributes } from "@opentui/core";
import { EmptyBorder } from "../border";

type Props = {
    parts: ClientMessagePart[];
    model: string;
    mode: Mode;
    duration?: string;
    streaming?: boolean;
    displayText?: string;
    displayedReasoningText?: string;
    displayedToolCallText?: string;
    interrupted?: boolean;
};

function formatToolName(name: string): string {
    return name.replace(/([A-Z])/g, " $1").trim().replace(/^./, (c) => c.toUpperCase());
}

function formatToolArgs(tc: ClientToolCallPart): string {
    return Object.entries(tc.args)
        .filter(([key]) => key !== "timeout")
        .map(([, value]) => String(value))
        .join(" ");
}

type PartGroup = {
    type: ClientMessagePart["type"];
    parts: ClientMessagePart[];
    key: string;
}

function groupConsecutiveParts(parts: ClientMessagePart[]): PartGroup[] {
    const groups: PartGroup[] = [];

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i]!;
        const lastGroup = groups[groups.length - 1];

        if (lastGroup && lastGroup.type === part.type) {
            lastGroup.parts.push(part);
        } else {
            const key = part.type === "tool-call" ? `group-tc-${part.id}` : `group-${part.type}-${i}`;
            groups.push({ type: part.type, parts: [part], key });
        }
    }

    return groups;
}

export function BotMessage({ parts, model, mode, duration, streaming = false, displayText, displayedReasoningText, displayedToolCallText, interrupted = false }: Props) {
    const { colors } = useTheme();
    const [showCursor, setShowCursor] = useState(true);

    useEffect(() => {
        if (!streaming) return;
        const interval = setInterval(() => setShowCursor((v) => !v), 530);
        return () => clearInterval(interval);
    }, [streaming]);

    const hasDisplayText = streaming && displayText !== undefined;
    const text = hasDisplayText
        ? displayText
        : parts.filter((p) => p.type === "text").map((p) => p.text).join("");

    const visibleParts = hasDisplayText
        ? parts.filter((p) => p.type !== "text")
        : parts;

    const hasDisplayedReasoning = streaming && displayedReasoningText !== undefined;
    const reasoningPartLengths = hasDisplayedReasoning
        ? (() => {
            const reasoningParts = parts.filter((p): p is Extract<ClientMessagePart, { type: "reasoning" }> => p.type === "reasoning");
            const lengths: number[] = [];
            let consumed = 0;
            for (const p of reasoningParts) {
                const take = Math.min(p.text.length, Math.max(0, displayedReasoningText!.length - consumed));
                lengths.push(take);
                consumed += p.text.length;
            }
            return lengths;
        })()
        : undefined;

    const hasDisplayedToolCall = streaming && displayedToolCallText !== undefined;
    const toolCallPartLengths = hasDisplayedToolCall
        ? (() => {
            const tcParts = parts.filter((p): p is ClientToolCallPart => p.type === "tool-call");
            const lengths: number[] = [];
            let consumed = 0;
            for (let i = 0; i < tcParts.length; i++) {
                const p = tcParts[i]!;
                const formattedText = `${formatToolName(p.name)}: ${formatToolArgs(p)}`;
                const take = Math.min(formattedText.length, Math.max(0, displayedToolCallText!.length - consumed));
                lengths.push(take);
                consumed += formattedText.length;
                if (i < tcParts.length - 1) consumed += 1;
            }
            return lengths;
        })()
        : undefined;

    return (
        <box width={"100%"} alignItems="center">
            {(() => {
                let reasoningIdx = -1;
                let tcIdx = -1;
                return groupConsecutiveParts(visibleParts).map((group) => {
                    return (
                        <box key={group.key} paddingY={1} width={"100%"}>
                            {group.parts.map((part, j) => {
                                if (part.type === "reasoning") {
                                    reasoningIdx++;
                                    const textLen = reasoningPartLengths?.[reasoningIdx] ?? part.text.length;
                                    const text = part.text.slice(0, textLen);
                                    return (
                                        <box
                                            key={`reasoning-${j}`}
                                            border={["left"]}
                                            borderColor={colors.thinkingBorder}
                                            customBorderChars={{
                                                ...EmptyBorder,
                                                vertical: "│",
                                            }}
                                            width={"100%"}
                                            paddingX={2}
                                        >
                                            <text attributes={TextAttributes.ITALIC | TextAttributes.DIM}>
                                                <em fg={colors.thinking}>Thinking:&nbsp;</em> {text}
                                            </text>
                                        </box>
                                    )
                                }

                                if (part.type === "tool-call") {
                                    tcIdx++;
                                    const formattedText = formatToolName(part.name) + ": " + formatToolArgs(part);
                                    const tcLen = toolCallPartLengths?.[tcIdx] ?? formattedText.length;
                                    const tcText = formattedText.slice(0, tcLen);
                                    const colonIdx = formattedText.indexOf(": ");
                                    const nameShown = tcLen > colonIdx + 2 ? colonIdx + 2 : tcLen;
                                    return (
                                        <box
                                            key={part.id}
                                            border={["left"]}
                                            borderColor={colors.thinkingBorder}
                                            customBorderChars={{
                                                ...EmptyBorder,
                                                vertical: "│",
                                            }}
                                            width={"100%"}
                                            paddingX={2}
                                        >
                                            <text attributes={TextAttributes.DIM}>
                                                <em fg={colors.info}>{formattedText.slice(0, nameShown)}</em>{tcText.slice(nameShown)}{part.status === "calling" ? " …" : ""}
                                            </text>
                                        </box>
                                    )
                                }

                                if (part.type === "text") {
                                    return (
                                        <box key={`text-${j}`} paddingX={3} width={"100%"}>
                                            <text>{part.text}</text>
                                        </box>
                                    );
                                }

                                return null;
                            })}
                        </box>
                    )
                });
            })()}

            {hasDisplayText && (
                <box paddingX={3} paddingY={1} width={"100%"}>
                    <text>
                        {text}{showCursor ? "▌" : " "}
                    </text>
                </box>
            )}

            <box paddingX={3} paddingBottom={1} gap={1} width={"100%"}>
                <box flexDirection="row" gap={2}>
                    <text
                        attributes={interrupted ? TextAttributes.DIM : 0}
                        fg={interrupted ? undefined : mode === Mode.PLAN ? colors.planMode : colors.primary}
                    >
                        ◉
                    </text>
                    <box flexDirection="row" gap={1}>
                        <text attributes={interrupted ? TextAttributes.DIM : 0}>
                            {mode === Mode.PLAN ? "Plan" : "Build"}
                        </text>

                        <text attributes={TextAttributes.DIM} fg={colors.dimSeparator}>
                            ❯
                        </text>
                        <text attributes={TextAttributes.DIM}>{model}</text>
                        {(duration || interrupted) && (
                            <>
                                <text attributes={TextAttributes.DIM} fg={colors.dimSeparator}>
                                    ❯
                                </text>
                                <text attributes={TextAttributes.DIM}>
                                    {interrupted ? "Interrupted" : duration}
                                </text>
                            </>
                        )}
                    </box>
                </box>
            </box>
        </box>
    )
}