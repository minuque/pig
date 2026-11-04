import type { SettingsPane } from "@features/settings/hooks/use-settings-dialog.js"

/** 设置项索引：结果点开后切到对应分区，再滚到这条。 */
export interface SettingsSearchEntry {
  /** 目标元素 id；留空表示只切分区。 */
  id: string
  pane: SettingsPane
  title: string
  /** 所属分组名，结果里当副标题。 */
  section: string
}

/** 标题或分组名包含关键词就算命中；空白查询返回空表。 */
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
