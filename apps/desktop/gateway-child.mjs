import { register } from "tsx/esm/api"

register()

await import("./src/main/gateway-child.ts")
