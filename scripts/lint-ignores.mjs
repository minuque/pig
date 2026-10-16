import { readFileSync } from "node:fs"
import { join } from "node:path"

const ignoreFile = join(import.meta.dirname, "..", ".prettierignore")
/** ESLint / Stylelint 忽略。名单只在 .prettierignore。 */
export const lintIgnores = readFileSync(ignoreFile, "utf8")
  .split(/\r?\n/)
  .map((line) => line.replace(/#.*$/, "").trim())
  .filter(Boolean)
  .flatMap(toLintGlob)

/** @param {string} line */
function toLintGlob(line) {
  if (line.includes("*")) return [line]

  if (line === "nul" || /\.[A-Za-z0-9]+$/.test(line)) {
    return line.includes("/") ? [line] : [line, `**/${line}`]
  }

  const dir = line.replace(/\/$/, "")
  return [`${dir}/**`, `**/${dir}/**`]
}
