# 14 — 隔离异常 Session 源

**What to build:** Gateway 对 dirty tail、截断、替换、损坏 JSONL、身份冲突和未来 Pi 内容给出明确且安全的 Session 状态；Unavailable Session 拒绝写入，Quarantined Session 只允许安全诊断与删除。

**Blocked by:** 03 — 创建和恢复 Session；12 — 重命名和搜索 Session

**Status:** ready-for-agent

- [ ] Session Projection 以 Pi Session ID/entry ID 幂等摄取，并以安全摘要检测身份冲突。
- [ ] append、partial final line、truncate、replace、delete、invalid JSONL 与 future/unsupported entry 均产生规定的恢复或健康状态。
- [ ] Unavailable Session 可展示最后验证的只读摘要，但拒绝新 Run 和 mutation。
- [ ] Quarantined Session 不自动跳过、修补或改写历史，仅开放安全诊断与删除。
- [ ] parser/schema 变化通过 shadow generation 重建、验证和原子切换，重建期间继续提供上一有效 generation。
