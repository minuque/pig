# Phase 1 Local Alpha acceptance trace

Gateway Phase 1 自动化证据集中在 `packages/gateway/test/phase-one-acceptance.test.ts`：

| 测试 | Gateway HTTP seam / 证据                                                                                         |
| ---- | ---------------------------------------------------------------------------------------------------------------- |
| 1    | 固定 `dbPath` 重启后的 Local Identity、canonical Workspace 去重与多 Workspace 持久化；revoke 后资源隔离          |
| 2    | `updatedAt + id` keyset cursor；删除 cursor 对象后继续翻页不重复；非法 cursor 返回 400；rename/delete 重启持久化 |
| 3    | 相同 Pi Session ID 在不同 Workspace 的 metadata、runtime path、Run queue/active 与 Transcript 隔离               |
| 4    | runtime capabilities、Execution Profile 校验与排队冻结；SQLite 仅保存 metadata，不保存消息                       |
| 5    | 同 Session FIFO、跨 Session 并行及 concurrency cap 容量释放                                                      |
| 6    | queued/active cancel、`cancelling` 中间态、终态和幂等副作用                                                      |
| 7    | Steer 仅允许精确 current running Run；queued/wrong/terminal 拒绝且不创建替代 Run                                 |

补充证据：

- `pi-runtime.test.ts`：真实临时目录验证 `startSession → SessionManager.list/open → readTranscript`；同 ID 跨 Workspace path/Transcript 隔离；deferred session factory 验证立即 cancel/steer 不丢失且 cancel 后不进入 prompt。
- `run-lifecycle.test.ts`：原子 transition 覆盖 terminal 赢得 cancel 读写竞态；不调用 runtime cancel。
- `packages/web/test/run-state.test.ts`、`session-state.test.ts`：SSE 按 Workspace + Session + Run 复合身份路由；未知 Run 在 50 条预响应 delta 后仍保留 terminal lifecycle event。
- `packages/web/test/api.test.ts`：deferred fetch 证明 SSE readiness 仅在 HTTP 200/body 可读后成立；客户端断流有限重连，并在重连后 reload Transcript、GET 刷新非终态 Run。
- `scripts/smoke-packed.mjs`：对真实 `packages/gateway/package.json` 执行 `pnpm pack`，断言 tgz 含 CLI/Web/bin 且无 `workspace:` range；复制 tgz、删除 staging/build 后在干净目录安装，并只通过安装后的 bin 验证 Ready、SPA 和静态 asset。

完整验收命令：`pnpm check:phase1`。
