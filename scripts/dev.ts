import { randomUUID } from "crypto";
import { spawn } from "child_process";

import Gateway from "../packages/gateway/src/index.js";

const bootstrapSecret = randomUUID();
const gateway = new Gateway({ bootstrapSecret });
const port = await gateway.start();
const pnpm = process.env.npm_execpath;
if (!pnpm) throw new Error("pnpm executable not found");
const web = spawn(process.execPath, [pnpm, "--filter", "@no-pi-no-gang/web", "dev"], {
  env: {
    ...process.env,
    GATEWAY_TARGET: `http://127.0.0.1:${port}`,
    BOOTSTRAP_SECRET: bootstrapSecret,
  },
  stdio: "inherit",
});

let stopping = false;
async function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  web.kill();
  await gateway.stop();
  process.exitCode = exitCode;
}

web.once("error", () => void stop(1));
web.once("exit", (code) => void stop(code ?? 0));
process.once("SIGINT", () => void stop());
process.once("SIGTERM", () => void stop());
