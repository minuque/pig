import { afterEach, describe, expect, it, vi } from "vitest"
import { ref } from "vue"
import type { ComposerAttachmentBatch, SendAttachmentsHooks } from "@/types/attachment-type.js"
import { useComposerAttachments } from "@features/composer/hooks/use-composer-attachments.js"
import type { ComposerDraftApi } from "@features/composer/hooks/use-composer-draft.js"
import type { ComposerQueueApi } from "@features/composer/hooks/use-composer-queue.js"
import { useComposerSubmit } from "@features/session-workbench/hooks/use-composer-submit.js"

function file(name: string, type = "text/markdown"): File {
  return new File([new Uint8Array(1)], name, { type })
}

const draft = {
  editingQueueId: ref<string | null>(null),
  pushHistory: () => {},
  historyPrev: () => {},
  historyNext: () => {},
  beginQueueEdit: () => {},
  commitQueueEdit: () => undefined,
  cancelQueueEdit: () => {},
} as unknown as ComposerDraftApi
const queue = {
  items: ref([]),
  enqueue: () => {},
  update: () => {},
  remove: () => {},
} as unknown as ComposerQueueApi

function setup(
  submit: (
    text: string,
    cwd: string | undefined,
    batch: ComposerAttachmentBatch | undefined,
    hooks: SendAttachmentsHooks | undefined,
  ) => Promise<boolean>,
) {
  const attachments = useComposerAttachments()
  const prompt = ref("")
  const composer = useComposerSubmit({
    sessionId: () => "s1",
    welcomeCwd: () => undefined,
    running: () => false,
    prompt,
    draft,
    queue,
    attachments,
    scrollToLatest: () => {},
    submit,
    steer: () => Promise.resolve(true),
    abort: () => undefined,
  })
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {})

  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:1")
  attachments.addFiles([file("shot.png", "image/png"), file("note.md")])
  return { attachments, composer, revoke }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("useComposerSubmit", () => {
  it("附件一发出就从输入卡消失，不用等回合跑完", async () => {
    let dispatched = false
    let release!: (sent: boolean) => void
    const { attachments, composer, revoke } = setup((_text, _cwd, _batch, hooks) => {
      dispatched = Boolean(hooks?.onDispatched)
      hooks?.onDispatched?.()
      return new Promise<boolean>((resolve) => {
        release = resolve
      })
    })

    composer.sendNow("附件一轮")

    await vi.waitFor(() => expect(dispatched).toBe(true))
    expect(attachments.files.value).toEqual([])
    expect(revoke).not.toHaveBeenCalled()

    release(true)

    await vi.waitFor(() => expect(revoke).toHaveBeenCalled())
  })

  it("送出后回合失败，附件回到输入卡且可以重新上传", async () => {
    let rejectSubmit!: (error: Error) => void
    const { attachments, composer } = setup((_text, _cwd, _batch, hooks) => {
      hooks?.onDispatched?.()
      return new Promise<boolean>((_resolve, reject) => {
        rejectSubmit = reject
      })
    })

    composer.sendNow("失败的一轮")

    await vi.waitFor(() => expect(attachments.files.value).toEqual([]))
    rejectSubmit(new Error("submit failed"))

    await vi.waitFor(() => expect(attachments.files.value).toHaveLength(2))
    expect(attachments.status.value).toEqual({})
  })

  it("已发出后中途打断或切走只结算释放，不退回输入卡", async () => {
    let release!: (sent: boolean) => void
    const { attachments, composer, revoke } = setup((_text, _cwd, _batch, hooks) => {
      hooks?.onDispatched?.()
      return new Promise<boolean>((resolve) => {
        release = resolve
      })
    })

    composer.sendNow("中途切走的一轮")

    await vi.waitFor(() => expect(attachments.files.value).toEqual([]))
    release(false)

    await vi.waitFor(() => expect(revoke).toHaveBeenCalled())
    expect(attachments.files.value).toEqual([])
  })

  it("排队时附件离开输入卡，但不立刻回收预览地址", () => {
    const { attachments, composer, revoke } = setup(() => Promise.resolve(true))
    let queued: ComposerAttachmentBatch | undefined

    queue.enqueue = (_text, batch) => {
      queued = batch
    }

    composer.enqueue("排队一轮")

    expect(attachments.files.value).toEqual([])
    expect(queued?.files).toHaveLength(2)
    expect(revoke).not.toHaveBeenCalled()
  })
})
