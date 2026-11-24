import { PROJECT_ICONS } from "@components/icons/project-icons.js"
import { workspaceName } from "@features/session-nav/lib/format.js"
import type { ToneColor } from "@pig/ui"

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

export function projectIconTone(color: ProjectIconColor): ToneColor {
  return color === "gray" ? "neutral" : color
}

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

export function projectIconColorOf(path: string): ProjectIconColor {
  const seed = workspaceName(path).normalize("NFKC").trim().toLocaleLowerCase("en-US") || "project"
  let index = 0

  for (const glyph of seed) {
    index = (index * 31 + (glyph.codePointAt(0) ?? 0)) % PROJECT_ICON_COLORS.length
  }

  return PROJECT_ICON_COLORS[index]!
}

export function orderPinnedFirst<T extends { canonicalPath: string }>(
  groups: readonly T[],
  pinned: readonly string[],
): T[] {
  const byPath = new Map(groups.map((group) => [group.canonicalPath, group]))
  const top = pinned.flatMap((path) => byPath.get(path) ?? [])
  const pinnedSet = new Set(pinned)
  return [...top, ...groups.filter((group) => !pinnedSet.has(group.canonicalPath))]
}
