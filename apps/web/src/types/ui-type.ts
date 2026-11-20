/** 基础件的统一尺寸档：对外只有 s / m / l 三档，不另开第 4 档。 */
export type Size = "s" | "m" | "l"

/** 菜单只要两档：s 紧凑、m 默认；不做 l，宽松档在大菜单里没有落点。 */
export type MenuSize = "s" | "m"
