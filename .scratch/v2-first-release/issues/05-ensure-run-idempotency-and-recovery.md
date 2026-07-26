# 05 — 保证 Run 幂等与崩溃恢复

**What to build:** 网络重试不会重复执行 Run；Gateway 无法证明完成或取消的 Run 在恢复时成为 Interrupted Run，绝不自动重放，用户可显式创建具有新身份的重试 Run。

**Blocked by:** 04 — 完成首个流式 Run

**Status:** ready-for-agent

- [ ] 同一 Principal、commandId 与等价 payload 的重复提交返回原结果，不创建第二个 Run。
- [ ] 同一 commandId 配不同 payload 时返回稳定冲突问题。
- [ ] Gateway 重启时将所有无法证明终止结果的非终态 Run 持久化为 Interrupted Run。
- [ ] Interrupted Run 不自动 replay；显式重试创建新的 Run ID，并保留原 Run 的可审计终态。
- [ ] 晚到事件不能复活或改写任何终态 Run。
