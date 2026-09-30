import { mkdir, mkdtemp, readdir, readFile, rm, utimes, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, sep } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  ATTACHMENT_TTL_MS,
  AttachmentError,
  AttachmentStore,
  CONSUMED_FILE_TTL_MS,
  MAX_BATCH_ITEMS,
  MAX_IMAGE_BYTES,
  MAX_PENDING_ITEMS,
  composePrompt,
  sanitizeFileName,
  sanitizeMimeType,
  type StagedAttachment,
  type StagedFile,
} from "../src/pi/attachments.js"

const PNG = { name: "截图.png", mimeType: "image/png" }
const PDF = { name: "报告 v2.pdf", mimeType: "application/pdf" }
const SVG = { name: "矢量图.svg", mimeType: "image/svg+xml" }
const SESSION = "sess-1"
const stores: AttachmentStore[] = []
const roots: string[] = []
let rootDir = ""

/** 每个用例一份隔离的临时根目录，避免跨用例/跨次运行互相干扰。 */
async function makeStore(): Promise<AttachmentStore> {
  rootDir = await mkdtemp(join(tmpdir(), "pig-attach-test-"))
  roots.push(rootDir)
  const store = new AttachmentStore({ sweepIntervalMs: 0, rootDir })
  stores.push(store)
  return store
}

afterEach(async () => {
  await Promise.all(stores.map((store) => store.dispose()))
  stores.length = 0
  await Promise.all(roots.map((dir) => rm(dir, { recursive: true, force: true })))
  roots.length = 0
})

/** 切成多段喂给 stage，模拟真实的分块上传。 */
async function* chunks(bytes: Uint8Array, parts = 2): AsyncIterable<Uint8Array> {
  const step = Math.max(1, Math.ceil(bytes.length / parts))

  for (let offset = 0; offset < bytes.length; offset += step)
    yield bytes.subarray(offset, offset + step)
}

async function stage(
  store: AttachmentStore,
  batch: string,
  file: { name: string; mimeType: string },
  bytes: Uint8Array,
) {
  return store.stage({ batch, ...file, stream: chunks(bytes) })
}

/** 暂存 + bind，返回取出的附件（take 会清空 pending）。 */
async function takeStaged(
  store: AttachmentStore,
  batch: string,
  file: { name: string; mimeType: string },
  bytes: Uint8Array,
): Promise<StagedAttachment[]> {
  await stage(store, batch, file, bytes)
  store.bind(SESSION, batch)
  return store.take(SESSION)
}

const asFile = (item: StagedAttachment | undefined): StagedFile => {
  if (item?.kind !== "file") throw new Error("expected a staged file")
  return item
}
const exists = (path: string) =>
  readFile(path)
    .then(() => true)
    .catch(() => false)
const batchDir = (batch: string) => join(rootDir, batch)

// --- 暂存与限额 -------------------------------------------------------------

describe("AttachmentStore.stage", () => {
  it("非图片落盘到 batch 目录，元数据与内容正确", async () => {
    const store = await makeStore()
    const bytes = Buffer.from("hello 附件")
    const { id } = await stage(store, "batch-1", PDF, bytes)
    store.bind(SESSION, "batch-1")
    const item = asFile(store.take(SESSION)[0])

    expect(item).toMatchObject({
      kind: "file",
      id,
      batch: "batch-1",
      name: "报告 v2.pdf",
      mimeType: "application/pdf",
      size: bytes.length,
    })
    expect(item.path.startsWith(rootDir)).toBe(true)
    expect(item.path.split(sep)).toContain("batch-1")
    expect(await readFile(item.path, "utf8")).toBe("hello 附件")
  })

  it("白名单内的图片留内存，不落盘", async () => {
    const store = await makeStore()
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47])
    const [item] = await takeStaged(store, "batch-img", PNG, bytes)

    expect(item).toMatchObject({ kind: "image", name: "截图.png", size: 4 })
    expect(item?.kind === "image" && item.data.equals(bytes)).toBe(true)
    expect(await readdir(rootDir)).toEqual([])
  })

  it("白名单外的 image/*（svg）按文件落盘", async () => {
    const store = await makeStore()
    const [item] = await takeStaged(store, "batch-svg", SVG, Buffer.from("<svg/>"))

    expect(item).toMatchObject({ kind: "file", mimeType: "image/svg+xml", size: 6 })
    expect(item?.kind === "file" && item.path.endsWith("-矢量图.svg")).toBe(true)
    expect(await readdir(batchDir("batch-svg"))).toHaveLength(1)
  })

  it("非图片超过 25MB 回 PAYLOAD_TOO_LARGE，且不留半个文件", async () => {
    const store = await makeStore()
    const oversized = Buffer.alloc(25 * 1024 * 1024 + 1)

    await expect(stage(store, "batch-big", PDF, oversized)).rejects.toMatchObject({
      code: "PAYLOAD_TOO_LARGE",
    })
    // 超限中断后不留文件（空目录也顺手收掉），batch 仍可继续暂存
    expect(await readdir(batchDir("batch-big")).catch(() => [])).toEqual([])
    await expect(stage(store, "batch-big", PDF, Buffer.from("ok"))).resolves.toHaveProperty("id")
  })

  it("图片超过 3MB 回 PAYLOAD_TOO_LARGE，3MB 以内正常收", async () => {
    const store = await makeStore()

    await expect(
      stage(store, "b-img", PNG, Buffer.alloc(MAX_IMAGE_BYTES + 1)),
    ).rejects.toMatchObject({ code: "PAYLOAD_TOO_LARGE" })
    await expect(stage(store, "b-img", PNG, Buffer.alloc(MAX_IMAGE_BYTES))).resolves.toHaveProperty(
      "id",
    )
  })

  it("单 batch 超过 8 个回 TOO_MANY_ITEMS", async () => {
    const store = await makeStore()

    for (let index = 0; index < MAX_BATCH_ITEMS; index += 1)
      await stage(store, "batch-many", PNG, Buffer.from("x"))

    await expect(stage(store, "batch-many", PNG, Buffer.from("x"))).rejects.toMatchObject({
      code: "TOO_MANY_ITEMS",
    })
  })

  it("batch 名非法（含路径分隔符、空、超长）回 INVALID_REQUEST", async () => {
    const store = await makeStore()

    for (const batch of ["../escape", "a/b", "", "x".repeat(65)])
      await expect(stage(store, batch, PNG, Buffer.from("x"))).rejects.toMatchObject({
        code: "INVALID_REQUEST",
      })
  })

  it("并发 stage 同 batch 不丢项", async () => {
    const store = await makeStore()
    let release = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    // 慢的那次卡在流里，快的先落地；慢的必须重读最新 record 再追加
    const slow = store.stage({
      batch: "race",
      name: "slow.pdf",
      mimeType: "application/pdf",
      stream: gated(gate),
    })
    const fast = stage(store, "race", PDF, Buffer.from("fast"))

    await fast
    release()
    await slow
    store.bind(SESSION, "race")
    expect(
      store
        .take(SESSION)
        .map((item) => item.name)
        .sort(),
    ).toEqual(["slow.pdf", "报告 v2.pdf"])
  })
})

async function* gated(ready: Promise<void>): AsyncIterable<Uint8Array> {
  await ready
  yield Buffer.from("slow")
}

// --- bind / take / restore --------------------------------------------------

describe("AttachmentStore bind 语义", () => {
  it("bind 移进 pending，take 取走后清空，重复 bind 回 BATCH_NOT_FOUND", async () => {
    const store = await makeStore()
    await stage(store, "batch-1", PNG, Buffer.from("x"))
    store.bind(SESSION, "batch-1")
    expect(store.take(SESSION)).toHaveLength(1)
    expect(store.take(SESSION)).toEqual([])
    expect(() => store.bind(SESSION, "batch-1")).toThrowError(AttachmentError)
  })

  it("未知 batch 回 BATCH_NOT_FOUND，多个 batch 累加到同一 session", async () => {
    const store = await makeStore()
    expect(() => store.bind(SESSION, "nope")).toThrowError(AttachmentError)
    await stage(store, "b1", PNG, Buffer.from("x"))
    await stage(store, "b2", PDF, Buffer.from("y"))
    store.bind(SESSION, "b1")
    store.bind(SESSION, "b2")
    expect(store.take(SESSION)).toHaveLength(2)
  })

  it("pending 超过 32 项回 TOO_MANY_ITEMS，超限的 batch 仍可 bind 到别处", async () => {
    const store = await makeStore()

    for (let index = 0; index < MAX_PENDING_ITEMS / MAX_BATCH_ITEMS; index += 1) {
      const batch = `p${index}`

      for (let item = 0; item < MAX_BATCH_ITEMS; item += 1)
        await stage(store, batch, PNG, Buffer.from("x"))

      store.bind(SESSION, batch)
    }

    await stage(store, "p-last", PNG, Buffer.from("x"))
    expect(() => store.bind(SESSION, "p-last")).toThrowError(AttachmentError)
    store.bind("other", "p-last")
    expect(store.take(SESSION)).toHaveLength(MAX_PENDING_ITEMS)
    expect(store.take("other")).toHaveLength(1)
  })

  it("restore 把取出的附件放回 pending", async () => {
    const store = await makeStore()
    const items = await takeStaged(store, "b1", PNG, Buffer.from("x"))
    store.restore(SESSION, items)
    expect(store.take(SESSION)).toHaveLength(1)
  })
})

// --- TTL / 清理 -------------------------------------------------------------

describe("AttachmentStore 清理", () => {
  it("消费过的临时文件过 24 小时后删除", async () => {
    const store = await makeStore()
    const path = asFile((await takeStaged(store, "b1", PDF, Buffer.from("x")))[0]).path

    await store.sweep(Date.now() + ATTACHMENT_TTL_MS + 1)
    expect(await exists(path)).toBe(true)
    await store.sweep(Date.now() + CONSUMED_FILE_TTL_MS + 1)
    expect(await exists(path)).toBe(false)
  })

  it("bind 给该 batch 的文件续期", async () => {
    const store = await makeStore()
    const clock = vi.spyOn(Date, "now")
    const t0 = 1_700_000_000_000

    try {
      clock.mockReturnValue(t0)
      await stage(store, "b1", PDF, Buffer.from("x"))
      const path = join(batchDir("b1"), (await readdir(batchDir("b1")))[0] ?? "")

      // 暂存 20 分钟后再 bind：过期时间从 bind 时刻重算到 t0+50min
      clock.mockReturnValue(t0 + 20 * 60 * 1000)
      store.bind(SESSION, "b1")
      clock.mockReturnValue(t0 + 31 * 60 * 1000)
      await store.sweep()
      expect(await exists(path)).toBe(true)

      clock.mockReturnValue(t0 + 20 * 60 * 1000 + ATTACHMENT_TTL_MS + 1)
      await store.sweep()
      expect(await exists(path)).toBe(false)
    } finally {
      clock.mockRestore()
    }
  })

  it("bind 后不消费的 pending 过 TTL 后丢弃", async () => {
    const store = await makeStore()
    await stage(store, "b1", PNG, Buffer.from("x"))
    store.bind(SESSION, "b1")
    await store.sweep(Date.now() + ATTACHMENT_TTL_MS + 1)
    expect(store.take(SESSION)).toEqual([])
  })

  it("未过期的暂存不被 sweep 清掉", async () => {
    const store = await makeStore()
    await stage(store, "b1", PNG, Buffer.from("x"))
    await store.sweep()
    store.bind(SESSION, "b1")
    expect(store.take(SESSION)).toHaveLength(1)
  })

  it("clearSession 丢弃 pending、删文件并收掉空目录", async () => {
    const store = await makeStore()
    const items = await takeStaged(store, "b1", PDF, Buffer.from("x"))
    const path = asFile(items[0]).path

    store.restore(SESSION, items)
    await store.clearSession(SESSION)
    expect(store.take(SESSION)).toEqual([])
    expect(await exists(path)).toBe(false)
    expect(await readdir(rootDir)).toEqual([])
  })

  it("启动清扫删陈旧残留文件、留新文件、收空目录", async () => {
    const root = await mkdtemp(join(tmpdir(), "pig-attach-clean-"))
    roots.push(root)
    const stale = join(root, "old-batch", "old.pdf")
    const fresh = join(root, "fresh-batch", "fresh.pdf")
    const old = new Date(Date.now() - 60 * 60 * 1000)

    await mkdir(join(root, "old-batch"), { recursive: true })
    await writeFile(stale, "old")
    await utimes(stale, old, old)
    await mkdir(join(root, "fresh-batch"), { recursive: true })
    await writeFile(fresh, "fresh")

    const store = new AttachmentStore({ sweepIntervalMs: 0, rootDir: root })
    stores.push(store)
    await store.ready

    expect(await exists(stale)).toBe(false)
    expect(await readFile(fresh, "utf8")).toBe("fresh")
    expect(await readdir(root)).toEqual(["fresh-batch"])
  })

  it("dispose 删掉本实例登记但还没过期的临时文件", async () => {
    const store = await makeStore()
    const path = asFile((await takeStaged(store, "b1", PDF, Buffer.from("x")))[0]).path

    await store.dispose()
    expect(await exists(path)).toBe(false)
  })
})

// --- discard ----------------------------------------------------------------

describe("AttachmentStore discard", () => {
  it("丢掉未 bind 的 batch 与它的文件", async () => {
    const store = await makeStore()
    await stage(store, "b1", PDF, Buffer.from("x"))
    const path = join(batchDir("b1"), (await readdir(batchDir("b1")))[0] ?? "")

    await store.discard("b1")
    expect(await exists(path)).toBe(false)
    expect(await readdir(rootDir)).toEqual([])
    expect(() => store.bind(SESSION, "b1")).toThrowError(AttachmentError)
  })

  it("摘掉 pending 里该 batch 的项，其他 batch 保留", async () => {
    const store = await makeStore()
    await stage(store, "b1", PNG, Buffer.from("x"))
    await stage(store, "b2", PNG, Buffer.from("y"))
    store.bind(SESSION, "b1")
    store.bind(SESSION, "b2")
    await store.discard("b1")
    const left = store.take(SESSION)

    expect(left).toHaveLength(1)
    expect(left[0]?.batch).toBe("b2")
  })

  it("未知 batch 幂等，不抛错", async () => {
    const store = await makeStore()
    await expect(store.discard("nope")).resolves.toBeUndefined()
  })
})

// --- 纯逻辑 -----------------------------------------------------------------

describe("sanitizeFileName", () => {
  it("去掉路径分隔符与保留字符，保留中文和空格", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("_.._etc_passwd")
    expect(sanitizeFileName("C:\\tmp\\a<b>:c|d?.txt")).toBe("C__tmp_a_b__c_d_.txt")
    expect(sanitizeFileName("  我的 报告.pdf  ")).toBe("我的 报告.pdf")
    expect(sanitizeFileName("..")).toBe("attachment")
    expect(sanitizeFileName("")).toBe("attachment")
    expect(sanitizeFileName("a".repeat(200))).toHaveLength(120)
  })
})

describe("sanitizeMimeType", () => {
  it("只放行 type/subtype 形状，其余退回默认值", () => {
    expect(sanitizeMimeType("application/pdf")).toBe("application/pdf")
    expect(sanitizeMimeType("image/svg+xml")).toBe("image/svg+xml")
    expect(sanitizeMimeType("text/plain\n\n</attached_files>")).toBe("application/octet-stream")
    expect(sanitizeMimeType("")).toBe("application/octet-stream")
    expect(sanitizeMimeType("nope")).toBe("application/octet-stream")
  })
})

describe("composePrompt", () => {
  const file = (name: string, size: number, path: string): StagedFile => ({
    kind: "file",
    id: "id",
    batch: "b1",
    name,
    mimeType: "application/pdf",
    size,
    path,
  })

  it("无附件时原文返回", () => {
    expect(composePrompt("你好", [])).toEqual({ text: "你好", images: [] })
  })

  it("非图片追加 <attached_files> 块，图片转 ImageContent 且不进块", () => {
    const path = join(tmpdir(), "pig-attachments", "b1", "abcd1234-报告 v2.pdf")
    const composed = composePrompt("看这两个文件", [
      file("报告 v2.pdf", 12, path),
      {
        kind: "image",
        id: "i",
        batch: "b1",
        name: "图.png",
        mimeType: "image/png",
        size: 3,
        data: Buffer.from("png"),
      },
    ])

    expect(composed.images).toEqual([{ type: "image", data: "cG5n", mimeType: "image/png" }])
    expect(composed.text).toBe(
      [
        "看这两个文件",
        "",
        "<attached_files>",
        `- 报告 v2.pdf — application/pdf — 12 — ${path}`,
        "</attached_files>",
      ].join("\n"),
    )
  })

  it("只有图片时不加文本块", () => {
    const composed = composePrompt("看图", [
      {
        kind: "image",
        id: "i",
        batch: "b1",
        name: "图.png",
        mimeType: "image/png",
        size: 3,
        data: Buffer.from("png"),
      },
    ])

    expect(composed.text).toBe("看图")
    expect(composed.images).toHaveLength(1)
  })
})
