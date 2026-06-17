import { useState, useEffect, type ReactNode } from "react";
import { TextAttributes } from "@opentui/core";
import { EmptyBorder } from "../border";
import { DiffCodeBox } from "./diff-code-box";
import { CodeBlock } from "./code-block";
import type { ThemeColors } from "../../theme";

// ---------------------------------------------------------------------------
// Terminal width hook
// ---------------------------------------------------------------------------
function useTerminalWidth(): number {
    const getWidth = () =>
        typeof process !== "undefined" ? (process.stdout.columns ?? 80) : 80;
    const [width, setWidth] = useState<number>(getWidth);
    useEffect(() => {
        const onResize = () => setWidth(getWidth());
        if (process?.stdout) process.stdout.on("resize", onResize);
        return () => {
            if (process?.stdout) process.stdout.off("resize", onResize);
        };
    }, []);
    return width;
}

// ---------------------------------------------------------------------------
// Inline parsing
// ---------------------------------------------------------------------------
type InlineSegment =
    | { type: "text"; text: string }
    | { type: "bold"; text: string }
    | { type: "italic"; text: string }
    | { type: "boldItalic"; text: string }
    | { type: "code"; text: string }
    | { type: "strikethrough"; text: string }
    | { type: "link"; text: string; url: string };

const INLINE_SRC =
    /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|_(.+?)_|\*(.+?)\*|`(.+?)`|~~(.+?)~~|\[(.+?)\]\((.+?)\))/g;

function parseInline(text: string): InlineSegment[] {
    const segments: InlineSegment[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    const re = new RegExp(INLINE_SRC.source, "g");
    while ((match = re.exec(text)) !== null) {
        if (match.index > lastIndex)
            segments.push({ type: "text", text: text.slice(lastIndex, match.index) });
        if (match[2] !== undefined) {
            segments.push({ type: "boldItalic", text: match[2] });
        } else if (match[3] !== undefined) {
            segments.push({ type: "bold", text: match[3] });
        } else if (match[4] !== undefined) {
            segments.push({ type: "italic", text: match[4] });
        } else if (match[5] !== undefined) {
            segments.push({ type: "italic", text: match[5] });
        } else if (match[6] !== undefined) {
            segments.push({ type: "code", text: match[6] });
        } else if (match[7] !== undefined) {
            segments.push({ type: "strikethrough", text: match[7] });
        } else if (match[8] !== undefined && match[9] !== undefined) {
            segments.push({ type: "link", text: match[8], url: match[9] });
        }
        lastIndex = re.lastIndex;
    }
    if (lastIndex < text.length)
        segments.push({ type: "text", text: text.slice(lastIndex) });
    return segments;
}

function stripMarkdown(text: string): string {
    return parseInline(text).map((s) => s.text).join("");
}

function renderInline(
    segments: InlineSegment[],
    dim: boolean,
    colors: ThemeColors,
): ReactNode[] {
    const children: ReactNode[] = [];
    let key = 0;
    for (const seg of segments) {
        switch (seg.type) {
            case "text":
                children.push(seg.text);
                break;
            case "bold":
                children.push(
                    <em key={key++} attributes={TextAttributes.BOLD}>{seg.text}</em>,
                );
                break;
            case "italic":
                children.push(
                    <em key={key++} attributes={TextAttributes.ITALIC}>{seg.text}</em>,
                );
                break;
            case "boldItalic":
                children.push(
                    <em key={key++} attributes={TextAttributes.BOLD | TextAttributes.ITALIC}>
                        {seg.text}
                    </em>,
                );
                break;
            case "code":
                children.push(
                    <em key={key++} fg={colors.info} attributes={dim ? TextAttributes.DIM : 0}>
                        {seg.text}
                    </em>,
                );
                break;
            case "strikethrough":
                children.push(
                    <em key={key++} attributes={TextAttributes.STRIKETHROUGH}>{seg.text}</em>,
                );
                break;
            case "link":
                children.push(
                    <em key={key++} fg={colors.primary} attributes={TextAttributes.UNDERLINE}>
                        {seg.text}
                    </em>,
                );
                break;
        }
    }
    return children;
}

// ---------------------------------------------------------------------------
// Block parsing
// ---------------------------------------------------------------------------
type TableRow = string[];
type TableData = { headers: string[]; rows: TableRow[] };
type Block =
    | { type: "heading"; level: number; text: string }
    | { type: "paragraph"; text: string }
    | { type: "code"; language: string; code: string }
    | { type: "list"; ordered: boolean; items: string[] }
    | { type: "blockquote"; text: string }
    | { type: "hr" }
    | { type: "table"; data: TableData };

const FENCE_RE = /^```/;
const HEADING_RE = /^(#{1,6})\s+(.+)$/;
const HR_RE = /^(---|\*\*\*|___)\s*$/;
const BLOCKQUOTE_RE = /^>/;
const LIST_ITEM_RE = /^(\s*)([-*+]|\d+\.)\s+(.+)$/;
const TABLE_SEPARATOR_RE = /^\|?\s*[-:]+\s*(?:\|\s*[-:]+\s*)+\|?$/;
const TABLE_ROW_RE = /^\|.+$/;

function isTableRow(line: string): boolean {
    return TABLE_ROW_RE.test(line.trim());
}
function isTableSeparator(line: string): boolean {
    return TABLE_SEPARATOR_RE.test(line.trim());
}
function parseTableRow(line: string): string[] {
    const trimmed = line.trim();
    const hasLeading = trimmed.startsWith("|");
    const hasTrailing = trimmed.endsWith("|");
    const inner = trimmed.slice(
        hasLeading ? 1 : 0,
        hasTrailing ? trimmed.length - 1 : trimmed.length,
    );
    return inner.split("|").map((c) => c.trim());
}
function parseTable(lines: string[]): TableData {
    const rows: TableRow[] = [];
    let headers: string[] = [];
    let startIdx = 0;
    if (lines.length > 0 && isTableRow(lines[0]!)) {
        headers = parseTableRow(lines[0]!);
        startIdx = 1;
    }
    if (lines.length > startIdx && isTableSeparator(lines[startIdx]!)) {
        startIdx++;
    }
    for (let i = startIdx; i < lines.length; i++) {
        if (isTableRow(lines[i]!)) rows.push(parseTableRow(lines[i]!));
    }
    return { headers, rows };
}

function stringWidth(str: string): number {
    return [...str].length;
}

function truncate(str: string, maxWidth: number): string {
    if (maxWidth <= 0) return "";
    const chars = [...str];
    if (chars.length <= maxWidth) return str;
    if (maxWidth <= 1) return "…";
    return chars.slice(0, maxWidth - 1).join("") + "…";
}

function classifyBlock(text: string): Block {
    const lines = text.split("\n");
    if (lines.length > 0 && FENCE_RE.test(lines[0]!)) {
        const language = lines[0]!.slice(3).trim();
        const endIdx = lines[lines.length - 1] === "```" ? -1 : undefined;
        return { type: "code", language, code: lines.slice(1, endIdx).join("\n") };
    }
    const firstLine = lines[0]!;
    if (lines.length >= 2 && isTableRow(firstLine) && isTableSeparator(lines[1]!))
        return { type: "table", data: parseTable(lines) };
    if (lines.length === 1 && isTableRow(firstLine))
        return { type: "table", data: parseTable(lines) };
    const headingMatch = firstLine.match(HEADING_RE);
    if (headingMatch) {
        const level = headingMatch[1]!.length;
        const headingText = headingMatch[2]!;
        const rest = lines.slice(1).join("\n").trim();
        return { type: "heading", level, text: rest ? `${headingText}\n${rest}` : headingText };
    }
    if (HR_RE.test(firstLine)) return { type: "hr" };
    if (BLOCKQUOTE_RE.test(firstLine))
        return {
            type: "blockquote",
            text: lines.map((l) => l.replace(/^>\s?/, "")).join("\n"),
        };
    if (LIST_ITEM_RE.test(firstLine)) {
        const items: string[] = [];
        let ordered = false;
        for (const line of lines) {
            const m = line.match(LIST_ITEM_RE);
            if (m) {
                if (/^\d+\.$/.test(m[2]!)) ordered = true;
                items.push(m[3]!);
            }
        }
        return { type: "list", ordered, items };
    }
    return { type: "paragraph", text };
}

function splitBlocks(markdown: string): string[] {
    const blocks: string[] = [];
    const lines = markdown.split("\n");
    let current: string[] = [];
    let inCodeFence = false;
    for (const line of lines) {
        if (FENCE_RE.test(line)) {
            if (inCodeFence) {
                current.push(line);
                blocks.push(current.join("\n"));
                current = [];
                inCodeFence = false;
            } else {
                if (current.length > 0 && current.some((l) => l.trim()))
                    blocks.push(current.join("\n"));
                current = [line];
                inCodeFence = true;
            }
            continue;
        }
        if (inCodeFence) { current.push(line); continue; }
        if (line.trim() === "") {
            if (current.length > 0) { blocks.push(current.join("\n")); current = []; }
        } else {
            current.push(line);
        }
    }
    if (current.length > 0) blocks.push(current.join("\n"));
    return blocks;
}

// ---------------------------------------------------------------------------
// Table string builder
// Builds the ENTIRE table as a plain multi-line string.
// No layout engine can wrap individual lines of a single string.
// ---------------------------------------------------------------------------
const MIN_COL = 3;

function computeColWidths(
    headers: string[],
    rows: string[][],
    numCols: number,
    budget: number,
): number[] {
    // Ideal widths from content
    const ideal: number[] = [];
    for (let c = 0; c < numCols; c++) {
        let max = stringWidth(headers[c] ?? "");
        for (const row of rows) {
            const w = stringWidth(row[c] ?? "");
            if (w > max) max = w;
        }
        ideal.push(max);
    }

    // Chrome: 1 left pipe + per col: 1 space + content + 1 space + 1 pipe
    // = 1 + numCols * 3 + sum(colWidths)
    // So content budget = budget - 1 - numCols * 3
    const contentBudget = budget - 1 - numCols * 3;
    const result = [...ideal];
    let total = result.reduce((a, b) => a + b, 0);

    if (total <= contentBudget) return result;

    // Trim widest columns first, one char at a time
    while (total > contentBudget) {
        let maxIdx = -1;
        let maxVal = MIN_COL;
        for (let i = 0; i < result.length; i++) {
            if ((result[i] ?? 0) > maxVal) {
                maxVal = result[i]!;
                maxIdx = i;
            }
        }
        if (maxIdx === -1) break;
        result[maxIdx]!--;
        total--;
    }

    return result;
}

// ---------------------------------------------------------------------------
// TableBox — renders the entire table as ONE <text> node.
// Since it's a single text node the layout engine treats the whole thing
// as one atomic unit; individual lines cannot be wrapped independently.
// ---------------------------------------------------------------------------
type TableBoxProps = {
    headers: string[];
    rows: string[][];
    colWidths: number[];
    colors: ThemeColors;
    dim: boolean;
};

function TableBox({ headers, rows, colWidths, colors, dim }: TableBoxProps) {
    // We can't colour individual cells in a single <text> node, so we render
    // three overlapping layers via absolute-ish stacking — but opentui doesn't
    // support absolute positioning.
    //
    // Instead we use the only safe approach: render one <text> per LINE of the
    // table, each line being a complete, pre-built string. A single-line <text>
    // node with no whitespace-wrap characters cannot be broken by opentui.
    // Each line <text> lives in a <box flexDirection="column"> so they stack
    // vertically without any horizontal layout math.

    const V = "│";
    const H = "─";
    const TL = "┌"; const TR = "┐";
    const BL = "└"; const BR = "┘";
    const TT = "┬"; const BT = "┴";
    const LT = "├"; const RT = "┤"; const CR = "┼";

    const borderFg = colors.dimSeparator;
    const dimAttr = TextAttributes.DIM;
    const headerAttrs = TextAttributes.BOLD | (dim ? dimAttr : 0);
    const bodyAttrs = dim ? dimAttr : 0;
    const lastColIndex = colWidths.length - 1;

    function hbar(l: string, m: string, r: string): string {
        return l + colWidths.map((w) => H.repeat(w + 2)).join(m) + r;
    }

    function cellStr(value: string, colIdx: number): string {
        const w = colWidths[colIdx] ?? 0;
        const content = truncate(value, w);
        const pad = Math.max(w - stringWidth(content), 0);
        return ` ${content}${" ".repeat(pad)} `;
    }

    // Render one data row as an array of <text> segments (pipe | cell | pipe | cell…)
    // all inside a single <box flexDirection="row">.
    // Each segment is a string with no spaces that could cause line-breaking;
    // the pipe chars and padded cells are all pre-computed to exact widths.
    function DataRow({
        cells,
        rowKey,
        getCellFg,
        cellAttrs,
    }: {
        cells: string[];
        rowKey: string;
        getCellFg: (i: number) => string | undefined;
        cellAttrs: number;
    }) {
        const normalised = Array.from(
            { length: colWidths.length },
            (_, i) => cells[i] ?? "",
        );

        // Build segments: [pipe, cell0, pipe, cell1, pipe, …]
        const segments: Array<{ text: string; fg?: string; attrs: number }> = [];
        segments.push({ text: V, fg: borderFg, attrs: dimAttr });
        for (let i = 0; i < normalised.length; i++) {
            segments.push({
                text: cellStr(normalised[i]!, i),
                fg: getCellFg(i),
                attrs: cellAttrs,
            });
            segments.push({ text: V, fg: borderFg, attrs: dimAttr });
        }

        return (
            <box flexDirection="row">
                {segments.map((seg, idx) => (
                    <text
                        key={`${rowKey}-${idx}`}
                        fg={seg.fg}
                        attributes={seg.attrs}
                    >
                        {seg.text}
                    </text>
                ))}
            </box>
        );
    }

    return (
        <box flexDirection="column">
            {/* Top border */}
            <text fg={borderFg} attributes={dimAttr}>
                {hbar(TL, TT, TR)}
            </text>

            {/* Header row */}
            <DataRow
                rowKey="hdr"
                cells={headers}
                getCellFg={() => colors.primary}
                cellAttrs={headerAttrs}
            />

            {/* Header/body separator */}
            <text fg={borderFg} attributes={dimAttr}>
                {hbar(LT, CR, RT)}
            </text>

            {/* Body rows */}
            {rows.map((row, ri) => (
                <DataRow
                    key={ri}
                    rowKey={`r${ri}`}
                    cells={row}
                    getCellFg={(i) => {
                        if (i === 0) return colors.primary;
                        if (i === lastColIndex) return colors.info;
                        return undefined;
                    }}
                    cellAttrs={bodyAttrs}
                />
            ))}

            {/* Bottom border */}
            <text fg={borderFg} attributes={dimAttr}>
                {hbar(BL, BT, BR)}
            </text>
        </box>
    );
}

// ---------------------------------------------------------------------------
// MarkdownRenderer
// ---------------------------------------------------------------------------
type Props = { text: string; colors: ThemeColors; dim?: boolean };

export function MarkdownRenderer({ text, colors, dim = false }: Props) {
    const termWidth = useTerminalWidth();
    const rawBlocks = splitBlocks(text);
    const blocks: Block[] = rawBlocks.map(classifyBlock);
    const children: ReactNode[] = [];
    let key = 0;

    for (const block of blocks) {
        switch (block.type) {
            case "heading": {
                const inline = parseInline(block.text);
                children.push(
                    <box key={key++} width={"100%"} paddingY={1} paddingX={3}>
                        <text attributes={TextAttributes.BOLD}>
                            {renderInline(inline, dim, colors)}
                        </text>
                    </box>,
                );
                break;
            }
            case "paragraph": {
                const inline = parseInline(block.text);
                children.push(
                    <box key={key++} width={"100%"} paddingY={1} paddingX={3}>
                        <text attributes={dim ? TextAttributes.DIM : 0}>
                            {renderInline(inline, dim, colors)}
                        </text>
                    </box>,
                );
                break;
            }
            case "code": {
                if (block.language === "diff") {
                    children.push(
                        <box key={key++} width={"100%"} paddingX={3}>
                            <DiffCodeBox diffText={block.code} colors={colors} />
                        </box>,
                    );
                } else {
                    children.push(
                        <box key={key++} width={"100%"} paddingX={3}>
                            <CodeBlock
                                code={block.code}
                                language={block.language}
                                colors={colors}
                            />
                        </box>,
                    );
                }
                break;
            }
            case "list": {
                const items = block.items.map((item) => ({
                    inline: parseInline(item),
                    key: key++,
                }));
                children.push(
                    <box key={key++} width={"100%"} paddingY={1} paddingX={3}>
                        {items.map((item, index) => (
                            <box key={item.key} flexDirection="row" width={"100%"}>
                                <text attributes={dim ? TextAttributes.DIM : 0}>
                                    {"  "}{block.ordered ? `${index + 1}.` : "•"}{" "}
                                </text>
                                <text attributes={dim ? TextAttributes.DIM : 0}>
                                    {renderInline(item.inline, dim, colors)}
                                </text>
                            </box>
                        ))}
                    </box>,
                );
                break;
            }
            case "blockquote": {
                const inline = parseInline(block.text);
                children.push(
                    <box
                        key={key++}
                        width={"100%"}
                        border={["left"]}
                        borderColor={colors.dimSeparator}
                        customBorderChars={{ ...EmptyBorder, vertical: "│" }}
                        paddingX={2}
                        paddingY={1}
                        marginY={1}
                    >
                        <text attributes={TextAttributes.ITALIC}>
                            {renderInline(inline, dim, colors)}
                        </text>
                    </box>,
                );
                break;
            }
            case "hr": {
                children.push(
                    <box key={key++} width={"100%"} paddingY={1} paddingX={3}>
                        <text attributes={TextAttributes.DIM}>{"─".repeat(40)}</text>
                    </box>,
                );
                break;
            }
            case "table": {
                const TABLE_PADDING_X = 3;

                // Strip markdown markup from all cells
                const strippedHeaders = block.data.headers.map(stripMarkdown);
                const strippedRows = block.data.rows.map((row) => row.map(stripMarkdown));

                const numCols = Math.max(
                    strippedHeaders.length,
                    ...strippedRows.map((r) => r.length),
                );

                // Available width for the table content
                // TABLE_PADDING_X is applied on both left and right by the outer <box>
                const availableWidth = termWidth - TABLE_PADDING_X * 2;
                const colWidths = computeColWidths(
                    strippedHeaders,
                    strippedRows,
                    numCols,
                    availableWidth,
                );

                children.push(
                    <box key={key++} width={"100%"} paddingX={TABLE_PADDING_X} marginY={1}>
                        <TableBox
                            headers={strippedHeaders}
                            rows={strippedRows}
                            colWidths={colWidths}
                            colors={colors}
                            dim={dim}
                        />
                    </box>,
                );
                break;
            }
        }
    }
    return <>{children}</>;
}