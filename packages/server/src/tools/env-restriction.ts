import { basename } from "path";

export function isEnvFilePath(resolvedPath: string): boolean {
    const base = basename(resolvedPath).toLowerCase();
    return base === ".env" || base.startsWith(".env.");
}

export function envFileRestrictedError() {
    return { error: "Access to .env files is restricted for security reasons" };
}
