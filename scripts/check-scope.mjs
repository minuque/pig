/** 把 git 脏路径映射到 check:touched 该跑的步骤。 */

export const PACKAGES = [
  { id: "@pig/web", prefix: "apps/web/" },
  { id: "@pig/desktop", prefix: "apps/desktop/" },
  { id: "@pig/gateway", prefix: "packages/gateway/" },
]
/** gateway 被 desktop 直接引用，改前者要连带检查后者的类型。 */
const PACKAGE_DEPENDENTS = { "@pig/gateway": ["@pig/desktop"] }
const ROOT_TOOLING =
  /^(eslint\.config\.|stylelint\.config\.|scripts\/lint-ignores\.mjs$|package\.json$|pnpm-workspace\.yaml$|pnpm-lock\.yaml$|tsconfig\.base\.json$|\.prettierrc|\.prettierignore$|prettier\.config)/
const LINTABLE = /\.(?:[cm]?[jt]sx?|vue)$/
const STYLELINTABLE = /\.(?:css|vue)$/
const PRETTIER = /\.(?:[cm]?[jt]sx?|vue|jsonc?|css|html|md|ya?ml)$/

export function normalizeRepoPath(path) {
  return path.replaceAll("\\", "/")
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
  return {
    packages,
    e2e,
    scripts,
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
