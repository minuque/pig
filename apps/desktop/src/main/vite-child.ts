import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));

/** Electron 的 process.execPath 是 electron 本体，必须用 pnpm 注入的 Node。 */
export function nodeExecutable(env: NodeJS.ProcessEnv = process.env): string {
  const node = env.npm_node_execpath;
  if (!node) throw new Error("未找到 Node 可执行文件（缺少 npm_node_execpath）");
  return node;
}

export function pnpmExecutable(env: NodeJS.ProcessEnv = process.env): string {
  const pnpm = env.npm_execpath;
  if (!pnpm) throw new Error("未找到 pnpm 可执行文件（缺少 npm_execpath）");
  return pnpm;
}

export function spawnVite(env: { GATEWAY_TARGET: string }): ChildProcess {
  const node = nodeExecutable();
  const pnpm = pnpmExecutable();

  // 不传 BOOTSTRAP_SECRET：vite.config 有该变量时会 open 系统浏览器
  const childEnv: NodeJS.ProcessEnv = { ...process.env };
  childEnv.GATEWAY_TARGET = env.GATEWAY_TARGET;
  delete childEnv.BOOTSTRAP_SECRET;

  return spawn(node, [pnpm, "--filter", "@pig/web", "dev"], {
    cwd: REPO_ROOT,
    env: childEnv,
    stdio: "inherit",
    // 非 Windows 用独立进程组，便于整树终止
    detached: process.platform !== "win32",
  });
}

/** Windows 上 child.kill() 只杀直接子进程，pnpm 下的 vite 会变孤儿，必须杀整棵树。 */
export function killVite(child: ChildProcess): void {
  const pid = child.pid;
  if (pid === undefined) return;
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    // 已退出
  }
}

export async function waitForHttp(url: string, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      await fetch(url);
      return;
    } catch {
      // 尚未监听
    }
    if (Date.now() >= deadline) throw new Error("Vite 开发服务未就绪");
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}
