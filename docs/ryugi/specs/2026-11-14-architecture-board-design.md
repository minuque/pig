# 架构看板

替代手写的 `docs/show-me-architecture.html`：一个脚本从代码生成单文件静态 HTML，纵览架构、模块关系、文件依赖、数据流与接口。受众是维护者本人，用来纵览与决策。

## 事实来源

- 模块关系、文件依赖：扫 `apps/*/src`、`packages/*/src` 的 `.ts` / `.mjs` / `.vue`（取 `<script>` 块），用已装的 TypeScript 解析 import。解析 web 的路径别名（`@/`、`@features/` 等，照 `apps/web/tsconfig.json` 的 paths）、相对路径、`.js` 后缀指向 `.ts`、`@pig/<pkg>` 指向该包 `src/index.ts`。只收仓库内的边，第三方包不画。
- 接口：HTTP 端点从 `packages/gateway/src/server/*.ts` 的路径字面量与正则字面量里取，配上同一判断里的 `req.method`；调用方是 web 里引用该路径的文件。WebSocket 的命令与事件从 `packages/protocol/src/wire.ts` 的 `Command`、`ServerEvent` 联合类型里取。
- 数据流：手写在 `docs/architecture/flows.ts`。每步写 `from`、`to`、说明，可选 `ref: "路径#导出名"`。生成时与 `pnpm check` 都校验 ref：文件不存在或没有该导出就失败。

## 形态

- `pnpm arch`：运行 `scripts/arch/`，写出 `docs/architecture/dist/index.html`（git 忽略）并用浏览器打开。
- 单文件：内联数据 JSON、pele（Mermaid 渲染，已是 web 依赖）、panzoom（缩放平移，已是 web 依赖）、`tokens.css` 与 `mermaid.css`。跟随系统深浅色。
- 四个页签：
  - 总览：包级图，加外部系统（Pi、模型服务、磁盘）。
  - 依赖：可下钻，包 → 目录（feature）→ 文件，面包屑返回；文件级列出入边和出边。
  - 数据流：每条流一张 sequence 图，步骤能跳到依赖页对应的节点。
  - 接口：HTTP 表与 WS 命令/事件表，标出处理文件与调用方。
- 只展示依赖，不标违反边界规则的边。

## 旧文档

把旧文档「关键数据流」对照当前代码核过后迁进 `flows.ts`，然后删除 `docs/show-me-architecture.html`，并更新 `docs/directory-structure.md` 的说明。
