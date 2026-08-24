import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const COMPACTION_THRESHOLD = 0.8;

export default function contextTrimmer(pi: ExtensionAPI) {
  let compactionRequested = false;

  pi.on("session_start", () => {
    compactionRequested = false;
  });

  pi.on("session_compact", () => {
    compactionRequested = false;
  });

  pi.on("agent_settled", (_event, ctx) => {
    if (compactionRequested) return;

    const usage = ctx.getContextUsage();
    const contextWindow = ctx.model?.contextWindow;
    if (!usage || !contextWindow || contextWindow <= 0) return;

    const ratio = usage.tokens / contextWindow;
    if (ratio < COMPACTION_THRESHOLD) return;

    compactionRequested = true;
    ctx.ui.setStatus("context-trimmer", "compacting context…");
    ctx.compact({
      customInstructions:
        "Preserve current goals, constraints, architectural decisions, changed files, test results, blockers, and exact next steps. Remove redundant logs and repeated discussion.",
      onComplete: () => {
        compactionRequested = false;
        ctx.ui.setStatus("context-trimmer", undefined);
        ctx.ui.notify("Context compacted.", "info");
      },
      onError: (error) => {
        compactionRequested = false;
        ctx.ui.setStatus("context-trimmer", undefined);
        ctx.ui.notify(`Context compaction failed: ${error.message}`, "warning");
      },
    });
  });
}
