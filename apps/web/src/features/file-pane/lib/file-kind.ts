/** 查看器怎么显示一个文件：按扩展名，不读内容。 */
export type FileViewKind =
  "markdown" | "image" | "video" | "audio" | "pdf" | "csv" | "svg" | "html" | "text"

/** 与 cc-wrapper 的 fileMediaKind 同一份扩展名；SVG 另算。 */
const IMAGE = /\.(png|jpe?g|gif|bmp|webp|avif)$/i
const MARKDOWN = /\.(md|mdx|markdown)$/i

export function fileViewKind(path: string): FileViewKind {
  if (IMAGE.test(path)) return "image"

  if (/\.(mp4|webm|mov|m4v|ogv)$/i.test(path)) return "video"

  if (/\.(mp3|m4a|aac|wav|flac|opus|ogg|oga)$/i.test(path)) return "audio"

  if (/\.pdf$/i.test(path)) return "pdf"

  if (/\.svg$/i.test(path)) return "svg"

  if (/\.html?$/i.test(path)) return "html"

  if (/\.(csv|tsv)$/i.test(path)) return "csv"
  return MARKDOWN.test(path) ? "markdown" : "text"
}
