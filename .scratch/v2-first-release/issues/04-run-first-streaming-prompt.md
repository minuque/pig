# 04 — 完成首个流式 Run

**What to build:** 用户在 Session 中提交 prompt 后获得独立 Run，并通过一个 Gateway 级 SSE 连接持续看到 queued、thinking、streaming、tool 与终态更新；刷新页面后可从 Pi JSONL 读取 durable Transcript。

**Blocked by:** 03 — 创建和恢复 Session

**Status:** ready-for-agent

- [ ] 普通 prompt 创建有稳定标识的 Run，并返回统一 Mutation Result。
- [ ] Run 经 queued、starting、running 到不可变终态；只有 Pi settled 且 durable terminal transition 提交后才显示完成。
- [ ] 一个 Gateway 级 SSE 连接可传递当前 Session 的 Run 与 Transcript 更新，事件包含 gateway epoch/sequence 和 Run 内 sequence。
- [ ] 刷新后通过公开资源重新取得 Transcript，且客户端不依赖原始 Pi 对象。
- [ ] 公共 REST/SSE 契约使用版本化 schema、稳定 Problem Details 和浏览器安全的封闭类型。
