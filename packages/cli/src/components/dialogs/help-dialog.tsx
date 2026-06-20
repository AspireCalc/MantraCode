import { TextAttributes } from "@opentui/core";
import { useTheme } from "../../providers/theme";

const SHORTCUTS = [
    { key: "Tab", desc: "Toggle Build/Plan mode" },
    { key: "Esc", desc: "Interrupt/stop response" },
    { key: "Enter", desc: "Send message" },
    { key: "Cmd+Enter", desc: "New line" },
    { key: "/", desc: "Open command menu" },
    { key: "@", desc: "Mention a file" },
    { key: "Up/Down", desc: "Navigate suggestions" },
];

const COMMANDS = [
    { cmd: "/new", desc: "Start a new conversation" },
    { cmd: "/export", desc: "Export chat history to local markdown" },
    { cmd: "/agents", desc: "Switch agent mode" },
    { cmd: "/models", desc: "Select AI model" },
    { cmd: "/theme", desc: "Change color theme" },
    { cmd: "/sessions", desc: "Browse past sessions" },
    { cmd: "/reload", desc: "Reload the current session" },
    { cmd: "/help", desc: "Show this help guide" },
    { cmd: "/login", desc: "Sign in" },
    { cmd: "/logout", desc: "Sign out" },
    { cmd: "/upgrade", desc: "Buy more credits" },
    { cmd: "/usage", desc: "Open billing portal" },
    { cmd: "/exit", desc: "Exit the application" },
];

export function HelpDialogContent() {
    const { colors } = useTheme();

    return (
        <box flexDirection="column" gap={1}>
            <text attributes={TextAttributes.BOLD} fg={colors.primary}>
                Keyboard Shortcuts
            </text>
            {SHORTCUTS.map((s) => (
                <box key={s.key} flexDirection="row" gap={2} width={"100%"}>
                    <text fg={colors.info} attributes={TextAttributes.BOLD}>
                        {s.key.padEnd(15)}
                    </text>
                    <text attributes={TextAttributes.DIM}>{s.desc}</text>
                </box>
            ))}

            <box paddingY={1}>
                <text attributes={TextAttributes.BOLD} fg={colors.primary}>
                    Commands — Type / to see the menu
                </text>
            </box>
            {COMMANDS.map((c) => (
                <box key={c.cmd} flexDirection="row" gap={2} width={"100%"}>
                    <text fg={colors.primary} attributes={TextAttributes.BOLD}>
                        {c.cmd.padEnd(15)}
                    </text>
                    <text attributes={TextAttributes.DIM}>{c.desc}</text>
                </box>
            ))}
        </box>
    );
}