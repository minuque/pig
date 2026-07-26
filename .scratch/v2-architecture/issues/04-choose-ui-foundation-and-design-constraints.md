# Choose the UI foundation and design constraints

Type: grilling
Status: resolved
Blocked by:

## Question

Which Vue UI foundation and visual constraints should govern the greenfield workbench?

## Answer

Use Reka UI for accessible behavior primitives, shadcn-vue as project-owned component source, Tailwind CSS v4 as the semantic-token styling layer, and Lucide Vue as the default icon set. No second full visual component library is introduced. Domain components such as Session rows, chat transcript parts, thinking, tool calls, and stream status are designed inside the project.

Create a root `DESIGN.md` using the [Google Labs DESIGN.md format](https://github.com/google-labs-code/design.md): normative YAML front matter for colors, typography, spacing, radii, and component mappings, followed by the canonical prose sections Overview, Colors, Typography, Layout, Elevation & Depth, Shapes, Components, and Do's and Don'ts. Pin the alpha spec/tool version used by the project; validate token references, section order, and contrast in CI. `DESIGN.md` is the visual source of truth, and Tailwind/CSS variables implement those tokens rather than defining an independent theme.

The product style is derived from the [getdesign.md Notion analysis](https://getdesign.md/notion/design-md), superseding the earlier Apple-derived direction. Adapt its warm minimalism to a dense coding workbench: warm-neutral canvas, near-black ink hierarchy, quiet chrome, hairlines, one restrained primary action color, Inter/system sans for operational UI, mono for code, and serif only for sparse display/empty-state headings. Use tight 4/8/12px rectangular geometry; reserve pills for statuses/tabs and soft elevation for overlays. Do not copy marketing hero scale, stickers, decorative pastel grids, large whitespace, or generic shadcn-vue defaults.

Light is default and Dark is complete from the first release even though the source analysis is not a complete product-dark specification. The project-owned extension defines dark tokens, 44px targets, semantic status colors, transcript/thinking/tool/auth/recovery states, keyboard focus, disabled/loading/error rules, code typography, and reduced motion. The selected three-region workbench information architecture remains unchanged.

Reference verification and adaptation limits: [DESIGN.md and Agent interaction references](../research/design-md-and-agent-interaction-references.md). The earlier comparison remains historical research only: [DESIGN.md selection](../research/design-md-selection.md).
