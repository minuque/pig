# 07 — 收敛 Transcript 滚动状态所有权

**What to build:** Transcript 继续支持逐 Session 恢复滚动位置、自动跟随和“跳转到最新”提示，但展示组件不再直接修改传入对象；滚动状态通过显式类型化契约回传给唯一状态所有者。

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [x] Transcript 不再直接修改 prop 内部字段
- [x] 滚动位置、following 和新活动状态只有一个明确所有者
- [x] 切换 Session 后滚动位置正确恢复
- [x] 用户离开底部时出现新活动提示，回到底部后提示消失
- [x] typecheck 通过，vitest 全绿，浏览器验收无回归
