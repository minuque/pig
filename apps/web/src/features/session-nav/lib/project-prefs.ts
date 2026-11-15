import { PROJECT_ICONS } from "@components/icons/project-icons.js"

/** 复用 app.css 已引入的 rt 色板；gray 跟随 slate。 */
export const PROJECT_ICON_COLORS = [
  "gray",
  "indigo",
  "cyan",
  "green",
  "amber",
  "orange",
  "red",
  "violet",
] as const

export type ProjectIconColor = (typeof PROJECT_ICON_COLORS)[number]

export interface ProjectIconChoice {
  name: string
  color: ProjectIconColor
}

export interface ProjectPrefs {
  pinned: string[]
  icons: Record<string, ProjectIconChoice>
}

function isIconChoice(value: unknown): value is ProjectIconChoice {
  if (typeof value !== "object" || value === null) return false
  const { name, color } = value as Record<string, unknown>
  return (
    typeof name === "string" &&
    name in PROJECT_ICONS &&
    PROJECT_ICON_COLORS.includes(color as ProjectIconColor)
  )
}

/** 读存储里的项目偏好：不认识的项丢掉，损坏时回落空配置。 */
export function parseProjectPrefs(raw: unknown): ProjectPrefs {
  if (typeof raw !== "object" || raw === null) return { pinned: [], icons: {} }
  const { pinned, icons } = raw as Record<string, unknown>
  return {
    pinned: Array.isArray(pinned)
      ? pinned.filter((path): path is string => typeof path === "string")
      : [],
    icons:
      typeof icons === "object" && icons !== null
        ? Object.fromEntries(Object.entries(icons).filter(([, choice]) => isIconChoice(choice)))
        : {},
  }
}

/** 置顶项目按置顶顺序排前，其余保持原序。 */
export function orderPinnedFirst<T extends { canonicalPath: string }>(
  groups: readonly T[],
  pinned: readonly string[],
): T[] {
  const byPath = new Map(groups.map((group) => [group.canonicalPath, group]))
  const top = pinned.flatMap((path) => byPath.get(path) ?? [])
  const pinnedSet = new Set(pinned)
  return [...top, ...groups.filter((group) => !pinnedSet.has(group.canonicalPath))]
}
