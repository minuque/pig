# 07 — 隔离 Session 客户端状态

**What to build:** 用户在多个 Session 间切换时，每个 Session 独立保留草稿、滚动位置、实时活动和 Run 状态；阅读历史不会被新内容强制拉到底部。

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] 每个 Session 的未发送草稿独立保存，切换后不会覆盖或串到其他 Session。
- [ ] 实时增量和 Run 事件始终按稳定 Session ID 与 Run ID 更新对应视图。
- [ ] 每个 Session 独立保存滚动位置，返回时恢复到合理位置。
- [ ] 用户位于底部时新内容可以跟随；用户阅读历史时保持位置并显示“跳转到最新”。
- [ ] 切换 Session 不会丢失后台 Session 的实时状态，返回后可继续查看。
- [ ] 自动化验证覆盖快速切换和交错事件，不依赖事件到达顺序侥幸正确。
