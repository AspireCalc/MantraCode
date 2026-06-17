import { useState, useEffect } from "react";
import { Mode } from "@mantracode/database/enums";
import type {
    ClientMessagePart,
    ClientToolCallPart,
    ReasoningGroupState,
} from "../../hooks/use-chat";
import { useTheme } from "../../providers/theme";
import { TextAttributes } from "@opentui/core";
import { EmptyBorder } from "../border";
import { MarkdownRenderer } from "./markdown";

type Props = {
    parts: ClientMessagePart[];
    model: string;
    mode: Mode;
    duration?: string;
    streaming?: boolean;
    displayText?: string;
    displayedReasoningText?: string;
    displayedToolCallText?: string;
    reasoningText?: string;
    reasoningGroups?: ReasoningGroupState[];
    toolCallText?: string;
    interrupted?: boolean;
};

const SPINNER_FRAMES = [
    "⠋",
    "⠙",
    "⠹",
    "⠸",
    "⠼",
    "⠴",
    "⠦",
    "⠧",
    "⠇",
    "⠏",
];

function formatToolName(name: string): string {
    return name
        .replace(/([A-Z])/g, " $1")
        .trim()
        .replace(/^./, (c) => c.toUpperCase());
}

function formatToolArgs(tc: ClientToolCallPart): string {
    return Object.entries(tc.args)
        .filter(([key]) => key !== "timeout" && key !== "content")
        .map(([, value]) => String(value))
        .join(" ");
}

function formatThinkingTime(ms: number): string {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}

type ReasoningGroup = {
    key: number;
    fullText: string;
    startOffset: number;
    endOffset: number;
    completed: boolean;
    durationMs: number | null;
};

function getReasoningGroups(
    parts: ClientMessagePart[],
): ReasoningGroup[] {
    const groups: ReasoningGroup[] = [];
    let offset = 0;
    let groupKey = 0;
    let currentTexts: string[] = [];
    let groupStartOffset = 0;
    let groupDurationMs: number | null = null;

    for (const part of parts) {
        if (part.type === "reasoning") {
            if (currentTexts.length === 0) {
                groupStartOffset = offset;
            }
            groupDurationMs = part.durationMs ?? null;
            currentTexts.push(part.text);
            offset += part.text.length;
        } else if (currentTexts.length > 0) {
            groups.push({
                key: groupKey++,
                fullText: currentTexts.join(""),
                startOffset: groupStartOffset,
                endOffset: offset,
                completed: true,
                durationMs: groupDurationMs,
            });
            currentTexts = [];
        }
    }
    if (currentTexts.length > 0) {
        groups.push({
            key: groupKey++,
            fullText: currentTexts.join(""),
            startOffset: groupStartOffset,
            endOffset: offset,
            completed: false,
            durationMs: groupDurationMs,
        });
    }
    return groups;
}

function getGroupVisibleText(
    group: ReasoningGroup,
    displayedReasoningText: string | undefined,
): string {
    if (!displayedReasoningText) return group.fullText;
    const revealed = displayedReasoningText.length;
    if (revealed <= group.startOffset) return "";
    if (revealed >= group.endOffset) return group.fullText;
    return displayedReasoningText.slice(group.startOffset, revealed);
}

export function BotMessage({
    parts,
    model,
    mode,
    duration,
    streaming = false,
    displayText,
    displayedReasoningText,
    displayedToolCallText,
    reasoningText,
    reasoningGroups,
    toolCallText,
    interrupted = false,
}: Props) {
    const { colors } = useTheme();
    const [showCursor, setShowCursor] = useState(true);
    const [expandedGroups, setExpandedGroups] = useState<Record<number, boolean>>(
        {},
    );
    const [spinnerFrame, setSpinnerFrame] = useState(0);

    useEffect(() => {
        if (!streaming) {
            setShowCursor(true);
            return;
        }
        const interval = setInterval(
            () => setShowCursor((v) => !v),
            530,
        );
        return () => clearInterval(interval);
    }, [streaming]);

    useEffect(() => {
        if (!streaming) {
            setSpinnerFrame(0);
            return;
        }
        const interval = setInterval(
            () => setSpinnerFrame((f) => (f + 1) % SPINNER_FRAMES.length),
            100,
        );
        return () => clearInterval(interval);
    }, [streaming]);

    // --- Reasoning ---
    const fullReasoningText =
        reasoningText ||
        parts
            .filter(
                (p): p is Extract<ClientMessagePart, { type: "reasoning" }> =>
                    p.type === "reasoning",
            )
            .map((p) => p.text)
            .join("");
    const reasoningGroupsInfo = getReasoningGroups(parts);
    const reasoningColor =
        mode === Mode.PLAN ? colors.planMode : colors.primary;

    // --- Tool Call ---
    const tcParts = parts.filter(
        (p): p is ClientToolCallPart => p.type === "tool-call",
    );
    const hasToolCall = tcParts.length > 0;
    const toolCallOngoing = streaming && tcParts.some((tc) => tc.status === "calling");
    const [toolCallsExpanded, setToolCallsExpanded] = useState(false);
    const latestTC = tcParts[tcParts.length - 1];
    const latestTCFormatted =
        toolCallText ||
        (latestTC
            ? `${formatToolName(latestTC.name)}: ${formatToolArgs(latestTC)}`
            : "");
    const visibleTC = displayedToolCallText || latestTCFormatted;

    // --- Text ---
    const hasDisplayText = streaming && displayText !== undefined;
    const textContent = hasDisplayText
        ? displayText
        : parts
              .filter((p) => p.type === "text")
              .map((p) => p.text)
              .join("");

    return (
        <box width={"100%"} alignItems="center">
            {/* Reasoning Sections */}
            {reasoningGroupsInfo.map((group, idx) => {
                const groupTiming = reasoningGroups?.[idx];
                const visibleText = getGroupVisibleText(
                    group,
                    displayedReasoningText,
                );
                const isLastGroup = idx === reasoningGroupsInfo.length - 1;
                const groupInProgress =
                    isLastGroup && streaming && !group.completed;
                const isExpanded = expandedGroups[group.key] ?? false;
                const groupDuration =
                    group.durationMs ?? groupTiming?.durationMs ?? null;
                const groupTime =
                    groupDuration != null
                        ? formatThinkingTime(groupDuration)
                        : groupTiming && groupInProgress
                          ? formatThinkingTime(
                                Date.now() - groupTiming.startTime,
                            )
                          : null;

                return (
                    <box key={group.key} paddingY={1} width={"100%"} paddingX={2}>
                        <box
                            width={"100%"}
                            flexDirection="row"
                            onMouseDown={() =>
                                setExpandedGroups((prev) => ({
                                    ...prev,
                                    [group.key]: !prev[group.key],
                                }))
                            }
                        >
                            <text fg={reasoningColor} selectable={false}>
                                {groupInProgress
                                    ? `${
                                          SPINNER_FRAMES[spinnerFrame] ?? "⠋"
                                      } Thinking`
                                    : `+ Thought${
                                          groupTime ? ` ${groupTime}` : ""
                                      }`}
                            </text>
                            <text fg={reasoningColor} selectable={false}>
                                {isExpanded ? " ⌄" : " ❯"}
                            </text>
                        </box>
                        {isExpanded && (
                            <scrollbox
                                height={8}
                                border={["left"]}
                                borderColor={colors.thinkingBorder}
                                customBorderChars={{
                                    ...EmptyBorder,
                                    vertical: "│",
                                }}
                                width={"100%"}
                                paddingX={2}
                                paddingTop={1}
                            >
                                <MarkdownRenderer
                                    text={visibleText}
                                    colors={colors}
                                    dim
                                />
                            </scrollbox>
                        )}
                    </box>
                );
            })}

            {/* Tool Call Section — collapsible after done, always visible during ongoing */}
            {hasToolCall && (
                <box paddingY={1} width={"100%"} paddingX={2}>
                    {toolCallOngoing ? (
                        <box flexDirection="column" width={"100%"}>
                            <box flexDirection="row" alignItems="center" gap={1}>
                                <text attributes={TextAttributes.DIM}>
                                    {SPINNER_FRAMES[spinnerFrame] ?? "⠋"} Tool Calling...
                                </text>
                            </box>
                            {visibleTC && (
                                <box paddingLeft={4}>
                                    <text selectable={false} attributes={TextAttributes.DIM}>
                                        ↳ {visibleTC}
                                    </text>
                                </box>
                            )}
                        </box>
                    ) : tcParts.length === 1 ? (
                        <box flexDirection="column" width={"100%"}>
                            <box flexDirection="row" alignItems="center" gap={1}>
                                <text attributes={TextAttributes.DIM} selectable={false}>
                                    Tool Call:
                                </text>
                            </box>
                            <box paddingLeft={4}>
                                <text selectable={false} attributes={TextAttributes.DIM}>
                                    ↳ {latestTCFormatted}
                                </text>
                            </box>
                        </box>
                    ) : (
                        <box flexDirection="column" width={"100%"}>
                            <box
                                flexDirection="row"
                                alignItems="center"
                                gap={1}
                                onMouseDown={() => setToolCallsExpanded((v) => !v)}
                            >
                                <text attributes={TextAttributes.DIM} selectable={false}>
                                    + Tool Calls{toolCallsExpanded ? " ⌄" : " ❯"}
                                </text>
                            </box>
                            {toolCallsExpanded ? (
                                <box paddingLeft={4}>
                                    {tcParts.map((tc) => (
                                        <box key={tc.id} flexDirection="row" width={"100%"}>
                                            <text selectable={false} attributes={TextAttributes.DIM}>
                                                ↳ {formatToolName(tc.name)}
                                                {formatToolArgs(tc) ? `: ${formatToolArgs(tc)}` : ""}
                                            </text>
                                        </box>
                                    ))}
                                </box>
                            ) : (
                                <box paddingLeft={4}>
                                    <text selectable={false} attributes={TextAttributes.DIM}>
                                        ↳ {latestTCFormatted}
                                    </text>
                                </box>
                            )}
                        </box>
                    )}
                </box>
            )}

            {/* Text Content — always render during streaming for stable layout, only show cursor blink when there's text */}
            {(hasDisplayText || textContent) && (
                <box paddingX={0} paddingY={1} width={"100%"}>
                    <MarkdownRenderer
                        text={textContent + (hasDisplayText && textContent.length > 0 && showCursor ? "▌" : "")}
                        colors={colors}
                    />
                </box>
            )}

            {/* Footer */}
            <box width={"100%"} paddingX={2}>
                <box paddingBottom={1} width={"100%"} gap={1}>
                    <box flexDirection="row" gap={2}>
                        <text
                            attributes={
                                interrupted ? TextAttributes.DIM : 0
                            }
                            fg={interrupted ? undefined : reasoningColor}
                        >
                            ◉
                        </text>
                        <box flexDirection="row" gap={1}>
                            <text
                                attributes={
                                    interrupted ? TextAttributes.DIM : 0
                                }
                            >
                                {mode === Mode.PLAN ? "Plan" : "Build"}
                            </text>

                            <text
                                attributes={TextAttributes.DIM}
                                fg={colors.dimSeparator}
                            >
                                ❯
                            </text>
                            <text attributes={TextAttributes.DIM}>{model}</text>
                            {(duration || interrupted) && (
                                <>
                                    <text
                                        attributes={TextAttributes.DIM}
                                        fg={colors.dimSeparator}
                                    >
                                        ❯
                                    </text>
                                    <text attributes={TextAttributes.DIM}>
                                        {interrupted
                                            ? "Interrupted"
                                            : duration}
                                    </text>
                                </>
                            )}
                        </box>
                    </box>
                </box>
            </box>
        </box>
    );
}