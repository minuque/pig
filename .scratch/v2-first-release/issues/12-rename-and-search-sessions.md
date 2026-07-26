# 12 — 重命名和搜索 Session

**What to build:** 用户可用任务语义重命名 Session，并在获授权 Workspace 内按活跃路径中的可见用户与助理文本搜索历史 Session，而不会索引敏感或不支持内容。

**Blocked by:** 03 — 创建和恢复 Session

**Status:** ready-for-agent

- [ ] Session rename 使用 revision 与统一 Mutation Result，陈旧 mutation 得到稳定冲突问题。
- [ ] 搜索索引只包含活跃路径上的可见 user/assistant 文本。
- [ ] thinking、工具参数、工具 payload、原始扩展 payload 和 unsupported 内容不进入 FTS。
- [ ] JSONL 新增、截断或替换后，Session Projection 与搜索结果可幂等更新或重建。
- [ ] 分页列表和搜索在大量 Session 下保持有界结果与稳定游标语义。
