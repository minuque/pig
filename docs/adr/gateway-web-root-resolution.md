# web 产物的解析顺序

- 状态：已采纳
- 代码：`packages/gateway/src/cli.ts`（`resolveWebRoot`）

## 背景

gateway 既要能直接跑开发构建的 web 产物，也要能跑打包后的产物。打包脚本 `scripts/build-package.mjs` 会把 `apps/web/dist` 复制到 `packages/gateway/web`。

## 决定

解析顺序固定为：命令行显式参数 → 仓库里的 `apps/web/dist` → 相对的 `../web`。

## 后果

仓库里存在 `apps/web/dist` 时永远用它，开发时新构建不会被打包产物遮住。改动顺序或增删候选目录会让开发环境读到旧的 `packages/gateway/web`，表现为页面改动不生效；发布产物只有在 `apps/web/dist` 不存在时才被选中。
