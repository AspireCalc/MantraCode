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
    const [expandedTCGroups, setExpandedTCGroups] =
        useState<Record<number, boolean>>({});

    // --- Build ordered sections from parts ---
    const hasDisplayText = streaming && displayText !== undefined;
    const textContent = hasDisplayText
        ? displayText
        : parts
              .filter((p) => p.type === "text")
              .map((p) => p.text)
              .join("");

    // Compute text segment offsets (for slicing displayText during streaming)
    interface TextSegment {
        text: string;
        startOffset: number;
        endOffset: number;
    }
    const textSegments: TextSegment[] = [];
    let textOffset = 0;
    for (const part of parts) {
        if (part.type === "text") {
            textSegments.push({
                text: part.text,
                startOffset: textOffset,
                endOffset: textOffset + part.text.length,
            });
            textOffset += part.text.length;
        }
    }

    // Group consecutive tool-call parts (tools called at the same time)
    const tcSections: { tcParts: ClientToolCallPart[] }[] = [];
    for (let i = 0; i < parts.length; ) {
        const part = parts[i]!;
        if (part.type === "tool-call") {
            const group: { tcParts: ClientToolCallPart[] } = { tcParts: [] };
            while (i < parts.length && parts[i]!.type === "tool-call") {
                group.tcParts.push(parts[i] as ClientToolCallPart);
                i++;
            }
            tcSections.push(group);
        } else {
            i++;
        }
    }

    // Build sections in parts order
    type Section =
        | { kind: "reasoning"; group: ReasoningGroup; groupIdx: number }
        | {
              kind: "text";
              content: string;
              isLast: boolean;
          }
        | {
              kind: "tool-call";
              group: { tcParts: ClientToolCallPart[] };
              isLatestGroup: boolean;
          };

    const sections: Section[] = [];
    let ri = 0;
    let ti = 0;
    let tci = 0;
    for (let i = 0; i < parts.length; ) {
        const part = parts[i]!;
        if (part.type === "reasoning") {
            const group = reasoningGroupsInfo[ri]!;
            sections.push({
                kind: "reasoning",
                group,
                groupIdx: ri,
            });
            ri++;
            i++;
        } else if (part.type === "text") {
            const seg = textSegments[ti]!;
            const isLast = ti === textSegments.length - 1;
            let visibleText: string;
            if (hasDisplayText) {
                const dt = displayText!;
                if (dt.length <= seg.startOffset) {
                    visibleText = "";
                } else {
                    const end = Math.min(dt.length, seg.endOffset);
                    visibleText = dt.slice(seg.startOffset, end);
                }
            } else {
                visibleText = seg.text;
            }
            const cursor =
                isLast && hasDisplayText && visibleText.length > 0 && showCursor;
            sections.push({
                kind: "text",
                content: visibleText + (cursor ? "▌" : ""),
                isLast,
            });
            ti++;
            i++;
        } else if (part.type === "tool-call") {
            const group = tcSections[tci]!;
            sections.push({
                kind: "tool-call",
                group,
                isLatestGroup: tci === tcSections.length - 1,
            });
            tci++;
            while (i < parts.length && parts[i]!.type === "tool-call") i++;
        } else {
            i++;
        }
    }

    return (
        <box width={"100%"} alignItems="center">
            {sections.map((sec, idx) => {
                if (sec.kind === "reasoning") {
                    const { group, groupIdx } = sec;
                    const groupTiming = reasoningGroups?.[groupIdx];
                    const visibleText = getGroupVisibleText(
                        group,
                        displayedReasoningText,
                    );
                    const isLastGroup =
                        groupIdx === reasoningGroupsInfo.length - 1;
                    const groupInProgress =
                        isLastGroup && streaming && !group.completed;
                    const isExpanded =
                        expandedGroups[group.key] ?? false;
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
                        <box
                            key={`reasoning-${group.key}`}
                            paddingY={1}
                            width={"100%"}
                            paddingX={2}
                        >
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
                                              SPINNER_FRAMES[spinnerFrame] ??
                                              "⠋"
                                          } Thinking`
                                        : `+ Thought${
                                              groupTime
                                                  ? ` ${groupTime}`
                                                  : ""
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
                }

                if (sec.kind === "text") {
                    return (
                        <box
                            key={`text-${idx}`}
                            paddingX={0}
                            paddingY={1}
                            width={"100%"}
                        >
                            <MarkdownRenderer
                                text={sec.content}
                                colors={colors}
                            />
                        </box>
                    );
                }

                if (sec.kind === "tool-call") {
                    const { group, isLatestGroup } = sec;
                    const hasMultiple = group.tcParts.length > 1;
                    const sectionOngoing =
                        streaming &&
                        group.tcParts.some((tc) => tc.status === "calling");
                    const latestTCOfGroup =
                        group.tcParts[group.tcParts.length - 1]!;
                    const formattedName = `${formatToolName(latestTCOfGroup.name)}: ${formatToolArgs(latestTCOfGroup)}`;
                    const primaryText = isLatestGroup
                        ? displayedToolCallText || formattedName
                        : formattedName;
                    const isExpanded = expandedTCGroups[idx] ?? false;
                    const toggleExpanded = () =>
                        setExpandedTCGroups((prev) => ({
                            ...prev,
                            [idx]: !prev[idx],
                        }));

                    if (sectionOngoing) {
                        return (
                            <box
                                key={`tc-${idx}`}
                                paddingY={1}
                                width={"100%"}
                                paddingX={2}
                            >
                                <box flexDirection="column" width={"100%"}>
                                    <text attributes={TextAttributes.DIM}>
                                        {SPINNER_FRAMES[spinnerFrame] ??
                                            "⠋"}{" "}
                                        Tool Calling...
                                    </text>
                                    {primaryText && (
                                        <box paddingLeft={4}>
                                            <text
                                                selectable={false}
                                                attributes={
                                                    TextAttributes.DIM
                                                }
                                            >
                                                ↳ {primaryText}
                                            </text>
                                        </box>
                                    )}
                                </box>
                            </box>
                        );
                    }

                    if (!hasMultiple) {
                        return (
                            <box
                                key={`tc-${idx}`}
                                paddingY={1}
                                width={"100%"}
                                paddingX={2}
                            >
                                <box flexDirection="column" width={"100%"}>
                                    <text
                                        attributes={TextAttributes.DIM}
                                        selectable={false}
                                    >
                                        Tool Call:
                                    </text>
                                    <box paddingLeft={4}>
                                        <text
                                            selectable={false}
                                            attributes={TextAttributes.DIM}
                                        >
                                            ↳ {primaryText}
                                        </text>
                                    </box>
                                </box>
                            </box>
                        );
                    }

                    return (
                        <box
                            key={`tc-${idx}`}
                            paddingY={1}
                            width={"100%"}
                            paddingX={2}
                        >
                            <box flexDirection="column" width={"100%"}>
                                <box
                                    flexDirection="row"
                                    alignItems="center"
                                    gap={1}
                                    onMouseDown={toggleExpanded}
                                >
                                    <text
                                        attributes={TextAttributes.DIM}
                                        selectable={false}
                                    >
                                        + Tool Calls
                                        {isExpanded ? " ⌄" : " ❯"}
                                    </text>
                                </box>
                                {isExpanded ? (
                                    <box paddingLeft={4}>
                                        {group.tcParts.map((tc) => (
                                            <box
                                                key={tc.id}
                                                flexDirection="row"
                                                width={"100%"}
                                            >
                                                <text
                                                    selectable={false}
                                                    attributes={
                                                        TextAttributes.DIM
                                                    }
                                                >
                                                    ↳ {formatToolName(tc.name)}
                                                    {formatToolArgs(tc)
                                                        ? `: ${formatToolArgs(tc)}`
                                                        : ""}
                                                </text>
                                            </box>
                                        ))}
                                    </box>
                                ) : (
                                    <box paddingLeft={4}>
                                        <text
                                            selectable={false}
                                            attributes={TextAttributes.DIM}
                                        >
                                            ↳ {primaryText}
                                        </text>
                                    </box>
                                )}
                            </box>
                        </box>
                    );
                }

                return null;
            })}

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