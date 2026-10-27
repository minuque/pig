/** 把 git 脏路径映射到 check:touched 该跑的步骤。 */

export const PACKAGES = [
  { id: "@pig/web", prefix: "apps/web/" },
  { id: "@pig/desktop", prefix: "apps/desktop/" },
  { id: "@pig/gateway", prefix: "packages/gateway/" },
]
/** gateway 被 desktop 直接引用，改前者要连带检查后者的类型。 */
const PACKAGE_DEPENDENTS = { "@pig/gateway": ["@pig/desktop"] }
/** 路径前缀 → 该跑的 e2e；未命中的 web 改动回落到关键旅程。 */
const E2E_BY_AREA = [
  {
    prefix: "apps/web/src/features/composer/",
    specs: [
      "e2e/composer-attachments.spec.ts",
      "e2e/composer-queue.spec.ts",
      "e2e/visual/composer.spec.ts",
    ],
  },
  {
    prefix: "apps/web/src/features/transcript-view/",
    specs: [
      "e2e/one-turn.spec.ts",
      "e2e/turn-progress.spec.ts",
      "e2e/visual/transcript.spec.ts",
      "e2e/history-page.spec.ts",
    ],
  },
  {
    prefix: "apps/web/src/features/session-workbench/",
    specs: [
      "e2e/critical-journey.spec.ts",
      "e2e/one-turn.spec.ts",
      "e2e/new-session.spec.ts",
      "e2e/workspace.spec.ts",
    ],
  },
  {
    prefix: "apps/web/src/features/session-nav/",
    specs: [
      "e2e/session-nav.spec.ts",
      "e2e/session-manage.spec.ts",
      "e2e/session-switch.spec.ts",
      "e2e/workspace.spec.ts",
      "e2e/visual/nav.spec.ts",
    ],
  },
  {
    prefix: "apps/web/src/features/startup/",
    specs: ["e2e/critical-journey.spec.ts", "e2e/error.spec.ts"],
  },
  { prefix: "apps/web/src/components/layout/", specs: ["e2e/critical-journey.spec.ts"] },
  // 样式、主题、共享 UI 影响所有对照图
  {
    prefix: "apps/web/src/style/",
    specs: [
      "e2e/visual/composer.spec.ts",
      "e2e/visual/transcript.spec.ts",
      "e2e/visual/nav.spec.ts",
    ],
  },
  {
    prefix: "apps/web/src/features/theme/",
    specs: [
      "e2e/theme.spec.ts",
      "e2e/visual/composer.spec.ts",
      "e2e/visual/transcript.spec.ts",
      "e2e/visual/nav.spec.ts",
    ],
  },
  {
    prefix: "apps/web/src/components/ui/",
    specs: [
      "e2e/visual/composer.spec.ts",
      "e2e/visual/transcript.spec.ts",
      "e2e/visual/nav.spec.ts",
    ],
  },
]
const WEB_FALLBACK_SPECS = ["e2e/critical-journey.spec.ts"]
const ROOT_TOOLING =
  /^(eslint\.config\.|stylelint\.config\.|scripts\/lint-ignores\.mjs$|package\.json$|pnpm-workspace\.yaml$|pnpm-lock\.yaml$|tsconfig\.base\.json$|\.prettierrc|\.prettierignore$|prettier\.config)/
const LINTABLE = /\.(?:[cm]?[jt]sx?|vue)$/
const STYLELINTABLE = /\.(?:css|vue)$/
const PRETTIER = /\.(?:[cm]?[jt]sx?|vue|jsonc?|css|html|md|ya?ml)$/

export function normalizeRepoPath(path) {
  return path.replaceAll("\\", "/")
}

/**
 * 把脏路径翻译成该跑的 e2e 用例。e2e 自身改动没法按范围判断，返回空交给全量。
 *
 * @param {readonly string[]} files
 * @param {readonly string[]} packages
 * @param {boolean} e2e
 */
function e2eSpecs(files, packages, e2e) {
  if (e2e) return []
  const specs = new Set()

  for (const area of E2E_BY_AREA) {
    if (!files.some((file) => file.startsWith(area.prefix))) continue

    for (const spec of area.specs) specs.add(spec)
  }

  if (specs.size === 0 && packages.includes("@pig/web")) {
    for (const spec of WEB_FALLBACK_SPECS) specs.add(spec)
  }

  return [...specs]
}

/**
 * @param {readonly string[]} files
 */
export function classifyTouched(files) {
  const normalized = files.map(normalizeRepoPath).filter(Boolean)
  const packages = []

  for (const pkg of PACKAGES) {
    if (normalized.some((file) => file.startsWith(pkg.prefix))) packages.push(pkg.id)
  }

  for (const pkg of [...packages]) {
    for (const dependent of PACKAGE_DEPENDENTS[pkg] ?? []) {
      if (!packages.includes(dependent)) packages.push(dependent)
    }
  }

  const e2e = normalized.some((file) => file.startsWith("e2e/"))
  const scripts = normalized.some((file) => file.startsWith("scripts/"))
  const tokens = normalized.some(
    (file) =>
      file === "DESIGN.md" ||
      file.endsWith("/app.css") ||
      file === "scripts/verify-design-tokens.mjs",
  )
  const designmd = normalized.includes("DESIGN.md")
  const rootTooling = normalized.some((file) => ROOT_TOOLING.test(file))
  const prettierFiles = normalized.filter((file) => PRETTIER.test(file))
  const lintFiles = normalized.filter((file) => LINTABLE.test(file))
  const stylelintFiles = normalized.filter((file) => STYLELINTABLE.test(file))
  const vueFiles = normalized.filter((file) => file.endsWith(".vue"))
  // UI 改动：模板与样式。只动数据、类型、测试时不算，避免每次都拉 e2e。
  const ui = normalized.some(
    (file) => file.startsWith("apps/web/src/") && (file.endsWith(".vue") || file.endsWith(".css")),
  )
  return {
    packages,
    e2e,
    specs: e2eSpecs(normalized, packages, e2e),
    scripts,
    ui,
    tokens,
    designmd,
    rootTooling,
    prettierFiles,
    lintFiles,
    stylelintFiles,
    vueFiles,
    escalate: rootTooling,
  }
}
