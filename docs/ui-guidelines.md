# UI Guidelines

## 1. UI 依赖

Vue 3 + TypeScript + Vite + Tailwind CSS + shadcn-vue + lucide-vue-next + VueUse + markstream-vue + vue-router。

- Vue 负责 UI state 与组件接线。
- `@earendil-works/pi-client` 的 `RemoteSession` 是 Session 操作入口。
- markstream-vue 渲染 transcript 内容。
- WebSocket、bootstrap、目录选择属于 platform concern，不进入 Agent Domain。

## 2. 信息架构

工作台有两个区域：

1. 左栏：已授权 Workspace，以及按 cwd 分组的其它 Pi Session。
2. 中央：当前 Session 的 Transcript、phase、Prompt、Steer 与 Abort 操作。

Session 切换由 `/sessions/:sessionId` 路由驱动。撤销 Workspace 只修改本地授权偏好，不删除 Pi Session。

## 3. 核心旅程

```text
授权 Workspace
  → 选择或创建 Session
  → 查看 Transcript
  → 发送 Prompt
  → 根据 phase 查看实时进度
  → 运行中 Steer 或 Abort
  → phase 回到 idle
```

## 4. 当前产品契约

- **布局**：两栏；桌面左栏可折叠，移动端左栏为抽屉。
- **Transcript**：用户消息使用 surface 卡片；Agent 消息通栏；思考与工具活动默认折叠。
- **模型**：Session 为 `idle` 时可修改；运行中禁用 ModelPicker 与 ThinkingLevelSelect。
- **Session 列表**：Pi 拥有 Session 真相。已授权目录优先显示，其它 Session 继续按 cwd 显示。
- **Gateway 状态**：正常时不显示常驻指示；错误使用 banner。
- **启动授权**：启动链接携带一次性 bootstrap secret；兑换成功后清除 URL hash。

## 5. Upstream gaps

- Session 重命名、删除、消息重跑与虚拟滚动未实现。官方协议具备稳定契约后再接入，不建立第二套状态。
