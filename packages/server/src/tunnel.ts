import type { ServerWebSocket } from "bun";

const userConnections = new Map<string, ServerWebSocket<{ userId: string }>>();
const pendingRequests = new Map<
  string,
  { resolve: (value: unknown) => void; reject: (err: Error) => void; timeout: ReturnType<typeof setTimeout> }
>();

export function registerConnection(
  userId: string,
  ws: ServerWebSocket<{ userId: string }>,
) {
  const existing = userConnections.get(userId);
  if (existing) {
    try {
      existing.close();
    } catch {}
  }
  userConnections.set(userId, ws);
}

export function removeConnection(userId: string) {
  userConnections.delete(userId);
}

export async function proxyToolCall(
  userId: string,
  toolName: string,
  args: Record<string, unknown>,
  cwd: string,
): Promise<unknown> {
  const ws = userConnections.get(userId);
  if (!ws) {
    return {
      error:
        "CLI not connected. Your local CLI needs to be running for the AI to access your filesystem. Please keep the CLI open.",
    };
  }

  const requestId = crypto.randomUUID();

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      pendingRequests.delete(requestId);
      resolve({
        error: `Tool execution timed out: ${toolName}. The CLI may have disconnected.`,
      });
    }, 60_000);

    pendingRequests.set(requestId, { resolve, reject: resolve, timeout });

    try {
      ws.send(
        JSON.stringify({
          type: "tool-exec",
          id: requestId,
          toolName,
          args,
          cwd,
        }),
      );
    } catch (err) {
      clearTimeout(timeout);
      pendingRequests.delete(requestId);
      resolve({
        error: `Failed to send tool request to CLI: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  });
}

export function handleToolResult(requestId: string, result: unknown) {
  const pending = pendingRequests.get(requestId);
  if (pending) {
    clearTimeout(pending.timeout);
    pending.resolve(result);
    pendingRequests.delete(requestId);
  }
}
