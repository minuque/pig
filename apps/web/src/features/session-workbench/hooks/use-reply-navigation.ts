import { provide, shallowRef, watch, type Ref } from "vue"
import { useRouter } from "vue-router"
import {
  navigateReplyKey,
  quoteReplyKey,
  type QuoteReplyRequest,
  type ReplyJumpRequest,
  type ReplyJumpTarget,
} from "@features/transcript-view/index.js"

export interface UseReplyNavigationOptions {
  sessionId: Readonly<Ref<string | undefined>>
  onQuote(request: QuoteReplyRequest): void
}

export function useReplyNavigation(options: UseReplyNavigationOptions) {
  const router = useRouter()
  const pendingJump = shallowRef<ReplyJumpTarget | null>(null)
  let jumpSeq = 0

  function jumpToReply(target: ReplyJumpRequest) {
    if (!target.sessionId || !target.entryId) return
    jumpSeq += 1
    pendingJump.value = { ...target, seq: jumpSeq }

    if (target.sessionId === options.sessionId.value) return

    void router.push({ name: "session", params: { sessionId: target.sessionId } })
  }

  function onJumpSettled(seq: number) {
    if (pendingJump.value?.seq === seq) pendingJump.value = null
  }

  provide(quoteReplyKey, options.onQuote)

  provide(navigateReplyKey, jumpToReply)

  watch(options.sessionId, (id) => {
    if (id && pendingJump.value && pendingJump.value.sessionId !== id) {
      pendingJump.value = null
    }
  })
  return { pendingJump, jumpToReply, onJumpSettled }
}
