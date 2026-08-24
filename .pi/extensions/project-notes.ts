import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const MAX_CONTEXT_CHARS = 12_000;

async function readOptional(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return "";
  }
}

export default function projectNotes(pi: ExtensionAPI) {
  pi.on("before_agent_start", async (event, ctx) => {
    if (!ctx.isProjectTrusted()) return;

    const configDir = join(ctx.cwd, ".pi");
    const [instructions, notes] = await Promise.all([
      readOptional(join(configDir, "AGENTS.md")),
      readOptional(join(configDir, "PROJECT_NOTES.md")),
    ]);
    const projectContext = [instructions, notes].filter(Boolean).join("\n\n").slice(0, MAX_CONTEXT_CHARS);
    if (!projectContext) return;

    return {
      systemPrompt: `${event.systemPrompt}\n\n# Project Instructions and Notes\n${projectContext}`,
    };
  });

  pi.registerCommand("project-notes", {
    description: "Show the project notes file used by Pi",
    handler: async (_args, ctx) => {
      const notesPath = join(ctx.cwd, ".pi", "PROJECT_NOTES.md");
      try {
        const notes = await readFile(notesPath, "utf8");
        ctx.ui.notify(notes.slice(0, MAX_CONTEXT_CHARS), "info");
      } catch {
        ctx.ui.notify(`Project notes not found: ${notesPath}`, "warning");
      }
    },
  });
}
