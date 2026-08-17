import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  canonicalizePath,
  ManualDirectoryPort,
  WindowsDirectoryPort,
  type DirectoryExecFile,
} from "../src/directory.js";

describe("canonicalizePath", () => {
  it("把盘符改成小写、反斜杠改成斜杠，并去掉末尾斜杠", () => {
    if (process.platform === "win32") {
      expect(canonicalizePath("C:\\Projects\\Demo\\")).toBe("c:/Projects/Demo");
      return;
    }
    expect(canonicalizePath("/Projects/Demo/")).toBe("/Projects/Demo");
  });

  it("解析相对段后再规范化", () => {
    if (process.platform === "win32") {
      expect(canonicalizePath("C:\\Projects\\Demo\\..\\App")).toBe("c:/Projects/App");
      return;
    }
    expect(canonicalizePath("/Projects/Demo/../App")).toBe("/Projects/App");
  });
});

describe("ManualDirectoryPort", () => {
  it("要求手动输入且不弹窗", async () => {
    const port = new ManualDirectoryPort();
    expect(port.requiresManualInput).toBe(true);
    expect(await port.selectDirectory()).toBeUndefined();
  });
});

describe("WindowsDirectoryPort", () => {
  let tempRoot: string | undefined;
  afterEach(async () => {
    if (tempRoot) await rm(tempRoot, { recursive: true, force: true });
    tempRoot = undefined;
  });

  it("stdout 为空视为取消", async () => {
    const port = new WindowsDirectoryPort(async () => ({ stdout: "  \n" }));
    expect(await port.selectDirectory()).toBeUndefined();
  });

  it("解析 JSON 路径并做 realpath 规范化", async () => {
    tempRoot = await mkdtemp(join(tmpdir(), "pig-dir-"));
    const selected = join(tempRoot, "workspace");
    await mkdir(selected);
    const expected = canonicalizePath(await realpath(selected));
    const port = new WindowsDirectoryPort(async () => ({ stdout: JSON.stringify(selected) }));
    expect(await port.selectDirectory()).toBe(expected);
  });

  it("pwsh 不存在时回退到 powershell.exe", async () => {
    tempRoot = await mkdtemp(join(tmpdir(), "pig-dir-"));
    const expected = canonicalizePath(await realpath(tempRoot));
    const tried: string[] = [];
    const exec: DirectoryExecFile = async (file) => {
      tried.push(file);
      if (file === "pwsh") {
        const error = new Error("not found") as NodeJS.ErrnoException;
        error.code = "ENOENT";
        throw error;
      }
      return { stdout: JSON.stringify(tempRoot) };
    };
    const port = new WindowsDirectoryPort(exec);
    expect(await port.selectDirectory()).toBe(expected);
    expect(tried).toEqual(["pwsh", "powershell.exe"]);
  });

  it("非法 JSON 路径直接失败，不回退", async () => {
    const tried: string[] = [];
    const port = new WindowsDirectoryPort(async (file) => {
      tried.push(file);
      return { stdout: "null" };
    });
    await expect(port.selectDirectory()).rejects.toThrow("invalid folder path");
    expect(tried).toEqual(["pwsh"]);
  });
});
