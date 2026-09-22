#!/usr/bin/env node
import { spawn } from "child_process"
import { fileURLToPath } from "url"
import { resolve } from "path"

import Gateway from "./index.js"

const argv = process.argv.slice(2)
const openBrowser = argv.includes("--open") || process.env.OPEN === "1"
const webRootArg = argv.find((arg) => !arg.startsWith("-"))
const webRoot = webRootArg
  ? resolve(webRootArg)
  : fileURLToPath(new URL("../web/", import.meta.url))
const requested = Number.parseInt(process.env.PORT ?? "8787", 10)
const listenPort = Number.isInteger(requested) && requested > 0 ? requested : 8787
const gateway = new Gateway({
  webRoot,
  port: listenPort,
  ...(process.env.PIG_SESSION_DIR ? { sessionDir: resolve(process.env.PIG_SESSION_DIR) } : {}),
  ...(process.env.PIG_CWD ? { cwd: resolve(process.env.PIG_CWD) } : {}),
})
const port = await gateway.start()
const entry = gateway.authenticatedUrl(`http://127.0.0.1:${port}`)

console.log(`Gateway listening on ${entry}`)

if (openBrowser) {
  const command =
    process.platform === "win32" ? "cmd.exe" : process.platform === "darwin" ? "open" : "xdg-open"
  const args = process.platform === "win32" ? ["/c", "start", "", entry] : [entry]
  spawn(command, args, { detached: true, stdio: "ignore" }).unref()
}

async function stop() {
  await gateway.stop()
  process.exitCode = 0
}

process.once("SIGINT", () => void stop())

process.once("SIGTERM", () => void stop())
