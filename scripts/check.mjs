/** 校验入口：pnpm check；--touched 脏文件；--touched --fix 先写回。 */
import { existsSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { resolve } from "node:path"

import { classifyTouched } from "./check-scope.mjs"
import { reportResults, runPnpm } from "./check-run.mjs"

const root = resolve(import.meta.dirname, "..")
const touched = process.argv.includes("--touched")
const fix = process.argv.includes("--fix")
/* DESIGN.md 缺失时（token 稳定前）跳过 designmd lint 与 token 校验，重新生成后自动恢复。 */
const hasDesignMd = existsSync(resolve(root, "DESIGN.md"))
const CHECK_STEPS = [
  { name: "format", args: ["exec", "prettier", "--check", "."] },
  { name: "eslint", args: ["exec", "eslint", "."] },
  { name: "stylelint", args: ["exec", "stylelint", "**/*.{css,vue}"] },
  {
    name: "vue-template",
    args: ["exec", "tsx", "scripts/check-vue-template.ts", "apps/web/src"],
  },
  ...(hasDesignMd
    ? [
        { name: "designmd", args: ["exec", "designmd", "lint", "DESIGN.md"] },
        { name: "design-tokens", args: ["check:design-tokens"] },
      ]
    : []),
  { name: "typecheck", args: ["typecheck"] },
  { name: "test", args: ["test"] },
]

function reportDesignMdSkip() {
  if (!hasDesignMd) console.log("跳过: designmd, design-tokens（DESIGN.md 缺失）")
}

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
  scope.vueFiles = keep(scope.vueFiles)
  return { files, scope }
}

async function runAll() {
  reportDesignMdSkip()

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

  reportDesignMdSkip()

  /** @type {{ name: string, args: string[] }[]} */
  const steps = []

  if (scope.prettierFiles.length) {
    steps.push({
      name: "format",
      args: ["exec", "prettier", "--check", ...scope.prettierFiles],
    })
  }

  if (scope.lintFiles.length) {
    steps.push({ name: "eslint", args: ["exec", "eslint", ...scope.lintFiles] })
  }

  if (scope.stylelintFiles.length) {
    steps.push({ name: "stylelint", args: ["exec", "stylelint", ...scope.stylelintFiles] })
  }

  if (scope.vueFiles.length) {
    steps.push({
      name: "vue-template",
      args: ["exec", "tsx", "scripts/check-vue-template.ts", ...scope.vueFiles],
    })
  }

  if (scope.designmd && hasDesignMd)
    steps.push({ name: "designmd", args: ["exec", "designmd", "lint", "DESIGN.md"] })

  if (scope.tokens && hasDesignMd)
    steps.push({ name: "design-tokens", args: ["check:design-tokens"] })

  if (scope.scripts) {
    steps.push({
      name: "typecheck:scripts",
      args: ["exec", "tsc", "--noEmit", "-p", "scripts/tsconfig.json"],
    })
    steps.push({ name: "test:scripts", args: ["test:scripts"] })
  }

  if (scope.e2e)
    steps.push({
      name: "typecheck:e2e",
      args: ["exec", "tsc", "--noEmit", "-p", "e2e/tsconfig.json"],
    })

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
