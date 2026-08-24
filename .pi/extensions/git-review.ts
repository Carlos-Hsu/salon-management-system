import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";

const REQUIRED_BRANCH = "main";
const REQUIRED_REMOTE = "origin";
const MAX_OUTPUT_CHARS = 4_000;

type CheckResult = {
  label: string;
  code: number;
  stdout: string;
  stderr: string;
};

function truncateOutput(output: string): string {
  if (output.length <= MAX_OUTPUT_CHARS) return output;
  return `${output.slice(0, MAX_OUTPUT_CHARS)}\n[output truncated]`;
}

function formatCheck(check: CheckResult): string {
  const status = check.code === 0 ? "PASS" : "FAIL";
  const output = [check.stdout.trim(), check.stderr.trim()].filter(Boolean).join("\n");
  return `## ${status}: ${check.label}${output ? `\n${output}` : ""}`;
}

export default function gitReview(pi: ExtensionAPI) {
  pi.registerTool({
    name: "git_review",
    label: "Git Review",
    description:
      "Review the current repository, run required frontend validation, suggest a Conventional Commit message, and optionally push clean committed changes to origin/main. Never force-pushes. Command stdout/stderr is capped at 4,000 characters each.",
    promptSnippet: "Review and validate Git changes before pushing",
    promptGuidelines: [
      "Use git_review after code changes; request push only after changes have been reviewed and committed.",
    ],
    parameters: Type.Object({
      action: StringEnum(["review", "push"] as const, {
        description: "Review only, or validate and push already committed changes",
        default: "review",
      }),
    }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const run = async (label: string, command: string, args: string[]): Promise<CheckResult> => {
        onUpdate?.({ content: [{ type: "text", text: `Running ${label}…` }] });
        const result = await pi.exec(command, args, { cwd: ctx.cwd, signal, timeout: 120_000 });
        return {
          label,
          code: result.code,
          stdout: truncateOutput(result.stdout),
          stderr: truncateOutput(result.stderr),
        };
      };

      const branchResult = await pi.exec("git", ["branch", "--show-current"], { cwd: ctx.cwd, signal });
      const branch = branchResult.stdout.trim();
      const remoteResult = await pi.exec("git", ["remote"], { cwd: ctx.cwd, signal });
      const remotes = remoteResult.stdout.split(/\r?\n/).filter(Boolean);

      if (branch !== REQUIRED_BRANCH) {
        throw new Error(`Refusing operation on branch '${branch || "unknown"}'; expected '${REQUIRED_BRANCH}'.`);
      }
      if (!remotes.includes(REQUIRED_REMOTE)) {
        throw new Error(`Required Git remote '${REQUIRED_REMOTE}' is not configured.`);
      }

      const checks: CheckResult[] = [];
      checks.push(await run("git diff --check", "git", ["diff", "--check"]));
      checks.push(await run("frontend lint", "npm", ["run", "lint", "--prefix", "frontend"]));
      checks.push(await run("frontend build", "npm", ["run", "build", "--prefix", "frontend"]));

      const status = await pi.exec("git", ["status", "--short"], { cwd: ctx.cwd, signal });
      const summary = checks.map(formatCheck).join("\n\n");
      const failed = checks.some((check) => check.code !== 0);
      const commitSuggestion = "chore: update salon management system";

      if (failed) {
        return {
          content: [{ type: "text", text: `${summary}\n\nPush blocked because validation failed.` }],
          details: { checks, branch, remotes, pushed: false },
        };
      }

      if (params.action === "push") {
        if (status.stdout.trim()) {
          return {
            content: [{ type: "text", text: `${summary}\n\nPush blocked: working tree is not clean. Review and commit changes first.\nSuggested commit: ${commitSuggestion}` }],
            details: { checks, branch, remotes, pushed: false },
          };
        }

        const push = await run("push origin main", "git", ["push", REQUIRED_REMOTE, REQUIRED_BRANCH]);
        if (push.code !== 0) throw new Error(push.stderr || push.stdout || "Git push failed.");
        return {
          content: [{ type: "text", text: `${summary}\n\n${formatCheck(push)}` }],
          details: { checks: [...checks, push], branch, remotes, pushed: true },
        };
      }

      return {
        content: [{ type: "text", text: `${summary}\n\nWorking tree:\n${status.stdout || "(clean)"}\nSuggested commit: ${commitSuggestion}` }],
        details: { checks, branch, remotes, pushed: false },
      };
    },
  });
}
