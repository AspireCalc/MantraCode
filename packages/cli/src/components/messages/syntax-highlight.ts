import { TextAttributes } from "@opentui/core";
import type { ThemeColors } from "../../theme";

export type StyledSegment = {
    text: string;
    fg?: string;
    attributes?: number;
};

const KEYWORDS_BY_LANG: Record<string, string[]> = {
    javascript: [
        "async", "await", "break", "case", "catch", "class", "const", "continue",
        "debugger", "default", "delete", "do", "else", "export", "extends", "finally",
        "for", "function", "if", "import", "in", "instanceof", "let", "new", "of",
        "return", "static", "super", "switch", "this", "throw", "try", "typeof",
        "var", "void", "while", "with", "yield",
    ],
    typescript: [
        "async", "await", "break", "case", "catch", "class", "const", "continue",
        "debugger", "default", "delete", "do", "else", "export", "extends", "finally",
        "for", "function", "if", "import", "in", "instanceof", "interface", "let",
        "new", "of", "return", "static", "super", "switch", "this", "throw", "try",
        "typeof", "type", "var", "void", "while", "with", "yield", "as", "enum",
        "implements", "keyof", "readonly", "declare",
    ],
    python: [
        "and", "as", "assert", "async", "await", "break", "class", "continue",
        "def", "del", "elif", "else", "except", "finally", "for", "from", "global",
        "if", "import", "in", "is", "lambda", "nonlocal", "not", "or", "pass",
        "raise", "return", "try", "while", "with", "yield",
    ],
    rust: [
        "as", "break", "const", "continue", "crate", "else", "enum", "extern",
        "false", "fn", "for", "if", "impl", "in", "let", "loop", "match", "mod",
        "move", "mut", "pub", "ref", "return", "self", "Self", "static", "struct",
        "super", "trait", "true", "type", "unsafe", "use", "where", "while",
    ],
    go: [
        "break", "case", "chan", "const", "continue", "default", "defer", "else",
        "fallthrough", "for", "func", "go", "goto", "if", "import", "interface",
        "map", "package", "range", "return", "select", "struct", "switch", "type",
        "var",
    ],
    java: [
        "abstract", "assert", "boolean", "break", "byte", "case", "catch", "char",
        "class", "const", "continue", "default", "do", "double", "else", "enum",
        "extends", "final", "finally", "float", "for", "goto", "if", "implements",
        "import", "instanceof", "int", "interface", "long", "native", "new",
        "package", "private", "protected", "public", "return", "short", "static",
        "strictfp", "super", "switch", "synchronized", "this", "throw", "throws",
        "transient", "try", "void", "volatile", "while",
    ],
    c: [
        "auto", "break", "case", "char", "const", "continue", "default", "do",
        "double", "else", "enum", "extern", "float", "for", "goto", "if", "int",
        "long", "register", "return", "short", "signed", "sizeof", "static",
        "struct", "switch", "typedef", "union", "unsigned", "void", "volatile",
        "while",
    ],
    cpp: [
        "auto", "break", "case", "catch", "char", "class", "const", "constexpr",
        "continue", "decltype", "default", "delete", "do", "double", "else",
        "enum", "explicit", "export", "extern", "false", "float", "for", "friend",
        "goto", "if", "inline", "int", "long", "mutable", "namespace", "new",
        "noexcept", "nullptr", "operator", "override", "private", "protected",
        "public", "register", "return", "short", "signed", "sizeof", "static",
        "struct", "switch", "template", "this", "throw", "true", "try", "typedef",
        "typeid", "typename", "union", "unsigned", "using", "virtual", "void",
        "volatile", "while",
    ],
};

function getKeywords(language?: string): Set<string> {
    if (!language) return new Set();
    const norm = language.toLowerCase().replace(/^\d+/, "");
    const list = KEYWORDS_BY_LANG[norm] ?? KEYWORDS_BY_LANG.javascript;
    return new Set(list);
}

const STRING_RE = /^(["'`])(?:(?!\1|\\).|\\.)*\1/;
const COMMENT_RE = /^\/\/.*|^#.*|^\/\*[\s\S]*?\*\//;
const NUMBER_RE = /^\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/;
const IDENTIFIER_RE = /^[a-zA-Z_$][a-zA-Z0-9_$]*/;

export function tokenizeLine(line: string, language?: string): StyledSegment[] {
    const keywords = getKeywords(language);
    const segments: StyledSegment[] = [];
    let i = 0;

    while (i < line.length) {
        const rest = line.slice(i);

        // Whitespace
        const wsMatch = rest.match(/^\s+/);
        if (wsMatch) {
            segments.push({ text: wsMatch[0] });
            i += wsMatch[0].length;
            continue;
        }

        // Comment
        const commentMatch = rest.match(COMMENT_RE);
        if (commentMatch) {
            segments.push({ text: commentMatch[0], attributes: TextAttributes.DIM });
            i += commentMatch[0].length;
            continue;
        }

        // String
        const strMatch = rest.match(STRING_RE);
        if (strMatch) {
            segments.push({ text: strMatch[0], fg: "green" });
            i += strMatch[0].length;
            continue;
        }

        // Number
        const numMatch = rest.match(NUMBER_RE);
        if (numMatch) {
            segments.push({ text: numMatch[0], fg: "magenta" });
            i += numMatch[0].length;
            continue;
        }

        // Identifier / keyword
        const idMatch = rest.match(IDENTIFIER_RE);
        if (idMatch) {
            const word = idMatch[0];
            if (keywords.has(word)) {
                segments.push({ text: word, fg: "cyan" });
            } else {
                segments.push({ text: word });
            }
            i += word.length;
            continue;
        }

        // Operator / punctuation — single char fallthrough
        segments.push({ text: rest[0]! });
        i += 1;
    }

    return segments;
}

export function isLanguageKnown(language: string): boolean {
    const norm = language.toLowerCase().replace(/^\d+/, "");
    return norm in KEYWORDS_BY_LANG;
}

export function DEFAULT_LANGUAGE(): string {
    return "javascript";
}
