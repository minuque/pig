/** 查看器怎么显示一个文件：按扩展名，不读内容。 */
export type FileViewKind = "markdown" | "image" | "text"

/** 与 cc-wrapper 的 fileMediaKind 同一份位图扩展名；SVG 另算。 */
const IMAGE = /\.(png|jpe?g|gif|bmp|webp|avif)$/i
const MARKDOWN = /\.(md|mdx|markdown)$/i

export function fileViewKind(path: string): FileViewKind {
  if (IMAGE.test(path)) return "image"
  return MARKDOWN.test(path) ? "markdown" : "text"
}
