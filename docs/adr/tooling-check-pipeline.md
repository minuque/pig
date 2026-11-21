# pnpm check 的单测 worker 上限

- 状态：已采纳
- 代码：`vitest.workers.mjs`（`maxWorkers`）

## 背景

`pnpm check` 里单测与 `typecheck` 同时跑，机器上还有多个包的 `tsc` 与 ESLint。单测 worker 按核数全开会和编译器抢核排队。

## 决定

单测 worker 取 `max(2, floor(cpu / 3))`：12 线程给 4，32 线程给 10，4 线程给 2。给编译留出核数后总时长不变，进程数减半。

## 后果

- 单测不是 CPU 瓶颈，加 worker 不会更快，只会让同批 typecheck 变慢。
- 改这个比值要连着 `pnpm check` 的总时长一起量。
