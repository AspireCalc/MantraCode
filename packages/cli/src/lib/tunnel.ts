import { resolve, relative, dirname, isAbsolute } from "path";
import { readFile, writeFile, mkdir, readdir, stat } from "fs/promises";
import { getAuth } from "./auth";

const MAX_FILE_SIZE = 10_000;
const MAX_OUTPUT = 20_000;
const MAX_MATCHES = 50;
const MAX_GLOB_RESULTS = 200;
const DEFAULT_TIMEOUT = 30_000;

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function isEnvFilePath(filePath: string): boolean {
  const basename = filePath.split("/").pop()?.split("\\").pop() ?? "";
  return basename === ".env" || basename.startsWith(".env.");
}

function envFileRestrictedError() {
  return { error: "Access to .env files is restricted for security reasons." };
}

function checkPath(cwd: string, path: string) {
  const resolved = resolve(cwd, path);
  const rel = relative(cwd, resolved);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    return { error: "Path is outside the project directory" };
  }
  if (!resolved.startsWith(cwd)) {
    return { error: "Path is outside the project directory" };
  }
  return { resolved, rel };
}

export async function executeToolLocally(
  toolName: string,
  args: Record<string, unknown>,
  cwd: string,
): Promise<unknown> {
  switch (toolName) {
    case "readFile":
      return readFileTool(cwd, args as { path: string });
    case "writeFile":
      return writeFileTool(cwd, args as { path: string; content: string });
    case "editFile":
      return editFileTool(
        cwd,
        args as { path: string; oldString: string; newString: string },
      );
    case "bash":
      return bashTool(cwd, args as { command: string; timeout?: number });
    case "grep":
      return grepTool(
        cwd,
        args as { pattern: string; path?: string; include?: string },
      );
    case "glob":
      return globTool(cwd, args as { pattern: string; path?: string });
    case "listDirectory":
      return listDirectoryTool(cwd, args as { path?: string });
    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

async function readFileTool(cwd: string, { path }: { path: string }) {
  const check = checkPath(cwd, path);
  if ("error" in check) return check;
  if (isEnvFilePath(check.resolved)) return envFileRestrictedError();

  try {
    const content = await readFile(check.resolved, "utf-8");
    if (content.length > MAX_FILE_SIZE) {
      return {
        content: content.slice(0, MAX_FILE_SIZE),
        truncated: true,
        totalLength: content.length,
      };
    }
    return { content };
  } catch (err) {
    return {
      error: `Failed to read file: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function writeFileTool(
  cwd: string,
  { path, content }: { path: string; content: string },
) {
  const check = checkPath(cwd, path);
  if ("error" in check) return check;
  if (isEnvFilePath(check.resolved)) return envFileRestrictedError();

  try {
    await mkdir(dirname(check.resolved), { recursive: true });
    await writeFile(check.resolved, content, "utf-8");
    return {
      success: true as const,
      path: relative(cwd, check.resolved),
      bytesWritten: Buffer.byteLength(content, "utf-8"),
    };
  } catch (err) {
    return {
      error: `Failed to create or overwrite file: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function editFileTool(
  cwd: string,
  { path, oldString, newString }: { path: string; oldString: string; newString: string },
) {
  const check = checkPath(cwd, path);
  if ("error" in check) return check;
  if (isEnvFilePath(check.resolved)) return envFileRestrictedError();

  try {
    const content = await readFile(check.resolved, "utf-8");
    const occurrences = content.split(oldString).length - 1;

    if (occurrences === 0) {
      return { error: "oldString not found in file" };
    }
    if (occurrences > 1) {
      return {
        error: `oldString is ambiguous - found ${occurrences} matches. Provide more surrounding context to make it unique.`,
      };
    }

    const updated = content.replace(oldString, newString);
    await writeFile(check.resolved, updated, "utf-8");

    return {
      success: true as const,
      path: relative(cwd, check.resolved),
    };
  } catch (err) {
    return {
      error: `Failed to edit file: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function bashTool(
  cwd: string,
  { command, timeout }: { command: string; timeout?: number },
) {
  try {
    const proc = Bun.spawn(["bash", "-c", command], {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, TERM: "dumb" },
    });

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill();
    }, timeout ?? DEFAULT_TIMEOUT);

    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);

    const exitCode = await proc.exitCode;
    clearTimeout(timer);

    const truncate = (s: string) =>
      s.length > MAX_OUTPUT
        ? s.slice(0, MAX_OUTPUT) +
          `\n... (truncated, ${s.length} total chars)`
        : s;

    return {
      stdout: truncate(stdout),
      stderr: truncate(stderr),
      exitCode,
      timedOut,
    };
  } catch (err) {
    return {
      error: `Failed to execute command: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function grepTool(
  cwd: string,
  { pattern, path: grepPath, include }: { pattern: string; path?: string; include?: string },
) {
  const searchPath = grepPath ?? ".";
  const check = checkPath(cwd, searchPath);
  if ("error" in check) return check;

  try {
    const args = [
      "-rn",
      "--color=never",
      "--exclude-dir=node_modules",
      "--exclude-dir=.git",
      "--exclude=.env",
      "--exclude=.env.*",
      "-E",
    ];

    if (include) {
      args.push(`--include=${include}`);
    }

    args.push(pattern, check.resolved);

    const proc = Bun.spawn(["grep", ...args], {
      stdout: "pipe",
      stderr: "pipe",
      cwd,
    });

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    await proc.exited;

    if (proc.exitCode !== 0 && proc.exitCode !== 1) {
      return { error: `grep failed: ${stderr.trim()}` };
    }

    if (!stdout.trim()) {
      return { matches: [], message: "No matches found" };
    }

    const lines = stdout.trim().split("\n");
    const matches: { file: string; line: number; content: string }[] = [];
    let truncated = false;

    for (const line of lines) {
      if (matches.length >= MAX_MATCHES) {
        truncated = true;
        break;
      }

      const match = line.match(/^(.+?):(\d+):(.*)$/);
      if (match) {
        matches.push({
          file: relative(cwd, match[1]!),
          line: parseInt(match[2]!, 10),
          content: match[3]!,
        });
      }
    }

    return {
      matches,
      ...(truncated ? { truncated: true, totalMatches: lines.length } : {}),
    };
  } catch (err) {
    return {
      error: `Failed to search file content: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function globTool(
  cwd: string,
  { pattern, path: globPath }: { pattern: string; path?: string },
) {
  const searchPath = globPath ?? ".";
  const check = checkPath(cwd, searchPath);
  if ("error" in check) return check;

  try {
    const glob = new Bun.Glob(pattern);
    const files: string[] = [];
    let truncated = false;

    for await (const match of glob.scan({
      cwd: check.resolved,
      dot: false,
      onlyFiles: true,
    })) {
      if (match.includes("node_modules")) continue;
      if (isEnvFilePath(resolve(check.resolved, match))) continue;
      if (files.length >= MAX_GLOB_RESULTS) {
        truncated = true;
        break;
      }

      const absoluteMatch = resolve(check.resolved, match);
      files.push(relative(cwd, absoluteMatch));
    }

    files.sort();

    return {
      files,
      ...(truncated ? { truncated: true } : {}),
    };
  } catch (err) {
    return {
      error: `Failed to find files: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function listDirectoryTool(
  cwd: string,
  { path: dirPath }: { path?: string },
) {
  const searchPath = dirPath ?? ".";
  const check = checkPath(cwd, searchPath);
  if ("error" in check) return check;

  try {
    const entries = await readdir(check.resolved);
    const results: { name: string; type: "file" | "directory" }[] = [];

    for (const entry of entries) {
      if (entry.startsWith(".") || entry === "node_modules") continue;

      try {
        const entryPath = resolve(check.resolved, entry);
        const info = await stat(entryPath);
        results.push({
          name: entry,
          type: info.isDirectory() ? "directory" : "file",
        });
      } catch {
        // Skip entries we can't stat
      }
    }

    results.sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return {
      path: relative(cwd, check.resolved) || ".",
      entries: results,
    };
  } catch (err) {
    return {
      error: `Failed to list directory: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function connect() {
  const auth = getAuth();
  if (!auth) return;

  const apiUrl = process.env.API_URL ?? "http://localhost:3000";
  const wsUrl = apiUrl.replace(/^http/, "ws") + "/ws/tunnel";

  try {
    ws = new WebSocket(wsUrl, {
      headers: { Authorization: `Bearer ${auth.token}` },
    });

    ws.onopen = () => {
      console.log("[tunnel] connected to server");
    };

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        if (msg.type !== "tool-exec" || !msg.id || !msg.toolName) return;

        const result = await executeToolLocally(msg.toolName, msg.args ?? {}, msg.cwd ?? process.cwd());

        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: "tool-result",
              id: msg.id,
              result,
            }),
          );
        }
      } catch (err) {
        console.error("[tunnel] error handling tool request:", err);
      }
    };

    ws.onclose = () => {
      console.log("[tunnel] disconnected, reconnecting in 5s...");
      ws = null;
      scheduleReconnect();
    };

    ws.onerror = () => {
      // onclose will fire after onerror
    };
  } catch (err) {
    console.error("[tunnel] failed to connect:", err);
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(connect, 5000);
}

export function startTunnel() {
  connect();
}

export function stopTunnel() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    ws.close();
    ws = null;
  }
}
