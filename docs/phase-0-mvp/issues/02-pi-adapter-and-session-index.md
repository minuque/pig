# 02 — Pi Runtime Adapter 与 Session Index

**阶段：** Phase 0  
**父级场景：** AS-7（基础能力）  
**前置阻塞：** 00  
**状态：** 满足

## 交付范围

集中封装固定版本 Pi Runtime，基于授权 Workspace 范围内的 Pi JSONL 建立可重建的 Session Index，并保留 Pi JSONL 的唯一事实源地位。

## 验收标准

- [x] 已建立集中的 `PiRuntimeAdapter` 边界；现有 Gateway Session Route 通过该接口访问，客户端不导入或操作 Pi SDK/Pi 对象。
- [x] Pi Runtime Adapter 实际调用项目依赖中固定版本的 Pi Runtime，而不是本地字符串或存根。
- [x] Session Index 从 Pi JSONL 发现 Session，产生跨 Gateway 重启稳定的 `sessionId`，并按 canonical Workspace 范围过滤。
- [x] 缺失或不可解析的 JSONL 不会生成伪造的持久 Session 身份；错误通过稳定问题类型返回。
- [x] Gateway 重启后重新扫描相同数据可得到相同的 Session 列表基础数据。
- [x] Pi JSONL 保持 Session、Transcript 和工具结果的唯一事实源；Index 不复制会话内容形成第二事实源。

## 不在本票

Session REST 资源、Session 搜索/分页/重命名/删除、Unavailable Session、索引重建算法、跨版本恢复。
