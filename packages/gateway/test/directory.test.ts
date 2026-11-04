import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"

import { canonicalizePath, WindowsDirectoryPort, type DirectoryExecFile } from "../src/directory.js"

describe("canonicalizePath", () => {
  it("把盘符改成小写、反斜杠改成斜杠，并去掉末尾斜杠", () => {
    if (process.platform === "win32") {
      expect(canonicalizePath("C:\\Projects\\Demo\\")).toBe("c:/projects/demo")
      return
    }

    expect(canonicalizePath("/Projects/Demo/")).toBe("/Projects/Demo")
  })

  it("根路径保留尾斜杠", () => {
    if (process.platform === "win32") {
      expect(canonicalizePath("C:\\")).toBe("c:/")
      return
    }

    expect(canonicalizePath("/")).toBe("/")
  })

  it("解析相对段后再规范化", () => {
    if (process.platform === "win32") {
      expect(canonicalizePath("C:\\Projects\\Demo\\..\\App")).toBe("c:/projects/app")
      return
    }

    expect(canonicalizePath("/Projects/Demo/../App")).toBe("/Projects/App")
  })
})

describe("WindowsDirectoryPort", () => {
  let tempRoot: string | undefined
  afterEach(async () => {
    if (tempRoot) await rm(tempRoot, { recursive: true, force: true })
    tempRoot = undefined
  })

  it("pwsh 不存在时回退到 powershell.exe", async () => {
    tempRoot = await mkdtemp(join(tmpdir(), "pig-dir-"))
    const expected = canonicalizePath(await realpath(tempRoot))
    const tried: string[] = []
    const exec: DirectoryExecFile = async (file) => {
      tried.push(file)

      if (file === "pwsh") {
        const error = new Error("not found") as NodeJS.ErrnoException
        error.code = "ENOENT"
        throw error
      }

      return { stdout: JSON.stringify(tempRoot) }
    }
    const port = new WindowsDirectoryPort(exec)
    expect(await port.selectDirectory()).toBe(expected)
    expect(tried).toEqual(["pwsh", "powershell.exe"])
  })
})
