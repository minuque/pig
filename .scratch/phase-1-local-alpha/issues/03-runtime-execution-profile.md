# 03 — Pi Runtime Execution Profile

**What to build:** 用户可以选择 Pi Runtime 当前实际可用的模型和 thinking level；每个 Run 在 admission 时冻结自己的 Execution Profile，排队或运行期间不受后续界面选择影响。

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] 模型和 thinking level 选项来自 Pi Runtime 的实际能力，不展示不可用的静态占位项。
- [ ] 不合法或已不可用的组合在 admission 时被拒绝，并返回稳定、可操作的错误。
- [ ] Run 被接受后记录冻结的 Execution Profile，并在 Run 状态和详情中可见。
- [ ] 用户修改后续默认选择时，已经 accepted、queued 或 running 的 Run 保持原 Execution Profile。
- [ ] 自动化验证覆盖 admission 前后修改选择的竞态。
