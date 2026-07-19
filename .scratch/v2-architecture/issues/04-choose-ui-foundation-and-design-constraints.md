# Choose the UI foundation and design constraints

Type: grilling
Status: resolved
Blocked by:

## Question

Which Vue UI foundation and visual constraints should govern the greenfield workbench?

## Answer

Use Reka UI for accessible behavior primitives, shadcn-vue as project-owned component source, Tailwind CSS v4 as the semantic-token styling layer, and Lucide Vue as the default icon set. No second full visual component library is introduced. Domain components such as Session rows, chat transcript parts, thinking, tool calls, and stream status are designed inside the project.

Create a new DESIGN.md derived from the [Apple design analysis](https://getdesign.md/apple/design-md), not from the old YouTube-dark file and not by adopting shadcn-vue defaults. Light is the default and Dark is complete from the first release. Keep Apple surface restraint, Action Blue interaction grammar, hairlines, no decorative gradients, no UI shadows, 8px/18px/pill shape grammar, 44px targets, and system typography. Add application density, SF Mono/JetBrains Mono fallbacks, semantic status colors, chat/tool/auth states, keyboard/focus/disabled/loading/error rules, and reduced motion.

An earlier comparison recommended Cursor as the easier workbench source; the human explicitly chose Apple-derived design after reviewing the marketing-system gaps. That preference supersedes the recommendation while retaining the required application adaptations. Comparative research: [DESIGN.md selection](../research/design-md-selection.md).
