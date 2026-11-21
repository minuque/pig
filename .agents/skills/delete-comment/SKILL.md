---
name: delete-comment
description: 清理代码注释：按五类放行名单逐条判定，赘述/过时直接删，借口删掉并开 issue，决策记录搬进 docs/adr，最后收紧 lint 的 suppressions 基线。用于「删注释」「清注释」「/delete-comment」或 lint 报 pig-comments/no-comments、pig/no-comments 时。
---

# /delete-comment

`pig-comments/no-comments`（ESLint，管 `.ts` `.js` `.mjs` `.vue` 的脚本与模板）和 `pig/no-comments`（Stylelint，管 `.css` 与 `<style>`）禁止注释。放行名单在 `scripts/check/no-comments.mjs`。存量记在根目录的 `eslint-suppressions.json` 与 `stylelint-suppressions.json`，只减不增。

## 只有这五类能活

1. 许可证与法律头。
2. 外部依赖、平台、厂商或协议强加、我们改不了的行为。写成 `// 外部：<约束>`，一行。自己代码里的意外不算，那是要修的代码。
3. `// prettier-ignore`。lint 抑制（`eslint-disable*`、`stylelint-disable*`、`@ts-expect-error`）只在规则本身有毛病、过于教条或只管风格时保留，并在 `--` 后写理由。
4. 定义公开 API 契约的文档注释。只有 `packages/protocol/src`（web 与 gateway 之间的线上契约）算公开 API，lint 在那里放行 `/** */`；只复述字段名的照样删。
5. 解释代码表达不了的约束的 issue 或 RFC 链接（`/issues/`、`/pull/`、RFC）。

`/// <reference …>`、shebang 和 `tokens.css` 里 `/* --- 分组 --- */` 这类分区标题是代码读取的数据，不算注释，不动。

其余全部删除。拿不准也删。

## 分类与处理

对每条不在五类里的注释，归一类再处理：

| 类别     | 判定                                                                                      | 处理                        |
| -------- | ----------------------------------------------------------------------------------------- | --------------------------- |
| 赘述     | 重复代码里已经看得到的内容：名字、类型、流程                                              | 删                          |
| 过时     | 提到已不存在的代码、旧实现、迁移前的状态                                                  | 删                          |
| 借口     | 给 hack、绕路、临时方案、已知缺陷开脱（「先这样」「暂时」「兜底」「避免某 bug」「TODO」） | 删，并开 issue 修掉那段实现 |
| 决策记录 | 记录重要且不显然的取舍：为什么选 A 不选 B、为什么有这个阈值、改了会坏什么                 | 删，内容搬进 ADR            |

决策记录门槛要高：读代码和测试能推出来的不算；一条注释只换个说法也不算。拿不准时按赘述删。

## ADR

写到 `docs/adr/<领域>-<短横线主题>.md`，一个决策一个文件，同领域的几条小决策可以合成一个文件分节写。格式：

```markdown
# <决策标题>

- 状态：已采纳
- 代码：`path/to/file.ts`（符号名）

## 背景

<问题与约束，两三句>

## 决定

<选了什么>

## 后果

<收益、代价、改动时要守的条件>
```

新增 ADR 后在 `docs/adr/README.md` 加一行索引。不写行号，写文件与符号名。

## 借口 issue

一段 hack 一个 issue。标题写要修的事，不写「删注释」。正文写：位置（文件与符号名）、原注释原文、现在的做法为什么是 hack、建议的修法。多行正文写临时文件，`gh issue create --title … --body-file <file>`。

## 步骤

1. 列出范围内被基线吞掉的注释：`node .agents/skills/delete-comment/list.mjs <目录或文件>`。
2. 逐文件读注释和它周围的代码，按上面分类处理。只删注释，不改代码；删后多出的空行交给格式化。
3. 证明只删了注释：`node .agents/skills/delete-comment/verify.mjs [基准 ref]`。出现 `CODE` 就是误改了代码，恢复那处；出现 `DIRECTIVE` 要确认是有意删掉的抑制。
4. `pnpm fix:touched`，再收紧基线：`pnpm exec eslint . --prune-suppressions`，`pnpm exec stylelint "**/*.{css,vue}" --suppress=pig/no-comments`。
5. `pnpm check:touched --no-e2e`（verify.mjs 已证明代码不变，所以不跑 e2e）。
6. 按领域原子提交：`refactor(<scope>): 删掉 <领域> 的注释`，ADR 随同一个提交。

新代码不加注释。想写注释时先改名字、拆函数或补测试；属于五类之一才写。
