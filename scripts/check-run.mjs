import { spawn } from "node:child_process"

import { pnpmCommand } from "./pnpm-command.mjs"

function spawnPnpm(args, cwd, env) {
  const { command, args: runArgs, options } = pnpmCommand(args)
  return spawn(command, runArgs, { cwd, windowsHide: true, ...options, env })
}

/** 按命令行长度上限把文件拆成多条子命令，避开 Windows 的 8191 字符限制。 */
export function splitCommandArgs(prefix, files, maxChars) {
  const base = prefix.join(" ").length + 1
  const chunks = []
  let current = []
  let size = base

  for (const file of files) {
    const added = file.length + 1

    if (current.length && size + added > maxChars) {
      chunks.push([...prefix, ...current])
      current = []
      size = base
    }

    current.push(file)
    size += added
  }

  if (current.length) chunks.push([...prefix, ...current])
  return chunks
}

export function runPnpm(args, cwd) {
  return new Promise((resolveRun) => {
    const started = Date.now()
    const env = { ...process.env, FORCE_COLOR: "0" }
    const child = spawnPnpm(args, cwd, env)
    let out = ""

    child.stdout.on("data", (chunk) => {
      out += chunk
    })
    child.stderr.on("data", (chunk) => {
      out += chunk
    })
    child.on("error", (error) => {
      resolveRun({
        code: 1,
        out: `${out}${error.message}\n`,
        ms: Date.now() - started,
      })
    })
    child.on("close", (code) => {
      resolveRun({ code: code ?? 1, out, ms: Date.now() - started })
    })
  })
}

export function reportResults(title, results) {
  const failed = []

  for (const result of results) {
    const status = result.code === 0 ? "ok" : "FAIL"
    const sec = (result.ms / 1000).toFixed(1)
    console.log(`\n=== ${result.name} (${sec}s, ${status}) ===`)
    const body = result.out.trimEnd()

    if (body) console.log(body)

    if (result.code !== 0) failed.push(result.name)
  }

  console.log("")

  if (failed.length) {
    console.error(`${title} failed: ${failed.join(", ")}`)
    process.exitCode = 1
    return
  }

  console.log(`${title} passed`)
}
