# 分离 Workspace 展开与激活

Workspace 导航允许同时展开多个 Workspace，但展开仅用于浏览，不改变 Active Workspace；只有选择 Session 才激活其所属 Workspace。各 Workspace 的 Session 在首次展开时懒加载并缓存至页面刷新，以避免启动时预加载全部数据，同时保持跨 Workspace 浏览稳定。

## Status

accepted
