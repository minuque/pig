#!/usr/bin/env node
import { spawn } from "child_process";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";
import { resolve } from "path";

import Gateway from "./index.js";

const webRoot = process.argv[2]
  ? resolve(process.argv[2])
  : fileURLToPath(new URL("../web/", import.meta.url));
const bootstrapSecret = process.env.BOOTSTRAP_SECRET ?? randomUUID();
const gateway = new Gateway({
  bootstrapSecret,
  dbPath: process.env.GATEWAY_DB_PATH ?? "gateway.sqlite",
  ...(webRoot ? { webRoot } : {}),
});
const port = await gateway.start();
const origin = `http://127.0.0.1:${port}`;
console.log(`Gateway listening on ${origin}`);

if (webRoot && process.env.NO_OPEN !== "1") {
  const url = `${origin}/#bootstrap=${encodeURIComponent(bootstrapSecret)}`;
  const command =
    process.platform === "win32" ? "cmd.exe" : process.platform === "darwin" ? "open" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  spawn(command, args, { detached: true, stdio: "ignore" }).unref();
}

async function stop() {
  await gateway.stop();
  process.exitCode = 0;
}

process.once("SIGINT", () => void stop());
process.once("SIGTERM", () => void stop());
