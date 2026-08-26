---
status: accepted
---

# Transcript 按 Turn 折叠思考和 Tool Call

历史 Turn 只稳定露出 User Message 和助手正文。思考与 Tool Call 是该 Turn 的工作，默认收在一条折叠里。不引入 Activity，不改 Pi 协议。

进行中没有折叠条。思考不画在助手句上：已有 Tool Call 时画在同一组上方，还没有时用思考占位。助手句只在有正文时出现。只有思考、没有正文的助手句不占时间线行。

连续 Tool Call 占一条虚拟行。点开历史折叠后直接看到各卡，不再先点摘要。running 的卡默认展开；完成回到按 id 记下的展开态；失败仍展开。展开态只活在当前 Session 内存，虚拟卸载保留，切 Session 清空。

折叠条有可信时长则写「工作了 Ns」，否则「N 次工具调用」。Abort 的 Turn 用「已停止」。条目没有 turn_id，用相邻 User Message 近似 Turn；Steering 未接前这条近似成立。窗口顶部没有 User Message 的残段不折叠。

第一刀：Tool Call 标题按 toolName 与入参写成时态人话，展开态按 TranscriptItem id 保存。第二刀：Turn 工作折叠，连续 Tool Call 一组一行。

## Considered options

- 引入 Waku 的 messages + transcript_blocks / ActivityItem。pig 已有独立 Tool Call 条目，多一层存储没有收益。
- 把最后一条正文前的助手句整段藏进折叠。正文属于 Assistant Message，藏半条会打乱行 id 和测高。
- 思考继续挂在助手句上，Turn 结束再搬进折叠。和「思考是工作」不一致，还会闪一次。
- 摘要头一行、每个 Tool Call 仍各占一行。展开会插入虚拟行，和 ADR 0002 的离散测高冲突。
- 折叠里的组默认仍是摘要。历史已经隔了一层，两次点击才能看输出。

## Consequences

测量、外边距、思考高度动画仍按 ADR 0002，不在本决策里重开。不投影 `tool_execution_update`，不做 Steering、权限、rewind。
