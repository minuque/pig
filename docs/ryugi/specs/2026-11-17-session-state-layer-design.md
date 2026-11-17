# `features/session` 下沉成状态层：设计稿

2026-11-17 在架构评审对话里定稿。标「我定的」的是设计者自定、用户未逐条确认的取舍。

## 1. 目的

用户的方向：render 层做薄，和业务逻辑解耦。

`docs/directory-structure.md` 说 `features/session` 是会话状态、没有视图，别的 feature 引用它、不反过来。但它今天引用了两个视图 feature：

| 位置 | 引用 |
|---|---|
| `session/hooks/use-session.ts:6` | `useSessionComposer`（`@features/composer`） |
| `session/hooks/use-session.ts:7` | `sameModel`、`thinkingLevelOf`（`composer/lib/model-preset`） |
| `session/hooks/use-session.ts:5`、`use-background-send.ts:3` | 类型 `ComposerAttachmentBatch`（`composer/hooks/use-composer-attachments`） |
| `session/lib/session-state.ts:11` | `userMessageText`（`@features/transcript-view`） |

`docs/architecture/layers.ts` 把 `session`、`composer`、`transcript-view` 放在同一层「功能」，所以分层检查拦不住。

这份设计把 `features/session` 变成真正的底层：**它不引用任何别的 feature**，并用检查守住。

这是纯重构，用户看不到任何变化。

## 2. 范围

| 要做 | 不做 |
|---|---|
| 去掉上表四处引用 | 拆超过 500 行的 `.vue` 文件 |
| `layers.ts` 加「状态」层；eslint 加一条规则守住 | `client/` 里依赖 Vue 的两个文件 |
| 修 `docs/directory-structure.md` 里对应的说法和两处过期内容 | 其他 feature 之间的引用 |
| | 任何行为或界面变化 |

## 3. 四处引用各自怎么去

### 3.1 附件批次类型

`ComposerAttachment` 与 `ComposerAttachmentBatch` 是 session 与 composer 共用的数据形状。按目录约定，被两条及以上路径依赖的类型放 `apps/web/src/types/`。移到 `types/attachment-type.ts`，两边都从那里引。`ComposerAttachmentsApi` 是 composer 自己的接口，留在原处。

### 3.2 模型比较与档位转换

`sameModel`、`thinkingLevelOf` 是不依赖视图的纯函数。移到 `features/session/lib/`，composer 改为从 session 引。（我定的）方向是功能层引状态层，合规。`ComposerModel` 与协议的 `ModelRef` 形状相同，移过去的函数用 `ModelRef`。

### 3.3 `useSessionComposer`

这是唯一要动结构的一处。今天 `useSessionLifecycle` 在内部调用它，再把 `catalog`、`preset`、`usage`、`createModel`、`consumeDetachedEdit` 一起从 `useSession()` 给出去。它们其实是三样东西：

| 今天从 session 给出 | 性质 | 去向 |
|---|---|---|
| `contextUsage`（`usage`） | 对占用估算的纯投影，`session-rail` 也在用 | 投影函数 `projectContextUsage` 与类型 `ContextUsage` 移进 `features/session/lib/`，session 继续给出 `contextUsage`。调用方不用改 |
| `catalog`、`preset` | 输入卡的选择状态 | 归 composer。不再经 `useSession()` 给出 |
| `createModel`、`consumeDetachedEdit` | session 在建会话和发送时要问「用户选了什么」 | session 定义一个小接口，由外面注入 |

做法（我定的）：

- `features/session/type.ts` 定义接口，比如 `PresetPort`：`createModel()` 与 `consumeDetachedEdit()`，签名照今天的用法。
- `useSessionLifecycle` 不再调用 `useSessionComposer`。它给出一个注册函数，照同文件里 `setWelcomeHandoff`、`setBackgroundIdleHandler` 的现有写法。没注册时两个方法都当作返回 `undefined`。
- `useSessionLifecycle` 给出 composer 需要的原料：`snapshot`、`phase`、占用估算、`setModel`、`setThinking`。
- composer 一侧用模块级 `provide` / `use`（放 `features/composer/index.ts`，符合目录约定）：拿 session 的原料调 `useSessionComposer`，把 `createModel` / `consumeDetachedEdit` 注册回 session，再把 `catalog`、`preset` 提供给子树。
- 每一侧 workbench 调一次，位置在 `shell/WorkbenchPane.vue`，紧跟现有的 `provideSession(props.session)`。
- `session-workbench/index.vue` 里的 `catalog`、`preset` 改从 composer 的 `use` 拿。

约束：注册必须在这一侧能发送之前完成。两侧分屏各有各的注册，不能串。

### 3.4 `userMessageText`

`transcriptText`、`stripExpansionBlocks`、`userMessageText` 是对转录条目的纯文本处理（`transcript-view/lib/transcript-format.ts`）。移到 `features/session/lib/`，`transcript-view` 改为从 session 引。`transcript-view/index.ts` 现有的再导出是否保留，看还有没有别的调用方。

## 4. 守住它

- `docs/architecture/layers.ts` 的 `apps/web`：在「功能」与「组件」之间加一层「状态」，只放 `features/session`。`split-view` 有视图组件，留在「功能」。
- `eslint.config.js`：对 `apps/web/src/features/session/**` 加 `no-restricted-imports`，禁止 `@features/*`，放行 `@features/session/*`。（我定的）分层看板只展示违规，不让检查失败；eslint 规则才是能挡住回退的那道门。
- `docs/directory-structure.md`：
  - 把「feature 之间的引用保持单向」那句改成明确的规则：`features/session` 不引用任何别的 feature。
  - 顺手修两处过期内容：gateway 目录树里的 `directory.ts` 已在 `system/` 下；内置扩展列表漏了 `tasks`。

## 5. 约束

- 守 `AGENTS.md`：别名导入、目录约定（`lib/` 放纯逻辑，模块级 `provide` / `use` 放 `index.ts`）、单文件不超过 500 行。
- 只移动和改接线，不改逻辑。移动的函数不改名，除非类型必须跟着换。
- `apps/web/test/` 镜像 `src/`：被移动函数的现有单测跟着移到对应目录。
- 不新增单测。这次没有新的产品假设；回归靠现有单测和全量 e2e。

## 6. 留给执行方

- 新文件的命名、`PresetPort` 的最终名字。
- composer 一侧 `provide` / `use` 的函数名。
- 移动后 `composer/type.ts` 里哪些类型保留、哪些改成从 `types/` 再导出。

## 7. 验收

- `grep` 确认 `apps/web/src/features/session/` 里没有 `@features/` 开头且不是 `@features/session/` 的引用。
- 在 `features/session` 里临时加一行对 `@features/composer` 的引用，`pnpm exec eslint` 报错；删掉后通过。
- `pnpm arch` 通过，看板上 `features/session` 落在「状态」层且没有新增违规。
- `pnpm check:touched` 通过。
- `pnpm build:web` 后全量 `pnpm test:e2e` 通过。重点看分屏（两侧各选各的模型）、新建会话带模型、后台发送带附件。
- `pnpm test:bench` 各项不比改动前慢 10% 以上。

## 8. 分工

四处改动都落在 `use-session.ts` 附近，并行会互相踩。

| 顺序 | 执行方 | 范围 |
|---|---|---|
| 1 | 一个执行方 | 3.1、3.2、3.4：只移动，不改结构 |
| 2 | 同一个执行方 | 3.3：`useSessionComposer` 的反转 |
| 3 | 同一个执行方 | 第 4 节：分层、eslint、文档 |
| 4 | 主会话 | 评审、全量 e2e、基准对比、提交 |
