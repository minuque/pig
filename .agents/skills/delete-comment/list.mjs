import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, relative, resolve } from "node:path"

const root = resolve(import.meta.dirname, "../../..")
const target = process.argv[2] ?? "."
const dir = mkdtempSync(join(tmpdir(), "delete-comment-"))
const empty = join(dir, "empty.json")
const cssGlob =
  target.endsWith(".css") || target.endsWith(".vue") ? target : `${target}/**/*.{css,vue}`

writeFileSync(empty, "{}")

function run(args, out) {
  spawnSync(["pnpm exec", ...args, "-o", `"${out}"`].join(" "), {
    cwd: root,
    shell: true,
    stdio: "ignore",
  })
  try {
    return JSON.parse(readFileSync(out, "utf8"))
  } catch {
    return []
  }
}

const eslint = run(
  ["eslint", target, "-f", "json", "--suppressions-location", `"${empty}"`],
  join(dir, "e.json"),
)
const style = run(
  [
    "stylelint",
    `"${cssGlob}"`,
    "-f",
    "json",
    "--suppress-location",
    `"${empty}"`,
    "--allow-empty-input",
  ],
  join(dir, "s.json"),
)
const rows = [
  ...eslint.flatMap((r) =>
    r.messages
      .filter((m) => m.ruleId === "pig-comments/no-comments")
      .map((m) => [r.filePath, m.line]),
  ),
  ...style.flatMap((r) =>
    r.warnings.filter((w) => w.rule === "pig/no-comments").map((w) => [r.source, w.line]),
  ),
]
const byFile = new Map()

for (const [file, line] of rows) byFile.set(file, [...(byFile.get(file) ?? []), line])

for (const [file, lines] of [...byFile].sort()) {
  const text = readFileSync(file, "utf8").split(/\r?\n/)

  console.log(`\n${relative(root, file).replaceAll("\\", "/")}`)
  for (const line of lines.sort((a, b) => a - b)) console.log(`  ${line}: ${text[line - 1].trim()}`)
}

console.log(`\n${rows.length} comments in ${byFile.size} files`)
