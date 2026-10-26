import type { Meta, StoryObj } from "@storybook/vue3-vite"

import TranscriptBody from "@features/transcript-view/components/TranscriptBody.vue"
import { withDarkTheme, withTranscriptFrame } from "@/stories/decorators.js"
import { TRANSCRIPT_SAMPLES, type TranscriptSample } from "@/stories/fixtures/sessions.js"

const { empty, error, long, short, streaming } = TRANSCRIPT_SAMPLES

/** 样本转组件入参：会话、条目、轮次计时都按样本，布尔项交给 controls。 */
function sampleArgs(sample: TranscriptSample) {
  return {
    sessionId: sample.sessionId,
    transcript: sample.transcript,
    timings: sample.timings,
    running: sample.running,
  }
}

const meta = {
  title: "Features/Transcript/TranscriptBody",
  component: TranscriptBody,
  tags: ["autodocs"],
  decorators: [withTranscriptFrame],
  parameters: { layout: "centered" },
  argTypes: {
    sessionId: { control: "text" },
    transcript: { control: false },
    timings: { control: false },
    phase: {
      control: "inline-radio",
      options: ["idle", "turn", "compaction", "branch_summary", "retry"],
    },
    running: { control: "boolean" },
    sending: { control: "boolean" },
    stopping: { control: "boolean" },
    hasMore: { control: "boolean" },
    loadingOlder: { control: "boolean" },
  },
  args: {
    ...sampleArgs(short),
    phase: "idle",
    sending: false,
    stopping: false,
    hasMore: false,
    loadingOlder: false,
  },
  render: (args) => ({
    components: { TranscriptBody },
    setup: () => ({ args }),
    // 定高容器：正文视口靠 flex + 容器查询量高度，没有高度就贴不成底
    template:
      '<div style="display:flex;flex-direction:column;height:720px;width:100%"><TranscriptBody v-bind="args" /></div>',
  }),
} satisfies Meta<typeof TranscriptBody>

export default meta

type Story = StoryObj<typeof meta>

/** 会话加载中遮罩：零行时 readyFrame 为 false，只亮菊花；生产里零行的空会话由 WorkbenchHero 接管。 */
export const SessionLoading: Story = {
  args: { ...sampleArgs(empty), phase: "idle" },
}
/** 短会话：两轮问答，不带工具卡。 */
export const Short: Story = {}
/** 长会话：22 轮，含工具卡、思考与代码块，可逐张展开。 */
export const Long: Story = {
  args: sampleArgs(long),
}
/** 流式进行中：最后一轮仍在输出，计时取 RUNNING_TIMINGS。 */
export const Streaming: Story = {
  args: { ...sampleArgs(streaming), phase: "turn" },
}
/** 错误态：末轮助手没有正文，只有 errorMessage。 */
export const Error: Story = {
  args: { ...sampleArgs(error), phase: "idle" },
}
/** 分页：还有更早一页且正在拉，视口顶部显示加载占位。 */
export const LoadingOlder: Story = {
  args: { ...sampleArgs(short), hasMore: true, loadingOlder: true },
}
/** 长会话暗色：与 Long 同一样本，只换配色。 */
export const LongDark: Story = {
  args: sampleArgs(long),
  decorators: [withDarkTheme],
}
