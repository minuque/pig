/**
 * 基础件的统一尺寸档：对外只有 s / m / l 三档，内部映射到 rt 的 1 / 2 / 3。
 * rt 的第 4 档（48px）不进这套刻度，用到它会让同一层组件的尺寸档多一条分支。
 */
export type Size = "s" | "m" | "l"

/** 档位到 rt 数字档的映射：s=24/28px、m=32px、l=40px（按钮） */
export const RT_SIZE = { s: "1", m: "2", l: "3" } as const

/** rt 的尺寸类名；不传按 m */
export function sizeClass(size: Size = "m"): string {
  return `rt-r-size-${RT_SIZE[size]}`
}
