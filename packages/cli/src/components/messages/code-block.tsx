import { useCallback, useRef, useState } from "react";
import { TextAttributes } from "@opentui/core";
import { useRenderer } from "@opentui/react";
import { EmptyBorder } from "../border";
import { tokenizeLine, isLanguageKnown } from "./syntax-highlight";
import type { ThemeColors } from "../../theme";

type Props = {
    code: string;
    language: string;
    colors: ThemeColors;
};

export function CodeBlock({ code, language, colors }: Props) {
    const renderer = useRenderer();
    const lines = code.split("\n");
    const langLabel = isLanguageKnown(language) ? language : "";
    const [copied, setCopied] = useState(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleCopy = useCallback(() => {
        renderer.copyToClipboardOSC52(code);
        setCopied(true);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setCopied(false), 4000);
    }, [renderer, code]);

    return (
        <box width={"100%"} marginY={1}>
            {/* Header with language label + copy button */}
            <box
                flexDirection="row"
                width={"100%"}
                backgroundColor={colors.surface}
                paddingX={2}
                paddingY={1}
            >
                <box flexGrow={1}>
                    <text attributes={TextAttributes.DIM}>
                        {langLabel || "code"}
                    </text>
                </box>
                <box onMouseDown={handleCopy}>
                    <text
                        selectable={false}
                        attributes={TextAttributes.DIM}
                        fg={colors.primary}
                    >
                        {copied ? "[copied]" : "[copy]"}
                    </text>
                </box>
            </box>

            {/* Code content */}
            <box
                width={"100%"}
                backgroundColor={colors.surface}
                paddingX={2}
                paddingY={1}
            >
                {lines.map((line, li) => {
                    const tokens = tokenizeLine(line, language);
                    return (
                        <box key={li} flexDirection="row" width={"100%"}>
                            {tokens.length === 0 ? (
                                <text> </text>
                            ) : (
                                <text>
                                    {tokens.map((tok, ti) => (
                                        <em key={ti} fg={tok.fg} attributes={tok.attributes ?? 0}>
                                            {tok.text}
                                        </em>
                                    ))}
                                </text>
                            )}
                        </box>
                    );
                })}
            </box>
        </box>
    );
}
