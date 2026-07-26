# 06 — 调度多 Session Run

**What to build:** 同一 Session 的多个 Run 按 FIFO 串行，不同 Session 的 Run 在有界公平并发下运行；持续繁忙的 Session 不会饿死其他 Session，容量耗尽时用户获得明确拒绝。

**Blocked by:** 05 — 保证 Run 幂等与崩溃恢复

**Status:** ready-for-agent

- [ ] 每个 Session 同时最多一个 active Run，queued Run 严格按 FIFO 启动。
- [ ] 不同 Session 默认最多四个 active Run，并在繁忙 Session 间保持有界公平。
- [ ] 单 Session 队列上限为 32；达到队列或进程容量时返回稳定、可操作的问题代码。
- [ ] Execution Profile 与 prompt 在 admission 时冻结，排队期间的客户端变化不改变执行语义。
- [ ] 确定性测试覆盖 FIFO、公平性、并发上限、饥饿防护和容量拒绝。
