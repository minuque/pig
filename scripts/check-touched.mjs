/**
 * 单轮校验：只跑脏文件所属包。根配置改动升级为全量 check。
 * 用法: pnpm check:touched
 */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { classifyTouched } from "./check-scope.mjs";
import { reportResults, runPnpm } from "./check-run.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function dirtyFiles() {
  const opts = { cwd: root, encoding: "utf8", windowsHide: true };
  const names = [
    ...spawnSync("git", ["diff", "--name-only"], opts).stdout.split(/\r?\n/),
    ...spawnSync("git", ["diff", "--name-only", "--cached"], opts).stdout.split(/\r?\n/),
    ...spawnSync("git", ["ls-files", "--others", "--exclude-standard"], opts).stdout.split(/\r?\n/),
  ];
  return [...new Set(names.map((line) => line.trim()).filter(Boolean))];
}

async function main() {
  const files = dirtyFiles();
  if (files.length === 0) {
    console.log("check:touched: 无脏文件，跳过");
    return;
  }

  const scope = classifyTouched(files);
  if (scope.escalate) {
    console.log("check:touched: 根配置有改动，升级为全量 pnpm check");
    const ran = await runPnpm(["check"], root);
    process.stdout.write(ran.out);
    process.exitCode = ran.code;
    return;
  }

  /** @type {{ name: string, args: string[] }[]} */
  const steps = [];
  if (scope.prettierFiles.length) {
    steps.push({ name: "format", args: ["exec", "prettier", "--check", ...scope.prettierFiles] });
  }
  if (scope.lintFiles.length) {
    steps.push({ name: "lint", args: ["exec", "eslint", ...scope.lintFiles] });
  }
  if (scope.designmd)
    steps.push({ name: "designmd", args: ["exec", "designmd", "lint", "DESIGN.md"] });
  if (scope.tokens) steps.push({ name: "design-tokens", args: ["check:design-tokens"] });
  if (scope.scripts) {
    steps.push({
      name: "typecheck:scripts",
      args: ["exec", "tsc", "--noEmit", "-p", "scripts/tsconfig.json"],
    });
    steps.push({ name: "test:scripts", args: ["test:scripts"] });
  }
  for (const id of scope.packages) {
    steps.push({ name: `typecheck:${id}`, args: ["--filter", id, "typecheck"] });
    steps.push({ name: `test:${id}`, args: ["--filter", id, "test"] });
  }

  if (steps.length === 0) {
    console.log(`check:touched: ${files.length} 个脏文件无需脚本/测试/lint`);
    return;
  }

  console.log(
    `check:touched: ${files.length} files → ${steps.map((step) => step.name).join(", ")}`,
  );
  const results = await Promise.all(
    steps.map(async (step) => {
      const ran = await runPnpm(step.args, root);
      return { name: step.name, ...ran };
    }),
  );
  reportResults("check:touched", results);
}

void main();
