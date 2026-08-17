/** markstream measurementKey：版式身份（宽 / 主题 / 字号密度），不是 Session 身份。 */
export function transcriptMeasurementKey(width: number, theme: "light" | "dark"): string {
  const column = Number.isFinite(width) ? Math.round(width) : 0;
  return `${column}:${theme}:doc-v3`;
}
