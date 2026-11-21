import { availableParallelism } from "node:os"

export const maxWorkers = Math.max(2, Math.floor(availableParallelism() / 3))
