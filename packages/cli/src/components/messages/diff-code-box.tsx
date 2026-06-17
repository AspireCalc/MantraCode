import { TextAttributes } from "@opentui/core";
import { EmptyBorder } from "../border";
import { tokenizeLine } from "./syntax-highlight";
import type { ThemeColors } from "../../theme";

type DiffLine = {
    kind: "added" | "removed" | "context";
    text: string;
};

type Props = {
    diffText: string;
    colors: ThemeColors;
};

function parseDiff(text: string): DiffLine[] {
    const lines: DiffLine[] = [];
    for (const raw of text.split("\n")) {
        if (raw.startsWith("+")) {
            lines.push({ kind: "added", text: raw.slice(1) });
        } else if (raw.startsWith("-")) {
            lines.push({ kind: "removed", text: raw.slice(1) });
        } else {
            lines.push({ kind: "context", text: raw });
        }
    }
    return lines;
}

export function DiffCodeBox({ diffText, colors }: Props) {
    const lines = parseDiff(diffText);

    return (
        <box
            backgroundColor={colors.surface}
            border={["left"]}
            borderColor={colors.dimSeparator}
            customBorderChars={{ ...EmptyBorder, vertical: "│" }}
            width={"100%"}
            marginY={1}
        >
            {lines.map((line, i) => {
                if (line.kind === "context") {
                    const tokens = tokenizeLine(line.text);
                    return (
                        <box key={i} flexDirection="row" width={"100%"}>
                            <box flexGrow={1} paddingLeft={1}>
                                <text attributes={TextAttributes.DIM}>
                                    {tokens.length === 0 ? (
                                        " "
                                    ) : (
                                        tokens.map((tok, ti) => (
                                            <em key={ti} fg={tok.fg} attributes={tok.attributes ?? 0}>
                                                {tok.text}
                                            </em>
                                        ))
                                    )}
                                </text>
                            </box>
                            <box width={2} alignItems="flex-end" paddingRight={1}>
                                <text attributes={TextAttributes.DIM}>{" "}</text>
                            </box>
                        </box>
                    );
                }

                const bgColor = line.kind === "removed" ? colors.error : colors.success;
                const indicator = line.kind === "removed" ? "-" : "+";
                const tokens = tokenizeLine(line.text);

                return (
                    <box
                        key={i}
                        flexDirection="row"
                        width={"100%"}
                        backgroundColor={bgColor}
                    >
                        <box flexGrow={1} paddingLeft={1}>
                            <text fg={colors.background}>
                                {tokens.length === 0 ? (
                                    " "
                                ) : (
                                    tokens.map((tok, ti) => (
                                        <em key={ti} fg={tok.fg} attributes={tok.attributes ?? 0}>
                                            {tok.text}
                                        </em>
                                    ))
                                )}
                            </text>
                        </box>
                        <box width={2} alignItems="flex-end" paddingRight={1}>
                            <text fg={colors.background}>{indicator}</text>
                        </box>
                    </box>
                );
            })}
        </box>
    );
}
