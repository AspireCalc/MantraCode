import { EmptyBorder } from "./border";
import { StatusBar } from "./status-bar";
import { readdir } from "node:fs/promises";
import { CommanMenu } from "./command-menu";
import { useToast } from "../providers/toast";
import { useTheme } from "../providers/theme";
import { useDialog } from "../providers/dialog";
import type { KeyBinding, ScrollBoxRenderable } from "@opentui/core";
import { Mode } from "@mantracode/database/enums";
import type { Command } from "./command-menu/types";
import { useNavigate, useLocation } from "react-router";
import { useRenderer, useKeyboard } from "@opentui/react";
import { isAbsolute, relative, resolve } from "node:path";
import { usePromptConfig } from "../providers/prompt-config";
import { useKeyboardLayer } from "../providers/keyboard-layer";
import { useCommandMenu } from "./command-menu/use-command-menu";
import { useRef, useState, useCallback, useEffect, type RefObject } from "react";
import { MacOSScrollAccel, ScrollBarRenderable, TextAttributes, SyntaxStyle, decodePasteBytes, stripAnsiSequences, type TextareaRenderable, type PasteEvent, } from "@opentui/core";

const MAX_VISIBLE_MENTIONS = 8;
const CURRENT_DIRECTORY = process.cwd();
const MAX_FALLBACK_MENTION_CANDIDATES = 32;
const MENTION_QUERY_CHARACTER = /[A-Za-z0-9._/-]/;
const MENTION_PATTERN_SOURCE = "@[A-Za-z0-9._/-]+";
export function getMentionPattern(): RegExp {
    return new RegExp(MENTION_PATTERN_SOURCE, "g");
}
const RECURSIVE_MENTION_IGNORED_DIRECTORIES = new Set(["node_modules"]);

type MentionMatch = {
    start: number;
    end: number;
    query: string;
};

type MentionCandidate = {
    path: string;
    kind: "file" | "directory";
};

function isWithinCurrentDirectory(targetPath: string) {
    const relativePath = relative(CURRENT_DIRECTORY, targetPath);
    return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}

function isMentionQueryCharacter(character: string) {
    return MENTION_QUERY_CHARACTER.test(character);
}

function findActiveMention(text: string, cursorOffset: number): MentionMatch | null {
    const safeOffset = Math.max(0, Math.min(cursorOffset, text.length));

    let start = safeOffset;
    while (start > 0 && !/\s/.test(text[start - 1]!)) {
        start -= 1;
    }

    let end = safeOffset;
    while (end < text.length && !/\s/.test(text[end]!)) {
        end += 1;
    }

    const token = text.slice(start, end);
    const relativeCursor = safeOffset - start;
    const mentionStart = token.lastIndexOf("@", relativeCursor);

    if (mentionStart === -1) {
        return null;
    }

    const previousCharacter = token[mentionStart - 1];
    if (previousCharacter && isMentionQueryCharacter(previousCharacter)) {
        return null;
    }

    let mentionEnd = mentionStart + 1;
    while (mentionEnd < token.length && isMentionQueryCharacter(token[mentionEnd]!)) {
        mentionEnd += 1;
    }

    if (relativeCursor < mentionStart || relativeCursor > mentionEnd) {
        return null;
    }

    return {
        start: start + mentionStart,
        end: start + mentionEnd,
        query: token.slice(mentionStart + 1, mentionEnd),
    }
}

async function getMentionCandidates(query: string): Promise<MentionCandidate[]> {
    const normalizedQuery = query.startsWith("./") ? query.slice(2) : query;
    if (normalizedQuery.startsWith("/")) {
        return [];
    }

    const hasTrailingSlash = normalizedQuery.endsWith("/");
    const lastSlashIndex = hasTrailingSlash
        ? normalizedQuery.length - 1
        : normalizedQuery.lastIndexOf("/");

    const directoryPart = hasTrailingSlash
        ? normalizedQuery.slice(0, -1)
        : lastSlashIndex === -1
            ? ""
            : normalizedQuery.slice(0, lastSlashIndex);

    const namePrefix = hasTrailingSlash
        ? ""
        : lastSlashIndex === -1
            ? normalizedQuery
            : normalizedQuery.slice(lastSlashIndex + 1);

    const absoluteDirectory = resolve(CURRENT_DIRECTORY, directoryPart || ".");
    if (!isWithinCurrentDirectory(absoluteDirectory)) {
        return [];
    }

    try {
        const entries = await readdir(absoluteDirectory, { withFileTypes: true });
        const lowercasePrefix = namePrefix.toLowerCase();
        const showHiddenEntries = namePrefix.startsWith(".");

        const directMatches = entries
            .filter((entry) => showHiddenEntries || !entry.name.startsWith("."))
            .filter((entry) => {
                return lowercasePrefix === "" || entry.name.toLowerCase().startsWith(lowercasePrefix);
            })
            .sort((left, right) => {
                if (left.isDirectory() !== right.isDirectory()) {
                    return left.isDirectory() ? -1 : 1;
                }
                return left.name.localeCompare(right.name);
            })
            .map((entry) => {
                const path = directoryPart ? `${directoryPart}/${entry.name}` : entry.name;
                const kind: MentionCandidate["kind"] = entry.isDirectory() ? "directory" : "file";

                return {
                    path: kind === "directory" ? `${path}/` : path,
                    kind,
                }
            });

        if (directMatches.length > 0 || directoryPart !== "" || namePrefix === "") {
            return directMatches;
        }

        const fallbackMatches: MentionCandidate[] = [];
        const visit = async (absoluteDirectory: string, directoryPart: string): Promise<void> => {
            const entries = await readdir(absoluteDirectory, { withFileTypes: true });

            for (const entry of entries) {
                if (!showHiddenEntries && entry.name.startsWith(".")) {
                    continue;
                }

                if (entry.isDirectory() && RECURSIVE_MENTION_IGNORED_DIRECTORIES.has(entry.name)) {
                    continue;
                }

                const path = directoryPart ? `${directoryPart}/${entry.name}` : entry.name;
                const kind: MentionCandidate["kind"] = entry.isDirectory() ? "directory" : "file";

                if (entry.name.toLowerCase().startsWith(lowercasePrefix)) {
                    fallbackMatches.push({
                        path: kind === "directory" ? `${path}/` : path,
                        kind,
                    });

                    if (fallbackMatches.length >= MAX_FALLBACK_MENTION_CANDIDATES) {
                        return;
                    }
                }

                if (entry.isDirectory()) {
                    await visit(resolve(absoluteDirectory, entry.name), path);
                    if (fallbackMatches.length >= MAX_FALLBACK_MENTION_CANDIDATES) {
                        return;
                    }
                }
            }
        };

        await visit(CURRENT_DIRECTORY, "");

        return fallbackMatches.sort((left, right) => left.path.localeCompare(right.path));
    } catch (err) {
        return [];
    }
}

type FileMentionMenuProps = {
    candidates: MentionCandidate[];
    selectedIndex: number;
    scrollRef: RefObject<ScrollBoxRenderable | null>;
    onSelect: (index: number) => void;
    onExecute: (index: number) => void;
};

function FileMentionMenu({ candidates, selectedIndex, scrollRef, onSelect, onExecute }: FileMentionMenuProps) {
    const { colors } = useTheme();
    const visibleHeight = Math.min(candidates.length, MAX_VISIBLE_MENTIONS);

    if (candidates.length === 0) {
        return (
            <box paddingX={1}>
                <text attributes={TextAttributes.DIM}>No matching files or folders</text>
            </box>
        );
    }

    return (
        <scrollbox ref={scrollRef} height={visibleHeight}>
            {candidates.map((candidate, index) => {
                const isSelected = index === selectedIndex;

                return (
                    <box
                        key={candidate.path}
                        flexDirection="row"
                        paddingX={1}
                        height={1}
                        overflow="hidden"
                        backgroundColor={isSelected ? colors.selection : undefined}
                        onMouseMove={() => onSelect(index)}
                        onMouseDown={() => onExecute(index)}
                    >
                        <box flexGrow={1} flexShrink={1} overflow="hidden">
                            <text selectable={false} fg={isSelected ? "black" : "white"}>
                                {candidate.path}
                            </text>
                        </box>

                        <box width={8} alignItems="flex-end" flexShrink={0}>
                            <text selectable={false} fg={isSelected ? "black" : "gray"}>
                                {candidate.kind === "directory" ? "Folder" : "File"}
                            </text>
                        </box>
                    </box>
                )
            })}
        </scrollbox>
    )
}

type Props = {
    onSubmit: (text: string) => void;
    disabled?: boolean;
};

type PastedBlock = {
    start: number;
    end: number;
    original: string;
};

export const TEXTAREA_KEY_BINDINGS: KeyBinding[] = [
    { name: "return", shift: false, action: "submit" },
    { name: "enter", shift: false, action: "submit" },
    { name: "return", meta: true, action: "newline" },
    { name: "enter", meta: true, action: "newline" },
];

function replaceRange(text: string, start: number, end: number, replacement: string) {
    return text.slice(0, start) + replacement + text.slice(end);
}

export function InputBar({ onSubmit, disabled = false }: Props) {
    const textareaRef = useRef<TextareaRenderable>(null);
    const onSubmitRef = useRef<() => void>(() => { });
    const pastedBlocksRef = useRef<PastedBlock[]>([]);
    const styleIdRef = useRef<number | null>(null);
    const prevTextRef = useRef<string>("");
    const suppressNextContentChangeRef = useRef(false);

    const activeMentionRef = useRef<MentionMatch | null>(null);
    const mentionScrollRef = useRef<ScrollBoxRenderable>(null);
    const mentionStyleIdRef = useRef<number | null>(null);
    const mentionTypeIdRef = useRef<number | null>(null);

    const renderer = useRenderer();
    const toast = useToast();
    const dialog = useDialog();
    const { isTopLayer, push, pop, setResponder } = useKeyboardLayer();
    const { colors } = useTheme();
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const { mode, toggleMode, setMode, setModel } = usePromptConfig();

    const [activeMention, setActiveMention] = useState<MentionMatch | null>(null);
    const [mentionCandidates, setMentionCandidates] = useState<MentionCandidate[]>([]);
    const [mentionSelectedIndex, setMentionSelectedIndex] = useState(0);

    const {
        showCommandMenu,
        commandQuery,
        selectedIndex,
        scrollRef,
        handleContentChange,
        resolveCommand,
        setSelectedIndex,
    } = useCommandMenu(pathname);

    const showMentionMenu = activeMention !== null;

    const closeMentionMenu = useCallback(() => {
        activeMentionRef.current = null;
        setActiveMention(null);
        setMentionCandidates([]);
        pop("mention");
    }, [pop]);

    const syncMentionMenu = useCallback((text: string, cursorOffset: number) => {
        const nextMention = findActiveMention(text, cursorOffset);
        const previousMention = activeMentionRef.current;
        const mentionChanged =
            previousMention?.start !== nextMention?.start ||
            previousMention?.end !== nextMention?.end ||
            previousMention?.query !== nextMention?.query;

        if (!nextMention) {
            if (previousMention) {
                closeMentionMenu();
            }
            return;
        }

        activeMentionRef.current = nextMention;
        setActiveMention(nextMention);
        push("mention", () => {
            closeMentionMenu();
            return true;
        });

        if (mentionChanged) {
            setMentionSelectedIndex(0);
            mentionScrollRef.current?.scrollTo(0);
        }
    }, [closeMentionMenu, push]);

    const reconcilePastedBlocks = useCallback((prevText: string, nextText: string) => {
        if (prevText === nextText) return;

        const blocks = pastedBlocksRef.current;
        if (blocks.length === 0) return;

        let prefix = 0;
        const maxPrefix = Math.min(prevText.length, nextText.length);
        while (prefix < maxPrefix && prevText[prefix] === nextText[prefix]) {
            prefix++;
        }

        let prevSuffix = prevText.length;
        let nextSuffix = nextText.length;
        while (
            prevSuffix > prefix &&
            nextSuffix > prefix &&
            prevText[prevSuffix - 1] === nextText[nextSuffix - 1]
        ) {
            prevSuffix--;
            nextSuffix--;
        }

        const removedStart = prefix;
        const removedEnd = prevSuffix;
        const delta = nextText.length - prevText.length;

        const nextBlocks: PastedBlock[] = [];

        for (const block of blocks) {
            if (block.end <= removedStart) {
                nextBlocks.push(block);
                continue;
            }

            if (block.start >= removedEnd) {
                nextBlocks.push({
                    ...block,
                    start: block.start + delta,
                    end: block.end + delta,
                });
                continue;
            }

            // Overlap with user edit: stop tracking this block.
        }

        pastedBlocksRef.current = nextBlocks;
    }, []);

    const handleTextareaContentChange = useCallback(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const nextText = textarea.plainText;

        if (suppressNextContentChangeRef.current) {
            suppressNextContentChangeRef.current = false;
        } else {
            reconcilePastedBlocks(prevTextRef.current, nextText);
        }

        const text = textarea.plainText;

        prevTextRef.current = nextText;
        handleContentChange(nextText);
        syncMentionMenu(text, textarea.cursorOffset);

        // Highlight @mention patterns in the input bar
        const mentionRanges: Array<{ start: number; end: number }> = [];
        const mentionPattern = getMentionPattern();
        let match;
        while ((match = mentionPattern.exec(text)) !== null) {
            mentionRanges.push({ start: match.index, end: match.index + match[0].length });
        }

        let syntaxStyle = textarea.editBuffer.getSyntaxStyle();
        if (!syntaxStyle) {
            syntaxStyle = SyntaxStyle.create();
            textarea.editBuffer.setSyntaxStyle(syntaxStyle);
        }

        const extmarks = textarea.extmarks;

        if (mentionTypeIdRef.current === null) {
            mentionTypeIdRef.current = extmarks.registerType("mention");
        }
        if (mentionStyleIdRef.current === null) {
            mentionStyleIdRef.current = syntaxStyle.registerStyle("mention", { fg: colors.primary });
        }

        const typeId = mentionTypeIdRef.current;
        const styleId = mentionStyleIdRef.current;
        if (typeId === null || styleId === null) return;

        const oldExtmarks = [...extmarks.getAllForTypeId(typeId)];
        for (const em of oldExtmarks) {
            extmarks.delete(em.id);
        }

        for (const range of mentionRanges) {
            extmarks.create({ start: range.start, end: range.end, styleId, typeId });
        }
    }, [handleContentChange, reconcilePastedBlocks, syncMentionMenu, colors.primary]);

    const handleMentionExecute = useCallback((index: number) => {
        const textarea = textareaRef.current;
        const mention = activeMentionRef.current;
        const candidate = mentionCandidates[index];

        if (!textarea || !mention || !candidate) return;

        const insertion = candidate.kind === "directory" ? candidate.path : `${candidate.path} `;

        const nextText = `${textarea.plainText.slice(0, mention.start)}@${insertion}${textarea.plainText.slice(mention.end)}`;

        textarea.replaceText(nextText);
        textarea.cursorOffset = mention.start + insertion.length + 1;
        syncMentionMenu(nextText, textarea.cursorOffset);
    }, [mentionCandidates, syncMentionMenu]);

    const handleTextareaCursorChange = useCallback(() => {
        const textarea = textareaRef.current;
        if (!textarea) return

        syncMentionMenu(textarea.plainText, textarea.cursorOffset);
    }, [syncMentionMenu]);

    const handleSubmit = useCallback(() => {
        if (disabled) return;

        const textarea = textareaRef.current;
        if (!textarea) return;

        let text = textarea.plainText;
        if (text.trim().length === 0) return;

        const blocks = [...pastedBlocksRef.current].sort((a, b) => b.start - a.start);
        for (const block of blocks) {
            text = replaceRange(text, block.start, block.end, block.original);
        }

        text = text.trim();

        onSubmit(text);

        suppressNextContentChangeRef.current = true;
        textarea.setText("");
        pastedBlocksRef.current = [];
        prevTextRef.current = "";
    }, [disabled, onSubmit]);

    const handleCommand = useCallback(
        (command: Command | undefined) => {
            const textarea = textareaRef.current;
            if (!textarea || !command) return;

            suppressNextContentChangeRef.current = true;
            textarea.setText("");
            pastedBlocksRef.current = [];
            prevTextRef.current = "";

            if (command.action) {
                command.action({
                    exit: () => renderer.destroy(),
                    toast,
                    dialog,
                    navigate,
                    pathname,
                    mode,
                    setMode,
                    setModel,
                });
            } else {
                textarea.insertText(command.value + " ");
            }
        },
        [renderer, toast, dialog, navigate, pathname, mode, setMode, setModel],
    );

    const handleCommandExecute = useCallback(
        (index: number) => {
            const command = resolveCommand(index);
            handleCommand(command);
        },
        [resolveCommand, handleCommand],
    );

    useEffect(() => {
        if (!activeMention) {
            setMentionCandidates([]);
            return;
        }

        let ignore = false;
        const loadCandidates = async () => {
            const nextCandidates = await getMentionCandidates(activeMention.query);
            if (ignore) return;

            setMentionCandidates(nextCandidates);
            setMentionSelectedIndex((cureentIndex) => {
                if (nextCandidates.length === 0) {
                    return 0;
                }
                return Math.min(cureentIndex, nextCandidates.length - 1);
            });
        };

        void loadCandidates();

        return () => {
            ignore = true;
        }
    }, [activeMention]);

    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        prevTextRef.current = textarea.plainText;

        textarea.onSubmit = () => {
            onSubmitRef.current();
        };
    }, []);

    const deletePastedBlockAtCursor = useCallback((cursorOffset: number) => {
        const textarea = textareaRef.current;
        if (!textarea) return false;

        const blocks = pastedBlocksRef.current;
        const blockIndex = blocks.findIndex(
            (block) => cursorOffset > block.start && cursorOffset <= block.end,
        );

        if (blockIndex === -1) return false;

        const block = blocks[blockIndex];
        if (!block) return false;

        const nextText = replaceRange(textarea.plainText, block.start, block.end, "");

        suppressNextContentChangeRef.current = true;
        textarea.setText(nextText);

        try {
            (textarea as unknown as { cursorOffset: number }).cursorOffset = block.start;
        } catch {
            // ignore if cursor reassignment is unsupported
        }

        const removedLength = block.end - block.start;
        const nextBlocks: PastedBlock[] = [];

        for (let i = 0; i < blocks.length; i++) {
            const currentBlock = blocks[i];
            if (!currentBlock) continue;

            if (i === blockIndex) {
                continue;
            }

            if (i > blockIndex) {
                nextBlocks.push({
                    ...currentBlock,
                    start: currentBlock.start - removedLength,
                    end: currentBlock.end - removedLength,
                });
            } else {
                nextBlocks.push(currentBlock);
            }
        }

        pastedBlocksRef.current = nextBlocks;
        prevTextRef.current = nextText;

        return true;
    }, []);

    onSubmitRef.current = () => {
        if (disabled) return;

        if (showCommandMenu) {
            const command = resolveCommand(selectedIndex);
            handleCommand(command);
            return;
        }

        if (showMentionMenu) {
            const candidate = mentionCandidates[mentionSelectedIndex];
            if (candidate) {
                handleMentionExecute(mentionSelectedIndex);
                return;
            }
        }

        handleSubmit();
    };

    useKeyboard((key) => {
        if (disabled) return;
        if (!isTopLayer("base")) return;

        if (key.name === "tab") {
            key.preventDefault();
            toggleMode();
            return;
        }

        if (key.name === "backspace") {
            const textarea = textareaRef.current;
            if (!textarea) return;

            const cursorOffset = textarea.cursorOffset;
            if (deletePastedBlockAtCursor(cursorOffset)) {
                key.preventDefault();
            }
        }
    });

    useEffect(() => {
        setResponder("base", () => {
            if (disabled) return false;

            const textarea = textareaRef.current;
            if (textarea && textarea.plainText.length > 0) {
                suppressNextContentChangeRef.current = true;
                textarea.setText("");
                pastedBlocksRef.current = [];
                prevTextRef.current = "";
                return true;
            }

            return false;
        });

        return () => setResponder("base", null);
    }, [disabled, setResponder]);

    useKeyboard((key) => {
        if (disabled) return;
        if (!showMentionMenu || !isTopLayer("mention")) return;

        if (key.name === "escape") {
            key.preventDefault();
            closeMentionMenu();
        } else if (key.name === "up") {
            key.preventDefault();
            setMentionSelectedIndex((currentIndex) => {
                const nextIndex = Math.max(0, currentIndex - 1);
                const scrollbox = mentionScrollRef.current;
                if (scrollbox && nextIndex < scrollbox.scrollTop) {
                    scrollbox.scrollTo(nextIndex);
                }
                return nextIndex;
            });
        } else if (key.name === "down") {
            key.preventDefault();
            setMentionSelectedIndex((currentIndex) => {
                if (mentionCandidates.length === 0) {
                    return 0;
                }

                const nextIndex = Math.min(mentionCandidates.length - 1, currentIndex + 1);
                const scrollbox = mentionScrollRef.current;

                if (scrollbox) {
                    const viewportHeight = scrollbox.viewport.height;
                    const visibleEnd = scrollbox.scrollTop + viewportHeight - 1;
                    if (nextIndex > visibleEnd) {
                        scrollbox.scrollTo(nextIndex - viewportHeight + 1);
                    }
                }

                return nextIndex;
            });
        }
    });

    const handlePaste = useCallback(
        (event: PasteEvent) => {
            const textarea = textareaRef.current;
            if (!textarea) return;

            const pastedText = stripAnsiSequences(decodePasteBytes(event.bytes));
            const lines = pastedText.split(/\r\n|\r|\n/);
            const lineCount = lines.length;

            if (lineCount <= 1) return;

            event.preventDefault();

            const placeholder = `[Pasted ~${lineCount} lines]`;

            let styleId = styleIdRef.current;
            if (styleId === null) {
                let syntaxStyle = textarea.editBuffer.getSyntaxStyle();
                if (!syntaxStyle) {
                    syntaxStyle = SyntaxStyle.create();
                    textarea.editBuffer.setSyntaxStyle(syntaxStyle);
                }
                styleId = syntaxStyle.registerStyle("pasted", { bg: colors.primary });
                styleIdRef.current = styleId;
            }

            const cursorOffset = textarea.cursorOffset;

            suppressNextContentChangeRef.current = true;
            textarea.insertText(placeholder);
            prevTextRef.current = textarea.plainText;

            pastedBlocksRef.current.push({
                start: cursorOffset,
                end: cursorOffset + placeholder.length,
                original: pastedText,
            });

            textarea.extmarks.create({
                start: cursorOffset,
                end: cursorOffset + placeholder.length,
                styleId,
            });
        },
        [colors.primary],
    );

    const scrollAccelRef = useRef(new MacOSScrollAccel());

    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        textarea.onPaste = handlePaste;

        const scrollAccel = scrollAccelRef.current;

        textarea.onMouse = (event) => {
            if (event.type === "scroll" && event.scroll) {
                const multiplier = scrollAccel.tick();
                event.scroll.delta *= multiplier;
            }
        };

        return () => {
            textarea.onPaste = undefined;
            textarea.onMouse = undefined;
        };
    }, [handlePaste]);

    return (
        <box width="100%" alignItems="center">
            <box
                border={["left"]}
                borderColor={mode === Mode.BUILD ? colors.primary : colors.planMode}
                customBorderChars={{
                    ...EmptyBorder,
                    vertical: "┃",
                    bottomLeft: "╹",
                }}
                width={"100%"}
            >
                <box
                    position="relative"
                    justifyContent="center"
                    paddingX={2}
                    paddingY={1}
                    backgroundColor={colors.surface}
                    width={"100%"}
                    gap={1}
                >
                    {showCommandMenu && (
                        <box
                            position="absolute"
                            bottom="100%"
                            left={0}
                            width={"100%"}
                            backgroundColor={colors.surface}
                            zIndex={10}
                        >
                            <CommanMenu
                                query={commandQuery}
                                selectedIndex={selectedIndex}
                                scrollRef={scrollRef}
                                onSelect={setSelectedIndex}
                                onExecute={handleCommandExecute}
                                pathname={pathname}
                            />
                        </box>
                    )}
                    {!showCommandMenu && showMentionMenu && (
                        <box
                            position="absolute"
                            bottom={"100%"}
                            left={0}
                            width={"100%"}
                            backgroundColor={colors.surface}
                            zIndex={10}
                        >
                            <FileMentionMenu
                                candidates={mentionCandidates}
                                selectedIndex={mentionSelectedIndex}
                                scrollRef={mentionScrollRef}
                                onSelect={setMentionSelectedIndex}
                                onExecute={handleMentionExecute}
                            />
                        </box>
                    )}
                    <textarea
                        ref={textareaRef}
                        focused={!disabled && (isTopLayer("base") || isTopLayer("command") || isTopLayer("mention"))}
                        maxHeight={20}
                        keyBindings={TEXTAREA_KEY_BINDINGS}
                        onContentChange={handleTextareaContentChange}
                        onCursorChange={handleTextareaCursorChange}
                        placeholder={`Ask anything... "Fix a bug in the database"`}
                    />
                    <box width={"100%"} flexDirection="row">
                        <StatusBar />
                    </box>
                    <box
                        position="absolute"
                        bottom={0}
                        right={0}
                        paddingRight={2}
                        paddingBottom={1}
                        flexDirection="row"
                        flexWrap="wrap"
                        gap={2}
                    >
                        <box flexDirection="row" gap={1}>
                            <text selectable={false} attributes={TextAttributes.BOLD} fg={colors.primary}>
                                enter
                            </text>
                            <text selectable={false} attributes={TextAttributes.DIM}>
                                submit
                            </text>
                        </box>
                        <box flexDirection="row" gap={1}>
                            <text selectable={false} attributes={TextAttributes.BOLD} fg={colors.primary}>
                                shift + enter
                            </text>
                            <text selectable={false} attributes={TextAttributes.DIM}>
                                new line
                            </text>
                        </box>
                    </box>
                </box>
            </box>
        </box>
    );
}