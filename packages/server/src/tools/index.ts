import type { Mode } from "@aspirenx/mantracode-database/enums";
import type { ToolSet } from "ai";
import { proxyToolCall } from "../tunnel";
import { createReadFileTool } from "./read-file";
import { createListDirectoryTool } from "./list-directory";
import { createWriteFileTool } from "./write-file";
import { createEditFileTool } from "./edit-file";
import { createGrepTool } from "./grep";
import { createGlobTool } from "./glob";
import { createBashTool } from "./bash";

export function createTools(cwd: string, mode: Mode, userId?: string): ToolSet {
  const tools: ToolSet = {
    readFile: createReadFileTool(cwd),
    listDirectory: createListDirectoryTool(cwd),
    grep: createGrepTool(cwd),
    glob: createGlobTool(cwd),
  };

  if (mode !== "PLAN") {
    tools.writeFile = createWriteFileTool(cwd);
    tools.editFile = createEditFileTool(cwd);
    tools.bash = createBashTool(cwd);
  }

  if (userId) {
    for (const [name] of Object.entries(tools)) {
      (tools as Record<string, unknown>)[name] = {
        ...(tools as Record<string, unknown>)[name],
        execute: async (args: Record<string, unknown>) => {
          return proxyToolCall(userId, name, args, cwd);
        },
      };
    }
  }

  return tools;
}
