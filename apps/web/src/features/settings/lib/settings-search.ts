import type { SettingsPane } from "@features/settings/hooks/use-settings-dialog.js"

export interface SettingsSearchEntry {
  id: string
  pane: SettingsPane
  title: string
  section: string
}

export function matchSettings(
  entries: readonly SettingsSearchEntry[],
  query: string,
): SettingsSearchEntry[] {
  const keyword = query.trim().toLowerCase()

  if (!keyword) return []
  return entries.filter(
    (entry) =>
      entry.title.toLowerCase().includes(keyword) || entry.section.toLowerCase().includes(keyword),
  )
}
