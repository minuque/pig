/** 把 git 脏路径映射到 check:touched 该跑的步骤。 */

export const PACKAGES = [
  { id: "@pig/web", prefix: "apps/web/" },
  { id: "@pig/desktop", prefix: "apps/desktop/" },
  { id: "@pig/gateway", prefix: "packages/gateway/" },
]
/** gateway 被 desktop 直接引用，改前者要连带检查后者的类型。 */
const PACKAGE_DEPENDENTS = { "@pig/gateway": ["@pig/desktop"] }
/** 路径前缀 → 该跑的 e2e（文件或整个目录）；未命中的 web 改动回落到新建会话旅程。 */
const NEW_SESSION = "e2e/conversation/new-session.spec.ts"
const SPLIT_VIEW = "e2e/workbench/split-view.spec.ts"
const E2E_BY_AREA = [
  { prefix: "apps/web/src/features/composer/", specs: ["e2e/composer/"] },
  {
    prefix: "apps/web/src/features/transcript-view/",
    specs: [
      "e2e/conversation/one-turn.spec.ts",
      "e2e/conversation/turn-progress.spec.ts",
      "e2e/conversation/history-page.spec.ts",
      "e2e/conversation/transcript-minimap.spec.ts",
    ],
  },
  {
    prefix: "apps/web/src/features/session-workbench/",
    specs: ["e2e/conversation/one-turn.spec.ts", NEW_SESSION, "e2e/sidebar/workspace.spec.ts"],
  },
  {
    prefix: "apps/web/src/features/session/",
    specs: [
      "e2e/conversation/one-turn.spec.ts",
      NEW_SESSION,
      "e2e/sidebar/workspace.spec.ts",
      SPLIT_VIEW,
    ],
  },
  { prefix: "apps/web/src/features/session-nav/", specs: ["e2e/sidebar/"] },
  {
    prefix: "apps/web/src/features/remote-workspace/",
    specs: ["e2e/sidebar/remote-workspace.spec.ts"],
  },
  {
    prefix: "apps/web/src/features/session-rail/",
    specs: ["e2e/workbench/subagent-rail.spec.ts", "e2e/workbench/background-task.spec.ts"],
  },
  { prefix: "apps/web/src/features/file-pane/", specs: ["e2e/workbench/file-pane.spec.ts"] },
  { prefix: "apps/web/src/features/split-view/", specs: [SPLIT_VIEW, NEW_SESSION] },
  { prefix: "apps/web/src/shell/", specs: [SPLIT_VIEW, NEW_SESSION] },
  {
    prefix: "apps/web/src/features/extension-ui/",
    specs: ["e2e/conversation/extension-ui.spec.ts"],
  },
  { prefix: "apps/web/src/features/settings/", specs: ["e2e/settings/"] },
  { prefix: "apps/web/src/features/startup/", specs: [NEW_SESSION, "e2e/startup/"] },
  // 布局、样式、主题、共享 UI 影响所有页面，跑新建会话旅程兜底
  { prefix: "apps/web/src/components/layout/", specs: [NEW_SESSION] },
  { prefix: "apps/web/src/style/", specs: [NEW_SESSION] },
  { prefix: "apps/web/src/features/theme/", specs: [NEW_SESSION] },
  { prefix: "apps/web/src/components/ui/", specs: [NEW_SESSION] },
]
const WEB_FALLBACK_SPECS = [NEW_SESSION]
const ROOT_TOOLING =
  /^(eslint\.config\.|stylelint\.config\.|scripts\/check\/lint-ignores\.mjs$|package\.json$|pnpm-workspace\.yaml$|pnpm-lock\.yaml$|tsconfig\.base\.json$|\.prettierrc|\.prettierignore$|prettier\.config)/
/** 改了就可能波及所有旅程：e2e 自身、各包源码、web 构建配置。 */
const E2E_ALL =
  /^(e2e\/|packages\/|apps\/web\/(vite\.config\.|index\.html$|package\.json$|public\/))/
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
  const rootTooling = normalized.some((file) => ROOT_TOOLING.test(file))
  const e2eAll = rootTooling || normalized.some((file) => E2E_ALL.test(file))
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
    e2eAll,
    scripts,
    ui,
    rootTooling,
    prettierFiles,
    lintFiles,
    stylelintFiles,
    vueFiles,
    escalate: rootTooling,
  }
}
