export const PROSE = `## 改动摘要

把卡片外观收进 \`style/tokens.css\`，**所有类卡片组件**共用一组变量：

- 外环用 \`--border\`，行间分隔用 \`--separator-top\`
- 圆角统一为 \`--radius-card\`
- [x] 设置页已切换
- [ ] DESIGN.md 待同步

> 卡片边框用内阴影画，非整数缩放下不会被取整成实线。

\`\`\`ts
export const card = { ring: "--border", radius: "--radius-card" }
\`\`\`

| 变量 | 用途 | 默认值 |
| --- | --- | --- |
| \`--border\` | 卡片外环 | 黑 10% |
| \`--border-subtle\` | 行间分隔 | 黑 5% |
| \`--card-surface\` | 卡片底色 | transparent |

\`\`\`mermaid
flowchart LR
  tokens[tokens.css] --> card[Card]
  tokens --> table[Table]
\`\`\`

\`\`\`mermaid
stateDiagram-v2
  classDef inbox fill:#dbeafe,stroke:#93c5fd
  classDef archived fill:#ffe4e6,stroke:#e11d48
  classDef working fill:#fff7ed,stroke:#f97316
  state "收件箱" as inbox
  state "已归档" as archived
  state "工作中" as working
  [*] --> inbox
  inbox --> working: 你发一句话，会话开跑
  working --> inbox: 会话跑完
  inbox --> archived: 你归档
  archived --> inbox: 你取消归档
  class inbox inbox
  class archived archived
  class working working
\`\`\`
`
