export { transcriptText } from "@features/transcript-view/lib/transcript-format.js"

export { prefetchHighlighter } from "@features/transcript-view/lib/markdown-render-props.js"

export function prefetchTranscriptView(): void {
  void import("@features/transcript-view/components/TranscriptBody.vue")
}
