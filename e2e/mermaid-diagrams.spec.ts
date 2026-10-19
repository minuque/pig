import type { TranscriptItem } from "@earendil-works/pi-protocol"
import { expect, seedWorkspace, test } from "./fixtures.js"
import { COMPLEX_SESSION_ID, COMPLEX_SESSION_NAME } from "./prebuild-session.js"

/** pele 支持的全部可渲染图型（按 mermaid 代码块命名）。 */
const DIAGRAMS: { name: string; code: string; text: string }[] = [
  {
    name: "flowchart",
    code: "flowchart LR\n  A[e2e-fc] --> B[Done]",
    text: "e2e-fc",
  },
  {
    name: "sequence",
    code: "sequenceDiagram\n  participant A\n  participant B\n  A->>B: hi",
    text: "hi",
  },
  {
    name: "class",
    code: "classDiagram\n  Animal <|-- Duck",
    text: "Duck",
  },
  {
    name: "state",
    code: "stateDiagram-v2\n  [*] --> Idle\n  Idle --> [*]",
    text: "Idle",
  },
  {
    name: "er",
    code: "erDiagram\n  USER ||--|| ORDER : places",
    text: "USER",
  },
  { name: "pie", code: 'pie title T\n  "a": 1\n  "b": 2', text: "a" },
  {
    name: "gantt",
    code: "gantt\n  title T\n  section S\n  a: a1, 2024-01-01, 1d",
    text: "a",
  },
  { name: "gitGraph", code: "gitGraph\n  commit\n  branch dev\n  commit", text: "" },
  { name: "mindmap", code: "mindmap\n  root\n    a\n    b", text: "root" },
  {
    name: "timeline",
    code: "timeline\n  title T\n  2024 : a : b",
    text: "a",
  },
  {
    name: "journey",
    code: "journey\n  title T\n  section S\n  a: 1: b",
    text: "a",
  },
  {
    name: "xychart",
    code: "xychart-beta\n  x-axis [a, b]\n  y-axis 0 --> 10\n  line [1, 2]",
    text: "a",
  },
  {
    name: "quadrantChart",
    code: "quadrantChart\n  title T\n  x-axis a --> b\n  y-axis c --> d\n  quadrant-1 q\n  p: [0.1, 0.1]",
    text: "q",
  },
  { name: "sankey", code: "sankey-beta\n  a, b, 1", text: "a" },
  { name: "block", code: "block-beta\n  columns 1\n  a\n  b", text: "a" },
  { name: "packet", code: 'packet-beta\n  0-1: "x"', text: "x" },
  { name: "kanban", code: "kanban\n  s1\n    a", text: "a" },
  {
    name: "architecture",
    code: "architecture-beta\n  group g(cloud)[G]\n  service s(server)[S] in g",
    text: "G",
  },
  {
    name: "requirement",
    code: 'requirementDiagram\n  requirement r {\n    id: 1\n    text: "x"\n  }',
    text: "1",
  },
  {
    name: "c4",
    code: 'C4Context\n  title T\n  Person(a, "b")',
    text: "b",
  },
  {
    name: "radar",
    code: "radar-beta\n  title T\n  axis a\n  axis b\n  curve c { 1, 2 }",
    text: "a",
  },
  { name: "treemap", code: 'treemap-beta\n  "a": 1', text: "a" },
  { name: "agentflow", code: "agentflow-beta\n  a --> b", text: "a" },
  {
    name: "ishikawa",
    code: "ishikawa\n  title T\n  p -> q",
    text: "p",
  },
  {
    name: "cynefin",
    code: 'cynefin-beta\n  title T\n  complex\n    "a"',
    text: "a",
  },
  {
    name: "wardley",
    code: "wardley-beta\n  title T\n  anchor A [0.5, 0.5]\n  component B [0.3, 0.3]\n  A -> B",
    text: "B",
  },
  { name: "treeView", code: "treeView-beta\n  - a\n  - b\n    - c", text: "c" },
  {
    name: "usecase",
    code: 'usecase-beta\n  actor A\n  B("use")\n  A --> B',
    text: "A",
  },
  {
    name: "venn",
    code: 'venn-beta\n  set A\n  set B\n  union A,B["ab"]',
    text: "ab",
  },
  {
    name: "swimlane",
    code: "swimlane-beta LR\n  subgraph S\n    a --> b\n  end",
    text: "b",
  },
  {
    name: "eventmodeling",
    code: "eventmodeling\n  timeframe 01 ui A\n  timeframe 02 command B",
    text: "A",
  },
  {
    name: "railroad",
    code: 'railroad-ebnf-beta\n  a = "x" ;',
    text: "x",
  },
]

test("pele 渲染全部支持图型", async ({ page, complexGateway }) => {
  test.setTimeout(180_000)
  await page.emulateMedia({ reducedMotion: "reduce" })
  await seedWorkspace(page, complexGateway.workspaceId)

  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))

  const md = DIAGRAMS.map((d) => `### ${d.name}\n\n\`\`\`mermaid\n${d.code}\n\`\`\``).join("\n\n")
  const items: TranscriptItem[] = [
    { id: "u1", role: "user", content: [{ type: "text", text: "show" }], timestamp: 1 },
    {
      id: "a1",
      role: "assistant",
      content: [{ type: "text", text: md }],
      model: { provider: "test", id: "m" },
      timestamp: 2,
      status: "complete",
      stopReason: "stop",
    },
  ] as TranscriptItem[]

  await page.route("**/api/v1/platform/transcript**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ items, timings: [], hasMore: false }),
    }),
  )

  await page.goto(complexGateway.entryUrl)
  await page
    .locator(".session-card", { has: page.getByText(COMPLEX_SESSION_NAME, { exact: true }) })
    .click()
  await expect(page).toHaveURL(new RegExp(`/sessions/${COMPLEX_SESSION_ID}$`))

  const blocks = page.locator(".mermaid-block-container")
  await expect(blocks).toHaveCount(DIAGRAMS.length, { timeout: 60_000 })
  // markstream-vue 异步调 pele，等所有块都渲染出 svg
  await page.waitForFunction(
    () => {
      const blocks = document.querySelectorAll(".mermaid-block-container")

      for (const b of blocks) if (!b.querySelector("svg.pele")) return false
      return true
    },
    { timeout: 60_000 },
  )

  // 渲染出的 pele svg 按顺序对应 DIAGRAMS
  const svgs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("svg.pele")).map((svg) => ({
      text: svg.innerHTML,
    }))
  })
  const failures: { name: string; reason: string }[] = []
  DIAGRAMS.forEach(({ name, text }, i) => {
    const r = svgs[i]

    if (!r) {
      failures.push({ name, reason: "no pele svg at index" })
      return
    }

    if (text && !r.text.includes(text)) {
      failures.push({ name, reason: `missing "${text}"` })
    }
  })

  console.log("DIAGRAM_FAILURES", JSON.stringify(failures))
  expect(errors).toEqual([])
  expect(failures).toEqual([])
})
