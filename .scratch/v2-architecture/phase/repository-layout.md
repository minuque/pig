# v2 仓库目录结构

Status: proposed

本文记录 Phase 0 开始采用、后续阶段延续的仓库目录与依赖边界。目标架构仍以 [`../spec.md`](../spec.md) 为准；目录按能力实际落地，不要求 Phase 0 一次性创建全部内部目录。

## 完整目录

```text
no-pi-no-gang-v2/
├─ packages/
│  ├─ contracts/                 # browser-safe 公共契约
│  │  ├─ src/
│  │  │  ├─ resources/           # Workspace、Session、Run DTO
│  │  │  ├─ commands/            # mutation 与 commandId schema
│  │  │  ├─ events/              # Gateway SSE 事件信封
│  │  │  ├─ errors/              # 稳定问题代码与错误响应
│  │  │  ├─ schemas/             # 运行时校验 schema
│  │  │  └─ index.ts
│  │  ├─ test/
│  │  ├─ package.json
│  │  └─ tsconfig.json
│  │
│  ├─ gateway/                   # 本地 Node Agent Gateway
│  │  ├─ src/
│  │  │  ├─ cli/                 # 启动、随机端口、浏览器 bootstrap
│  │  │  ├─ server/
│  │  │  │  ├─ routes/           # /api/v1 REST
│  │  │  │  ├─ sse/              # 单 Gateway SSE
│  │  │  │  └─ middleware/       # authority、credential、CSRF
│  │  │  ├─ application/
│  │  │  │  ├─ workspace/        # 注册、授权、canonical path
│  │  │  │  ├─ session/          # 创建、读取、恢复
│  │  │  │  └─ run/              # Prompt、Steer、Cancel
│  │  │  ├─ coordination/
│  │  │  │  ├─ run-coordinator.ts
│  │  │  │  └─ session-queue.ts  # 同 Session FIFO
│  │  │  ├─ ports/               # 正式架构边界
│  │  │  │  ├─ pi-runtime.ts
│  │  │  │  ├─ workspace-repository.ts
│  │  │  │  ├─ run-repository.ts
│  │  │  │  └─ session-index.ts
│  │  │  ├─ adapters/
│  │  │  │  ├─ pi/               # 唯一允许调用 Pi SDK 的位置
│  │  │  │  ├─ sqlite/
│  │  │  │  └─ filesystem/
│  │  │  ├─ bootstrap/           # 依赖组装、迁移、锁、关闭
│  │  │  └─ index.ts
│  │  ├─ migrations/
│  │  ├─ test/
│  │  ├─ package.json
│  │  └─ tsconfig.json
│  │
│  ├─ web/                       # Vue SPA
│  │  ├─ src/
│  │  │  ├─ api/                 # REST/SSE client，只使用 contracts
│  │  │  ├─ features/
│  │  │  │  ├─ workspaces/
│  │  │  │  ├─ sessions/
│  │  │  │  └─ runs/
│  │  │  ├─ stores/
│  │  │  ├─ components/
│  │  │  ├─ views/
│  │  │  ├─ router/
│  │  │  └─ main.ts
│  │  ├─ test/
│  │  ├─ public/
│  │  ├─ index.html
│  │  ├─ package.json
│  │  └─ tsconfig.json
│  │
│  └─ testkit/                   # 测试专用，不得被生产代码依赖
│     ├─ src/
│     │  ├─ fixtures/
│     │  ├─ fakes/               # Fake Pi Runtime、Repository
│     │  └─ harness/             # Gateway/Web 测试启动器
│     ├─ test/
│     │  ├─ acceptance/
│     │  └─ e2e/
│     ├─ package.json
│     └─ tsconfig.json
│
├─ scripts/
│  └─ smoke/                     # packed artifact 等发布验证
├─ .scratch/
│  └─ v2-architecture/           # 规格、阶段文档、架构图
├─ package.json                  # npm workspaces 与统一命令
├─ package-lock.json
├─ tsconfig.base.json
├─ eslint.config.js
├─ CONTEXT.md
└─ DESIGN.md
```

## 依赖方向

```text
web ──────────→ contracts
gateway ──────→ contracts
gateway ──────→ pinned Pi SDK
testkit ──────→ contracts / gateway / web（仅测试）
contracts ────→ 不依赖 Vue、DOM、Node、Pi SDK
```

禁止：

```text
web       → gateway 内部代码
web       → Pi SDK / Pi 对象
contracts → web / gateway / testkit
gateway   → testkit
生产代码   → testkit
```

## 运行时目录

运行时数据不属于仓库代码目录，且三类数据彼此独立：

```text
Application Data Root/
├─ instance lock
├─ application.sqlite
├─ upgrade backups/
└─ sanitized logs/

Pi Agent Root/                    # Pi 管理模型和认证配置

Authorized Workspace/            # 用户显式授权的项目目录
└─ Pi Session JSONL              # Pi 管理；Session 唯一事实源
```

Gateway 不创建 `messages/`、`transcripts/` 或 SQLite 消息表。

## Phase 0 落地规则

根 `package.json` 声明：

```json
{
  "workspaces": ["packages/*"]
}
```

Phase 0 先建立 `contracts`、`gateway`、`web`、`testkit` 四个 workspace。内部目录只在对应能力开始实现时创建，避免一次性生成空架构；但 Pi Adapter、Repository、契约和授权边界不得以临时结构替代。
