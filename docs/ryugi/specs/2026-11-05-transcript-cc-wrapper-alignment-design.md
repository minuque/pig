# 会话正文对齐 cc-wrapper：重构设计

日期：2026-11-05
状态：已批准，已实施

## 目标

把 `transcript-view` 的正文 UI 与交互对齐 cc-wrapper：工具运行折叠成一行摘要，展开后是描边卡片，每条工具一行，行内再展开输出。正文采用 cc-wrapper 的排版比例。实现上去掉窗口化、步骤轨道动画和切会话旧画面过渡，保留小地图、状态行、消息操作、跟随滚动与位置恢复。

## 非目标

- 不改 Pi 的数据管线、流式协议和会话状态。
- 不改输入卡、侧栏、设置弹框结构。
- 不改小地图、状态行和现有消息操作按钮的行为。
- 不换 markdown 渲染器，不新增依赖。

## 反目标

- 不恢复按轮挂载的窗口化、高度索引或尾部常驻。
- 不保留步骤轨道、逐步骤入场动画或 stagger 延迟。
- 不保留切会话时克隆旧画面再淡出的过渡。

## 已定决策

| 决策 | 来源 |
| --- | --- |
| 对齐范围是整块正文：用户消息、助手 markdown、工具卡片、状态与耗时 | 用户 |
| 先 1:1 复刻 cc-wrapper 的 UI 与交互，后续再按 pig 风格微调 | 用户 |
| 参考实现以 cc-wrapper 源码为准 | 用户 |
| 去掉窗口化，所有轮直接挂载 | 用户 |
| 去掉切会话旧画面克隆与淡出 | 用户 |
| 保留小地图，包括点击跳转 | 用户 |
| 状态与耗时行保持现状，猪图标保留，消息操作按钮不动 | 用户 |
| 去掉步骤轨道动画，工具行改为平面行 | 用户 |
| 滚动跟随、离开底部停止、切回会话恢复位置保留 | 用户 |
| 视觉尺寸照搬 cc-wrapper，颜色与字体用 pig token | 用户 |
| 默认隐藏思考块 | 用户 |
| 工具行分四类：读文件、改文件、命令、其他 | 用户 |
| 保留 markstream-vue，只对齐排版参数 | 用户 |
| 错误与中止按 cc-wrapper 的错误行复刻 | 用户 |

## 结构

```text
TranscriptBody
  TranscriptMinimap            （保留，输入改为全量轮）
  .transcript-viewport
    TurnRow x N                （全部挂载）
      UserMessage              （气泡 + 折叠 + 链接 chip + 时间戳）
      AssistantMessage         （markstream-vue，排版参数对齐）
      ToolRun                  （一组工具运行）
        ToolRunHeader          （摘要行：灰字 + 14px 箭头 + 增减行数）
        ToolRunCard            （描边卡片，仅展开时渲染）
          ToolRow x N          （行间 1px 分割线）
            ToolRowTrigger     （箭头 + 动词 + 对象 + 行数）
            ToolCommandBody    （终端输出）
            ToolFileBody       （读文件行 / diff / 搜索列表）
            ToolGenericBody    （参数 + 结果）
      TurnErrorRow             （错误或中止，一行）
      TranscriptStatus         （现状不变）
```

## 尺寸与 token

数值取自 cc-wrapper 的 `source-transcript.css` 与 `source-tool-group.css`。颜色、字体、圆角、阴影使用 pig token。

| 用途 | cc-wrapper 值 | pig 落点 |
| --- | --- | --- |
| 内容宽 | 768px | `--size-content` 舒适档由 680px 改为 768px |
| 正文 | 14px / 1.42857 | `--text-body-md` / `--text-body-md--line-height` |
| 左右留白 | 最少 32px，窗口小于 780px 时 20px | `--transcript-gutter`、`--transcript-gutter-narrow` |
| 正文上下留白 | 48px | `--transcript-pad-block` |
| 轮间距 / 行间距 | 0.75 行 / 0.5 行（15px / 10px） | `--transcript-turn-gap`、`--transcript-item-gap` |
| 卡片圆角 / 描边 | 8px / 内描边 1px | `--radius-md` / `var(--border)` |
| 卡片行内边距 | 16px 10px | `--space-md`、`--transcript-row-pad` |
| 摘要与行内触发 | 间距 2px / 3px，箭头 14px | `--space-xxs`、`--size-icon` |

## 组件与文件变更

| 动作 | 文件 | 说明 |
| --- | --- | --- |
| 改 | `components/TranscriptBody.vue` | 去掉窗口化；全部轮渲染；位置恢复改为 scrollTop 记忆 |
| 改 | `features/session-workbench/index.vue` | 删除 `useTranscriptHold` 与旧画面克隆 |
| 改 | `components/TurnRow.vue` | 工具行换成 `ToolRun`；错误行并入 |
| 改 | `components/UserMessage.vue` | 气泡尺寸对齐 cc-wrapper |
| 改 | `components/AssistantMessage.vue` | 去掉错误 Callout，只留 markdown 与时间戳 |
| 新 | `components/tool/ToolRun.vue` | 摘要行、展开状态、650ms 标签驻留 |
| 新 | `components/tool/ToolRunCard.vue` | 描边卡片与行列表 |
| 新 | `components/tool/ToolRow.vue` | 行内触发与详情展开 |
| 新 | `components/tool/ToolCommandBody.vue` | 终端输出 |
| 新 | `components/tool/ToolFileBody.vue` | 读文件、diff、搜索列表 |
| 新 | `components/tool/ToolGenericBody.vue` | 参数与结果 |
| 新 | `components/TurnErrorRow.vue` | 错误与中止的一行展示 |
| 新 | `lib/tool-run.ts` | 摘要、动词映射、目标提取、运行中标签 |
| 删 | `hooks/use-transcript-window.ts`、`hooks/use-transcript-keep-alive.ts`、`hooks/use-transcript-hold.ts` | 窗口化与切会话覆盖层 |
| 删 | `lib/transcript-window.ts`、`lib/step-rail.ts` | 高度索引与轨道几何 |
| 删 | `components/ToolSteps.vue` 等 8 个旧工具组件 | 被 ToolRun 系列替代 |

## 数据映射

行构建器保留：`TranscriptItem[]` 仍先变成 `UserRow / AssistantRow / ToolRow`，再按 user 条目分轮。

- `ThoughtStep` 保留在数据里，状态行仍读它计算活动文案；工具行不渲染思考块。
- 一条 `ToolRow` 对应一个 `ToolRun`；单个调用直接渲染一行，两个及以上折叠成摘要 + 卡片。
- 动词映射：read → 读取，edit/write → 编辑，bash/powershell → 运行，grep/find/ls → 搜索，其余用工具名。
- 行右的 `+n -n` 沿用 `lib/tool-summary.ts` 的增删行统计。
- 运行中显示最后一个运行中工具的动词与对象，带 shimmer；运行结束后标签驻留 650ms 再切到总结。

## 交互

- 点摘要行展开或收起卡片；箭头 60ms 旋转；展开状态按「会话 + 工具组」记在内存里。
- 点行内触发展开该行输出；默认收起。
- 运行中不自动展开。
- 错误与中止在整轮最后渲染一行 `TurnErrorRow`，取助手行的 error / aborted。
- 状态行、消息操作按钮、小地图交互、跟随滚动与位置恢复不动。

## 实施中的取舍

- 参考实现取 cc-wrapper 当前的 `turnStatusRows` 分支，但卡片外观按经典结构落地。
- 单个工具调用直接渲染一行，不套摘要与卡片。
- 摘要按类别聚合，复用 `toolRowLabelParts`；失败类别动词标红并显示失败数。
- 用户消息保留右对齐气泡，尺寸改为 85% 宽、8×12 内边距（cc-wrapper 当前不是纯文本段落）。
- 错误行只展示，不加「重试」按钮：Pi 没有重试接口。
- 搜索类走工具文件行的文本输出，单列搜索界面留到以后。
- 舒适档内容宽改为 768px，与现有宽度设置共用 `--size-content`。

## 验收

1. `pnpm fix:touched` 与 `pnpm check:touched` 通过。
2. 浏览器里检查工具组摘要与卡片、用户消息、markdown 排版、错误行。
3. 长会话滚动与流式输出没有卡顿回归；bench 的回合指标通过。
4. 小地图、状态行、消息操作、切会话位置恢复正常。
5. 窗口化与轨道相关文件已删除，没有残留引用。

## 对话用过的 artifact

- 类型 document，id `transcript-cc-wrapper-alignment`，路径 `.ryugi/artifacts/document/transcript-cc-wrapper-alignment/`。第一轮 6 项建议全部接受；状态与耗时行经评论确认保持现状。
