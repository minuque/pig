import { setCustomComponents } from "markstream-vue"
import ChatCodeBlock from "@features/transcript-view/components/ChatCodeBlock.vue"
import TranscriptMarkdownLink from "@features/transcript-view/components/TranscriptMarkdownLink.vue"

let installed = false

/** 聊天列的链接芯片和文件围栏顶栏，按 customId=chat 注册一次。 */
export function installChatMarkdownComponents(): void {
  if (installed) return
  installed = true
  setCustomComponents("chat", {
    link: TranscriptMarkdownLink,
    code_block: ChatCodeBlock,
  })
}
