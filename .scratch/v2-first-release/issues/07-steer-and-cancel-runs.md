# 07 — Steer 和取消 Run

**What to build:** 用户可向当前 running Run 发送 Steer，或取消 queued/active Run，并看到准确、持久且可恢复的终态；Steer 不会创建普通后续 Run。

**Blocked by:** 06 — 调度多 Session Run

**Status:** ready-for-agent

- [ ] Steer 只接受当前 running Run，忙时不会降级为 queued prompt 或新 Run。
- [ ] queued Run 可在不启动 Pi 执行的情况下取消并持久化终态。
- [ ] active Run 的取消等待 Pi settle 和 durable terminal transition 后才向用户确认终态。
- [ ] 重复 Steer/cancel 命令遵守 commandId 幂等语义。
- [ ] 错误 Session、错误 Run 状态和竞态请求返回稳定 Problem Details，且不破坏调度队列。
