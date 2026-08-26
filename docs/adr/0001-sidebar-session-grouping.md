---
status: accepted
---

# 侧栏按更新时间或项目分组

左栏要扫读密度。不要日期桶、组头折叠、命令面板、第三栏。默认按更新时间平铺，可切项目分组，卡片两行两列。外观写在 `docs/ui-guidelines.md`。

## Considered options

- 今天 / 昨天 / 本周组头。扫读要先解析时间，改名还会打乱桶。
- 组头折叠、命令面板、第三栏。Waku 有，pig 只要两栏会话交互。
- 顶部再按工作目录筛选。项目分组已经按目录切开。

## Consequences

无 cwd 的会话不进侧栏。分组写入 `pig.sidebarGrouping`。截断计数只活在内存，切分组即清。
