export const PACKAGES = [
  { id: "@pig/protocol", prefix: "packages/protocol/" },
  { id: "@pig/environment", prefix: "packages/environment/" },
  { id: "@pig/extensions", prefix: "packages/extensions/" },
  { id: "@pig/ui", prefix: "packages/ui/" },
  { id: "@pig/web", prefix: "apps/web/" },
  { id: "@pig/desktop", prefix: "apps/desktop/" },
  { id: "@pig/gateway", prefix: "packages/gateway/" },
]
const PACKAGE_DEPENDENTS = {
  "@pig/gateway": ["@pig/desktop"],
  "@pig/protocol": ["@pig/web", "@pig/gateway", "@pig/desktop"],
  "@pig/ui": ["@pig/web"],
}
const NEW_SESSION = "e2e/conversation/new-session.spec.ts"
const SPLIT_VIEW = "e2e/workbench/split-view.spec.ts"
const REFERENCES = "e2e/composer/composer-references.spec.ts"
const E2E_BY_AREA = [
  { prefix: "apps/web/src/features/composer/", specs: ["e2e/composer/"] },
  {
    prefix: "apps/web/src/features/transcript-view/",
    specs: [
      "e2e/conversation/one-turn.spec.ts",
      "e2e/conversation/turn-progress.spec.ts",
      "e2e/conversation/history-page.spec.ts",
      "e2e/conversation/transcript-minimap.spec.ts",
      REFERENCES,
    ],
  },
  {
    prefix: "apps/web/src/features/session-workbench/",
    specs: [
      "e2e/conversation/one-turn.spec.ts",
      NEW_SESSION,
      "e2e/sidebar/workspace.spec.ts",
      "e2e/sidebar/session-nav.spec.ts",
      REFERENCES,
    ],
  },
  {
    prefix: "apps/web/src/features/session/",
    specs: [
      "e2e/conversation/one-turn.spec.ts",
      "e2e/conversation/external-turn.spec.ts",
      "e2e/conversation/external-append.spec.ts",
      NEW_SESSION,
      "e2e/sidebar/workspace.spec.ts",
      SPLIT_VIEW,
    ],
  },
  { prefix: "apps/web/src/features/session-nav/", specs: ["e2e/sidebar/"] },
  {
    prefix: "apps/web/src/features/session-rail/",
    specs: ["e2e/workbench/subagent-rail.spec.ts"],
  },
  {
    prefix: "apps/web/src/features/file-pane/",
    specs: ["e2e/workbench/file-pane.spec.ts", REFERENCES],
  },
  { prefix: "apps/web/src/features/split-view/", specs: [SPLIT_VIEW, NEW_SESSION] },
  { prefix: "apps/web/src/shell/", specs: [SPLIT_VIEW, NEW_SESSION] },
  { prefix: "apps/web/src/features/settings/", specs: ["e2e/settings/"] },
  { prefix: "apps/web/src/features/startup/", specs: [NEW_SESSION, "e2e/startup/"] },
  { prefix: "apps/web/src/components/layout/", specs: [NEW_SESSION] },
  { prefix: "apps/web/src/style/", specs: [NEW_SESSION] },
  { prefix: "apps/web/src/features/theme/", specs: [NEW_SESSION] },
  { prefix: "packages/ui/src/", specs: [NEW_SESSION] },
]
const WEB_FALLBACK_SPECS = [NEW_SESSION]
const ROOT_TOOLING =
  /^(eslint\.config\.|stylelint\.config\.|scripts\/check\/lint-ignores\.mjs$|package\.json$|pnpm-workspace\.yaml$|pnpm-lock\.yaml$|tsconfig\.base\.json$|\.prettierrc|\.prettierignore$|prettier\.config)/
const E2E_ALL =
  /^(e2e\/|packages\/|apps\/web\/(vite\.config\.|index\.html$|package\.json$|public\/))/
const LINTABLE = /\.(?:[cm]?[jt]sx?|vue)$/
const STYLELINTABLE = /\.(?:css|vue)$/
const PRETTIER = /\.(?:[cm]?[jt]sx?|vue|jsonc?|css|html|md|ya?ml)$/

export function normalizeRepoPath(path) {
  return path.replaceAll("\\", "/")
}

/**
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

/** @param {readonly string[]} files */
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
  const ui = normalized.some(
    (file) =>
      (file.startsWith("apps/web/src/") || file.startsWith("packages/ui/src/")) &&
      (file.endsWith(".vue") || file.endsWith(".css")),
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
