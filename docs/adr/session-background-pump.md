# 后台会话空闲后一条一条泵出队列

- 状态：已采纳
- 代码：`apps/web/src/features/session/hooks/use-live-subscriptions.ts`（`subscribeLive` 的 idle 接管）

## 背景

后台池里的会话跑完一轮、快照回到 idle 时，要把待发队列里的一条提交出去。`GatewaySession.submit`
要等整轮结束才 resolve；这期间到达的 idle 快照会被 `idlePending` 丢掉，所以一次空闲快照只能对应一次泵队。

## 决定

每泵出一条就强制重拉一次历史，再判断队列是否为空或会话是否重新 running，直到接管者返回 `done`。
收尾只在「还在池里且彻底空闲」时做，重新 running 的会话留在池里等下一个 idle 快照。

## 后果

后台队列不会一次性全部提交，乐观用户句的锚点也对得上刚重拉的历史。代价是空闲周期里每条消息都要多拉一次历史。
改这段循环时不要改成「一次发完」，也不要在 `submit` 未落地时提前出池。
