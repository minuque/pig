# 02 — 可管理的 Session 列表

**What to build:** 用户可以在已授权 Workspace 中分页浏览、重命名和安全删除 Session；结果跨 Gateway 重启保持，Session 列表仍以 Pi 原生 Session 为事实来源。

**Blocked by:** 01 — 持久化多 Workspace Access

**Status:** ready-for-agent

- [ ] Session 列表提供确定性分页，翻页期间不重复或遗漏当前索引中的 Session。
- [ ] 用户可以重命名 Session，刷新和 Gateway 重启后仍显示新名称。
- [ ] 删除操作明确展示影响范围并要求确认；取消确认不会修改 Session。
- [ ] 删除完成后 Session 不再可打开或接收新 Run，重复删除得到稳定结果。
- [ ] SQLite 只保存必要且可重建的 Session 列表索引，不复制 Pi JSONL 中的会话记录。
- [ ] 所有列表和 mutation 均受 Workspace Access 约束，不泄漏其他 Workspace 的 Session。
