/**
 * 全量校验：各步并行，收齐失败后再退出（不短路）。
 * 用法: pnpm check
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { reportResults, runPnpm } from "./check-run.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const CHECK_STEPS = [
  { name: "format", args: ["format:check"] },
  { name: "lint", args: ["lint"] },
  { name: "typecheck", args: ["typecheck"] },
  { name: "test", args: ["test"] },
  { name: "design-tokens", args: ["check:design-tokens"] },
];

const results = await Promise.all(
  CHECK_STEPS.map(async (step) => {
    const ran = await runPnpm(step.args, root);
    return { name: step.name, ...ran };
  }),
);
reportResults("check", results);
