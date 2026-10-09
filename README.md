<p align="center">
  <img src="apps/web/public/logo.png" width="160" alt="pig" />
</p>

# pig

<p align="center">
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-%E2%89%A522.19-green" />
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-blue" /></a>
</p>

**[English](README.en.md)** · 简体中文

> 遵循 Pi 设计哲学，不额外内置工具，完全通过 Extension API 扩展的 **Pi Agent GUI**。

## 环境要求

- Node.js >= 22.19
- pnpm 11.5
- 已在 Pi 中配置好模型与认证：pig 复用 `~/.pi` 的模型配置，会话写到 `~/.pi/agent/sessions/<cwd>/`，与 Pi CLI 共用

## 快速开始

```bash
pnpm install
pnpm dev:web        # 启动 Gateway 与 Web，用浏览器打开终端打印的 http://127.0.0.1:5173
pnpm dev:desktop    # Electron 桌面开发
```

## 配置

| 环境变量          | 默认    | 说明                                       |
| ----------------- | ------- | ------------------------------------------ |
| `PORT`            | `8787`  | Gateway 端口                               |
| `OPEN`            | 关      | 设为 `1` 时启动后打开浏览器，等价 `--open` |
| `PIG_SESSION_DIR` | Pi 默认 | 会话目录                                   |
| `PIG_CWD`         | 无      | 初始工作目录                               |

## 本地安全

Gateway 只绑 `127.0.0.1`。浏览器用一次性启动凭证换成 cookie 通行证，之后的 HTTP 与 WebSocket 都要带上它。会话目录只在用户选过之后才进入白名单，记录在 `~/.pig/authorized-workspaces.json`。

## 文档

- [`DESIGN.md`](DESIGN.md) — 设计系统与视觉规范
- [`ROADMAP.md`](ROADMAP.md) — 架构路线与边界原则
- [`docs/JOURNEYS.md`](docs/JOURNEYS.md) — 核心用户旅程
- [`docs/directory-structure.md`](docs/directory-structure.md) — 目录与模块规范

## 开发

- `pnpm check:touched` — 检查本次改过的文件
- `pnpm check` — 全量检查
- `pnpm test` / `pnpm test:e2e` — 模块单测 / 浏览器旅程
- `pnpm dev:debug` — 与 `dev:web` 相同，附带 9229 inspector
- 提交与协作规则见 [`AGENTS.md`](AGENTS.md)

## 许可证

[MIT](LICENSE)
