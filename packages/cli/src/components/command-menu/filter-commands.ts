import type { Command } from "./types";
import { COMMANDS } from "./commands";
import { getAuth } from "../../lib/auth";

export function getFilteredCommands(query: string, pathname?: string): Command[] {
    const isSessionPage = pathname?.startsWith("/sessions/");
    const isAuthenticated = getAuth() !== null;
    const filtered = COMMANDS.filter((cmd) => {
        if (cmd.name === "reload" && !isSessionPage) return false;
        if (cmd.name === "login" && isAuthenticated) return false;
        if (cmd.name === "logout" && !isAuthenticated) return false;
        return true;
    });
    if (query.length === 0) return filtered;
    return filtered.filter((cmd) => cmd.name.toLowerCase().startsWith(query.toLowerCase()));
}