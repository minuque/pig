/** 校验入口：pnpm check；--touched 脏文件；--touched --fix 先写回。 */
import { existsSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { classifyTouched } from "./check-scope.mjs"
import { reportResults, runPnpm } from "./check-run.mjs"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")

const touched = process.argv.includes("--touched")

const fix = process.argv.includes("--fix")

const CHECK_STEPS = [
  { name: "format", args: ["exec", "prettier", "--check", "."] },
  { name: "eslint", args: ["exec", "eslint", "."] },
  { name: "stylelint", args: ["exec", "stylelint", "**/*.{css,vue}"] },
  { name: "designmd", args: ["exec", "designmd", "lint", "DESIGN.md"] },
  { name: "typecheck", args: ["typecheck"] },
  { name: "test", args: ["test"] },
  { name: "design-tokens", args: ["check:design-tokens"] },
]

function dirtyFiles() {
  const opts = { cwd: root, encoding: "utf8", windowsHide: true }

  const names = [
    ...spawnSync("git", ["diff", "--name-only"], opts).stdout.split(/\r?\n/),
    ...spawnSync("git", ["diff", "--name-only", "--cached"], opts).stdout.split(/\r?\n/),
    ...spawnSync("git", ["ls-files", "--others", "--exclude-standard"], opts).stdout.split(/\r?\n/),
  ]

  return [...new Set(names.map((line) => line.trim()).filter(Boolean))]
}

function existingTouched() {
  const files = dirtyFiles()
  const scope = classifyTouched(files)
  const keep = (list) => list.filter((file) => existsSync(resolve(root, file)))

  scope.prettierFiles = keep(scope.prettierFiles)
  scope.lintFiles = keep(scope.lintFiles)
  scope.stylelintFiles = keep(scope.stylelintFiles)

  return { files, scope }
}

async function runAll() {
  const results = await Promise.all(
    CHECK_STEPS.map(async (step) => {
      const ran = await runPnpm(step.args, root)

      return { name: step.name, ...ran }
    }),
  )

  reportResults("check", results)
}

async function fixTouched(scope) {
  /** @type {{ name: string, args: string[] }[]} */
  const steps = []

  if (scope.prettierFiles.length) {
    steps.push({ name: "format", args: ["exec", "prettier", "--write", ...scope.prettierFiles] })
  }

  if (scope.lintFiles.length) {
    steps.push({ name: "eslint", args: ["exec", "eslint", "--fix", ...scope.lintFiles] })
  }

  if (scope.stylelintFiles.length) {
    steps.push({
      name: "stylelint",
      args: ["exec", "stylelint", "--fix", ...scope.stylelintFiles],
    })
  }

  if (steps.length === 0) {
    console.log("fix:touched: 无文件需要格式化")

    return
  }

  console.log(`fix:touched: ${steps.map((step) => step.name).join(", ")}`)
  const results = []

  for (const step of steps) {
    const ran = await runPnpm(step.args, root)
    results.push({ name: step.name, ...ran })

    if (ran.code !== 0) {
      reportResults("fix:touched", results)

      return
    }
  }

  reportResults("fix:touched", results)
}

async function checkTouched(scope, files) {
  if (scope.escalate) {
    console.log("check:touched: 根配置有改动，升级为全量 pnpm check")
    const ran = await runPnpm(["check"], root)
    process.stdout.write(ran.out)
    process.exitCode = ran.code

    return
  }

  /** @type {{ name: string, args: string[] }[]} */
  const steps = []

  if (scope.prettierFiles.length) {
    steps.push({ name: "format", args: ["exec", "prettier", "--check", ...scope.prettierFiles] })
  }

  if (scope.lintFiles.length) {
    steps.push({ name: "eslint", args: ["exec", "eslint", ...scope.lintFiles] })
  }

  if (scope.stylelintFiles.length) {
    steps.push({ name: "stylelint", args: ["exec", "stylelint", ...scope.stylelintFiles] })
  }

  if (scope.designmd)
    steps.push({ name: "designmd", args: ["exec", "designmd", "lint", "DESIGN.md"] })

  if (scope.tokens) steps.push({ name: "design-tokens", args: ["check:design-tokens"] })

  if (scope.scripts) {
    steps.push({
      name: "typecheck:scripts",
      args: ["exec", "tsc", "--noEmit", "-p", "scripts/tsconfig.json"],
    })
    steps.push({ name: "test:scripts", args: ["test:scripts"] })
  }

  for (const id of scope.packages) {
    steps.push({ name: `typecheck:${id}`, args: ["--filter", id, "typecheck"] })
    steps.push({ name: `test:${id}`, args: ["--filter", id, "test"] })
  }

  if (steps.length === 0) {
    console.log(`check:touched: ${files.length} 个脏文件无需脚本/测试/lint`)

    return
  }

  console.log(`check:touched: ${files.length} files → ${steps.map((step) => step.name).join(", ")}`)

  const results = await Promise.all(
    steps.map(async (step) => {
      const ran = await runPnpm(step.args, root)

      return { name: step.name, ...ran }
    }),
  )

  reportResults("check:touched", results)
}

if (fix && !touched) {
  console.error("check.mjs: --fix 只配合 --touched 使用，全库请跑 pnpm fix")
  process.exitCode = 1
} else if (touched) {
  const { files, scope } = existingTouched()

  if (files.length === 0) {
    console.log(`${fix ? "fix" : "check"}:touched: 无脏文件，跳过`)
  } else if (fix) {
    await fixTouched(scope)
  } else {
    await checkTouched(scope, files)
  }
} else {
  await runAll()
}
