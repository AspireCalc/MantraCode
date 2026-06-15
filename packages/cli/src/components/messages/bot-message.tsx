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

export function BotMessage({ parts, model, mode, duration, streaming = false, displayText, interrupted = false }: Props) {
    const { colors } = useTheme();
    const [showCursor, setShowCursor] = useState(true);

    useEffect(() => {
        if (!streaming) return;
        const interval = setInterval(() => setShowCursor((v) => !v), 530);
        return () => clearInterval(interval);
    }, [streaming]);

    // const text = displayText ?? parts
    //     .filter((p) => p.type === "text")
    //     .map((p) => p.text)
    //     .join("");

    return (
        <box width={"100%"} alignItems="center">
            {/* <box paddingY={1} width={"100%"}>
                <box paddingX={3} width={"100%"}>
                    <text>
                        {text}
                        {streaming ? (showCursor ? "▌" : " ") : ""}
                    </text>
                </box>
            </box> */}

            {groupConsecutiveParts(parts).map((group) => (
                <box key={group.key} paddingY={1} width={"100%"}>
                    {group.parts.map((part, j) => {
                        if (part.type === "reasoning") {
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
                                        <em fg={colors.thinking}>Thinking:&nbsp;</em> {part.text}
                                    </text>
                                </box>
                            )
                        }

                        if (part.type === "tool-call") {
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
                                        <em fg={colors.info}>{formatToolName(part.name)}:&nbsp;</em>
                                        {formatToolArgs(part)}
                                        {part.status === "calling" ? " …" : ""}
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
            ))}

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