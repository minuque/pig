import type { GitFileStatus } from "@/types/common-type.js"

/** 路径上面的每一级目录，从外到里。 */
export function ancestors(path: string): string[] {
  const parts = path.split("/").slice(0, -1)
  return parts.map((_, index) => parts.slice(0, index + 1).join("/"))
}

/** 文件给状态字母；上级目录只标 "dir"，表示里面有改动。 */
export function gitMarks(files: readonly GitFileStatus[]) {
  const marks = new Map<string, GitFileStatus["status"] | "dir">()

  for (const file of files) {
    marks.set(file.path, file.status)

    for (const dir of ancestors(file.path)) if (!marks.has(dir)) marks.set(dir, "dir")
  }

  return marks
}
