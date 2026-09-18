/** 脱离控制台的看门进程：父进程死后按端口杀掉残留 Vite。 */
import { spawnSync } from "node:child_process"
import { setTimeout as sleep } from "node:timers/promises"

const parentPid = Number(process.argv[2])
const port = Number(process.argv[3])

function alive(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false

  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function parsePids(stdout) {
  if (!stdout) return []
  const pids = new Set()

  for (const token of stdout.split(/[\s,]+/)) {
    const pid = Number(token)

    if (Number.isSafeInteger(pid) && pid > 0) pids.add(pid)
  }

  return [...pids]
}

function listeningPids(listenPort) {
  if (process.platform === "win32") {
    const netstat = spawnSync("netstat", ["-ano", "-p", "TCP"], {
      encoding: "utf8",
      windowsHide: true,
    })
    const pids = new Set()
    const lineRe = new RegExp(
      `[:\\[]${listenPort}(?:\\]|\\s).*(?:LISTENING|侦听)\\s+(\\d+)\\s*$`,
      "i",
    )

    for (const line of (netstat.stdout ?? "").split(/\r?\n/)) {
      const match = line.match(lineRe)
      const pid = Number(match?.[1])

      if (Number.isSafeInteger(pid) && pid > 0) pids.add(pid)
    }

    return [...pids]
  }

  const lsof = spawnSync("lsof", ["-nP", `-iTCP:${listenPort}`, "-sTCP:LISTEN", "-t"], {
    encoding: "utf8",
  })
  return parsePids(lsof.stdout)
}

function killPidTree(pid) {
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    })
    return
  }

  try {
    process.kill(pid, "SIGTERM")
  } catch {
    // 已退出
  }
}

if (
  !Number.isSafeInteger(parentPid) ||
  parentPid <= 0 ||
  !Number.isSafeInteger(port) ||
  port <= 0
) {
  process.exit(1)
}

while (alive(parentPid)) await sleep(50)

for (const pid of listeningPids(port)) {
  if (pid === process.pid || pid === parentPid) continue
  killPidTree(pid)
}

process.exit(0)
