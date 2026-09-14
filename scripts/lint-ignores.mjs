/** ESLint / Stylelint 共用忽略。Prettier 的生成物目录与此对齐，见 .prettierignore。 */
export const lintIgnores = [
  "**/dist/**",
  "**/node_modules/**",
  "**/out/**",
  "packages/gateway/web/**",
  "release/**",
  "docs/**",
  ".tmp/**",
  ".worktrees/**",
  "playwright-report/**",
  "test-results/**",
]
