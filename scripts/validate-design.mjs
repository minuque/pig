import { readFile } from "node:fs/promises";

const design = await readFile(new URL("../DESIGN.md", import.meta.url), "utf8");
const sections = [
  "Overview",
  "Colors",
  "Typography",
  "Layout",
  "Elevation & Depth",
  "Shapes",
  "Components",
  "Do's and Don'ts",
];

if (!design.startsWith("---\n") || design.indexOf("\n---\n", 4) < 0) {
  throw new Error("DESIGN.md must have YAML frontmatter");
}
const positions = sections.map((section) =>
  design.indexOf(`\n## ${section}\n`),
);
if (positions.some((position) => position < 0)) {
  throw new Error("DESIGN.md is missing a canonical section");
}
if (
  positions.some(
    (position, index) => index > 0 && position <= positions[index - 1],
  )
) {
  throw new Error("DESIGN.md canonical sections are out of order");
}

for (const token of [
  "format_version: 0.1.0-alpha.1",
  "light:",
  "dark:",
  "canvas:",
  "foreground:",
  "primary:",
  "focus:",
  "success:",
  "warning:",
  "danger:",
  "target_min: 44px",
  "reduced_motion:",
  "{colors.light.primary}",
  "{colors.dark.primary}",
]) {
  if (!design.includes(token)) throw new Error(`DESIGN.md is missing ${token}`);
}

const references = [...design.matchAll(/\{([a-z0-9_.-]+)\}/gi)].map(
  (match) => match[1],
);
const frontmatter = design.slice(4, design.indexOf("\n---\n", 4));
for (const reference of references) {
  const leaf = reference.split(".").at(-1);
  if (!leaf || !new RegExp(`^\\s*${leaf}:`, "m").test(frontmatter)) {
    throw new Error(`Unresolved token reference: {${reference}}`);
  }
}

process.stdout.write("DESIGN.md validation passed\n");
