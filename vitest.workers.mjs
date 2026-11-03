import { availableParallelism } from "node:os"

/**
 * 单测 worker 上限。`pnpm check` 里单测与 typecheck 同时跑，多给的 worker 只会
 * 和编译器抢核排队；给编译留出核数反而总时长不变、进程数减半。
 * 12 线程 → 4，32 线程 → 10，4 线程 → 2。
 */
export const maxWorkers = Math.max(2, Math.floor(availableParallelism() / 3))
