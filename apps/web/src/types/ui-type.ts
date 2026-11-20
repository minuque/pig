/** 基础件的统一尺寸档：对外只有 s / m / l 三档，不另开第 4 档。 */
export type Size = "s" | "m" | "l"

/** 菜单只要两档：s 紧凑、m 默认；不做 l，宽松档在大菜单里没有落点。 */
export type MenuSize = "s" | "m"

/** 基础件 color 的取值：语义色调，加项目图标、首字母徽章用的标识色 */
export type Tone = "accent" | "neutral" | "info" | "success" | "warning" | "danger"

export type IdentityHue = "indigo" | "cyan" | "green" | "amber" | "orange" | "red" | "violet"

export type ToneColor = Tone | IdentityHue
