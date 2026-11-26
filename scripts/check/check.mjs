import { existsSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { resolve } from "node:path"

import { classifyTouched } from "./scope.mjs"
import { runPnpm } from "../run.mjs"
import { reportResults, splitCommandArgs } from "./runner.mjs"

const root = resolve(import.meta.dirname, "../..")
const touched = process.argv.includes("--touched")
const fix = process.argv.includes("--fix")
const withE2e = process.argv.includes("--e2e")
const mappedE2e = process.argv.includes("--mapped-e2e")
const noE2e = process.argv.includes("--no-e2e")
const sinceIndex = process.argv.indexOf("--since")
const since = sinceIndex >= 0 ? (process.argv[sinceIndex + 1] ?? "") : undefined

if (since === "") {
  console.error("check.mjs: --since 需要一个 ref，如 --since origin/main")
  process.exit(1)
}

// 外部：prettier 不带 --cache 时会删默认缓存文件，与并发的 lint-staged 撞 ENOENT
const PRETTIER_CACHE = "node_modules/.cache/prettier/check"
const STYLELINT_CACHE = "node_modules/.cache/stylelint/cache"
const CHECK_CONCURRENCY = 4
// 外部：Windows 命令行上限 8191 字符，留出环境变量与引号余量
const MAX_ARG_CHARS = process.platform === "win32" ? 6000 : 100_000

function fileSteps(name, prefix, files) {
  return splitCommandArgs(prefix, files, MAX_ARG_CHARS).map((args) => ({ name, args }))
}

async function runPool(steps, limit = CHECK_CONCURRENCY) {
  const results = new Array(steps.length)
  let cursor = 0

  async function worker() {
    for (;;) {
      const index = cursor

      cursor += 1

      if (index >= steps.length) return
      const step = steps[index]
      const ran = await runPnpm(step.args, root)

      results[index] = { name: step.name, ...ran }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, steps.length) }, worker))
  return results
}

const CHECK_STEPS = [
  { name: "test", args: ["test"] },
  {
    name: "typecheck:packages",
    args: ["-r", "--workspace-concurrency=3", "--if-present", "typecheck"],
  },
  {
    name: "format",
    args: ["exec", "prettier", "--check", "--cache", "--cache-location", PRETTIER_CACHE, "."],
  },
  {
    name: "typecheck:e2e",
    args: ["exec", "tsc", "--noEmit", "-p", "e2e/tsconfig.json"],
  },
  {
    name: "typecheck:scripts",
    args: ["exec", "tsc", "--noEmit", "-p", "scripts/tsconfig.json"],
  },
  {
    name: "stylelint",
    args: ["exec", "stylelint", "--cache", "--cache-location", STYLELINT_CACHE, "**/*.{css,vue}"],
  },
  {
    name: "vue-template",
    args: ["exec", "node", "scripts/check/vue-template.mjs", "apps/web/src", "packages/ui/src"],
  },
  { name: "oxlint", args: ["exec", "oxlint", "."] },
  { name: "no-comments", args: ["exec", "node", "scripts/check/no-comments.mjs"] },
  { name: "css-tokens", args: ["exec", "node", "scripts/check/css-tokens.mjs"] },
]

function committedFiles(ref) {
  const opts = { cwd: root, encoding: "utf8", windowsHide: true }
  const ran = spawnSync("git", ["diff", "--name-only", `${ref}..HEAD`], opts)

  if (ran.status !== 0) {
    console.warn(`check: --since ${ref} 取不到提交范围，只查未提交改动`)
    return []
  }

  return ran.stdout.split(/\r?\n/)
}

function dirtyFiles() {
  const opts = { cwd: root, encoding: "utf8", windowsHide: true }
  const names = [
    ...spawnSync("git", ["diff", "--name-only"], opts).stdout.split(/\r?\n/),
    ...spawnSync("git", ["diff", "--name-only", "--cached"], opts).stdout.split(/\r?\n/),
    ...spawnSync("git", ["ls-files", "--others", "--exclude-standard"], opts).stdout.split(/\r?\n/),
  ]

  if (since) names.push(...committedFiles(since))
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
  const results = await runPool(CHECK_STEPS)

  reportResults("check", results)
}

async function fixTouched(scope) {
  /** @type {{ name: string, args: string[] }[]} */
  const steps = []

  steps.push(...fileSteps("format", ["exec", "prettier", "--write"], scope.prettierFiles))
  steps.push(...fileSteps("oxlint", ["exec", "oxlint", "--fix"], scope.lintFiles))
  steps.push(
    ...fileSteps(
      "stylelint",
      ["exec", "stylelint", "--cache", "--cache-location", STYLELINT_CACHE, "--fix"],
      scope.stylelintFiles,
    ),
  )

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

async function checkTouched(scope, files, label = "check:touched") {
  if (scope.escalate) {
    console.log(`${label}: 根配置有改动，升级为全量 pnpm check`)
    const ran = await runPnpm(["check"], root)
    process.stdout.write(ran.out)
    process.exitCode = ran.code

    if (ran.code === 0 && withE2e && !mappedE2e && !noE2e) await runFullE2e(label)
    else if (ran.code === 0 && mappedE2e && !noE2e)
      console.log(`${label}: 根配置有改动；全量 e2e 交由 CI 兜底（本地全跑可执行 pnpm test:e2e）`)
    return
  }

  const fullE2e = withE2e && !mappedE2e && !noE2e && scope.e2eAll
  const existingSpecs = scope.specs.filter((spec) => existsSync(resolve(root, spec)))
  const steps = []

  steps.push(
    ...fileSteps(
      "format",
      ["exec", "prettier", "--check", "--cache", "--cache-location", PRETTIER_CACHE],
      scope.prettierFiles,
    ),
  )
  steps.push(...fileSteps("oxlint", ["exec", "oxlint"], scope.lintFiles))
  steps.push(
    ...fileSteps("no-comments", ["exec", "node", "scripts/check/no-comments.mjs"], scope.lintFiles),
  )
  steps.push(
    ...fileSteps(
      "stylelint",
      ["exec", "stylelint", "--cache", "--cache-location", STYLELINT_CACHE],
      scope.stylelintFiles,
    ),
  )
  steps.push(
    ...fileSteps(
      "vue-template",
      ["exec", "node", "scripts/check/vue-template.mjs"],
      scope.vueFiles,
    ),
  )

  if (scope.packages.includes("@pig/web") || scope.packages.includes("@pig/ui") || scope.scripts)
    steps.push({ name: "css-tokens", args: ["exec", "node", "scripts/check/css-tokens.mjs"] })

  if (scope.scripts) {
    steps.push({
      name: "typecheck:scripts",
      args: ["exec", "tsc", "--noEmit", "-p", "scripts/tsconfig.json"],
    })
    steps.push({ name: "test:scripts", args: ["exec", "node", "--test", "scripts/**/*.test.mjs"] })
  }

  if (!scope.scripts && files.some((f) => /^(apps|packages|docs\/architecture)\//.test(f)))
    steps.push(
      { name: "arch-flows", args: ["exec", "node", "--test", "scripts/arch/flows.test.mjs"] },
      { name: "arch-layers", args: ["exec", "node", "--test", "scripts/arch/layers.test.mjs"] },
    )

  if (scope.e2e)
    steps.push({
      name: "typecheck:e2e",
      args: ["exec", "tsc", "--noEmit", "-p", "e2e/tsconfig.json"],
    })

  for (const id of scope.packages) {
    steps.push({ name: `typecheck:${id}`, args: ["--filter", id, "typecheck"] })
    steps.push({ name: `test:${id}`, args: ["--filter", id, "test"] })
  }

  const runMappedE2e =
    !fullE2e &&
    existingSpecs.length > 0 &&
    (withE2e || mappedE2e || scope.ui || scope.e2e) &&
    !noE2e

  if (steps.length === 0 && !fullE2e && !runMappedE2e) {
    if (mappedE2e && !noE2e && scope.e2eAll)
      console.log(
        `${label}: 改动波及全部旅程；全量 e2e 交由 CI 兜底（本地全跑可执行 pnpm test:e2e）`,
      )
    else if (existingSpecs.length)
      console.log(`${label}: 建议补跑 e2e → pnpm test:e2e ${existingSpecs.join(" ")}`)
    else console.log(`${label}: ${files.length} 个文件无需脚本/测试/lint`)
    return
  }

  const planned = [
    ...steps.map((step) => step.name),
    ...(runMappedE2e ? [`e2e:${existingSpecs.length}条`] : []),
  ]

  console.log(`${label}: ${files.length} files → ${planned.join(", ")}`)

  const results = await runPool(steps)

  if (results.some((result) => result.code !== 0)) {
    reportResults(label, results)
    return
  }

  if (mappedE2e && !noE2e && scope.e2eAll)
    console.log(`${label}: 改动波及全部旅程；全量 e2e 交由 CI 兜底（本地全跑可执行 pnpm test:e2e）`)

  if (runMappedE2e) {
    const e2eSteps = fileSteps(
      `e2e:${existingSpecs.length}条`,
      ["exec", "playwright", "test", "-c", "e2e/playwright.config.ts"],
      existingSpecs,
    )

    for (const step of e2eSteps) {
      const ran = await runPnpm(step.args, root)
      results.push({ name: step.name, ...ran })

      if (ran.code !== 0) break
    }
  } else if (!fullE2e && existingSpecs.length && !noE2e) {
    console.log(`${label}: 建议补跑 e2e → pnpm test:e2e ${existingSpecs.join(" ")}`)
  }

  if (results.length) reportResults(label, results)

  if (fullE2e && !process.exitCode) await runFullE2e(label)
}

async function runFullE2e(label) {
  console.log(`${label}: 改动波及全部旅程，跑全量 e2e`)
  const ran = await runPnpm(["test:e2e"], root)
  reportResults(`${label} e2e`, [{ name: "e2e:全量", ...ran }])
}

if (fix && !touched) {
  console.error("check.mjs: --fix 只配合 --touched 使用，全库请跑 pnpm fix")
  process.exitCode = 1
} else if (touched || since) {
  const { files, scope } = existingTouched()
  const label = since ? `check:since ${since}` : "check:touched"

  if (files.length === 0) {
    console.log(`${label}: 无改动，跳过`)
  } else if (fix) {
    await fixTouched(scope)
  } else {
    await checkTouched(scope, files, label)
  }
} else {
  await runAll()
}
