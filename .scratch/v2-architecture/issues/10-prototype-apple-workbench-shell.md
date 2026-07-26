# Prototype the workbench shell

Type: prototype
Status: resolved
Blocked by: 11

## Question

How should the project design language become a usable desktop and narrow-screen workbench for Workspace navigation, Session list, streaming transcript, composer, model/auth settings, reconnect states, and tool activity without inheriting marketing-page density?

## Answer

Adopt **Variant A — 三栏工作台** as the first-release information architecture. It makes the product's core concurrency model visible without turning the workbench into an operations dashboard: Workspace identity remains stable at the left edge, Session switching remains one click away, and the selected Session owns the main transcript/composer surface.

### Desktop shell

The desktop shell has three persistent regions:

1. a narrow Workspace rail (approximately 56–64px) containing product identity, registered Workspace affordances, add, and settings;
2. a Session sidebar (approximately 260–300px) for the active Workspace, search, activity-sorted Session rows, creation, and provider readiness;
3. a flexible conversation pane with a compact Session header, scroll-owned transcript, and bottom-anchored composer.

The shell fills the viewport. Regions use hairline separators and restrained warm-neutral surfaces rather than floating cards, decorative gradients, or marketing-page whitespace. Light remains default; Dark uses the same hierarchy rather than a separate visual treatment. The 4/8/12px rectangular grammar, pills reserved for status/tabs, 44px targets, semantic status colors, focus rings, and reduced-motion behavior from **Choose the UI foundation and design constraints** remain mandatory.

Workspace and Session selection are navigation, not modal workflows. The selected Workspace and Session IDs are route-owned. The Session sidebar may collapse at intermediate widths, but the transcript never shares primary width with a permanent diagnostics inspector.

### Narrow screens

Below the narrow breakpoint, do not squeeze three columns side by side. Show one primary conversation surface with:

- a compact header that opens Workspace/Session navigation as a sheet;
- the same transcript semantics and ordering as desktop;
- a composer anchored above safe-area and prototype/navigation chrome;
- model selection and cancel/send retained, while secondary thinking/profile controls move into an overflow sheet;
- connection state kept visible without consuming a full banner when healthy.

Opening a Session closes the navigation sheet and updates the route. Back behavior first closes sheets, then follows route history. No separate mobile-only domain state or alternative Session model is introduced.

### Transcript, tools, and Run activity

The transcript is the primary Run explanation. Thinking, tool calls/results, compaction notices, and streaming text remain inline in chronological order. Tool rows are compact, expandable, keyboard-operable, and show name, safe summary, status, and duration; long output stays collapsed by default.

Do not adopt Variant B's permanent Run activity inspector in v1: it duplicates transcript ownership and consumes the width needed for code and Markdown. Retain only its useful principle—a compact current-phase summary may appear in the Session header or immediately above the composer when a Run is active. Detailed phase/tool truth stays inline and derives from the same live reducer.

Streaming uses append-in-place output without layout animation. The transcript follows the tail only while the user is already near it; reading older content must not be interrupted. A visible “jump to latest” control replaces forced autoscroll.

### Composer, model, and provider auth

The composer is a stable bottom region, not a floating marketing card. It contains multiline input, model selector, thinking-level affordance, and one primary send/cancel control. Its warning copy states the already-decided Pi trust boundary without claiming Workspace sandboxing.

Model choice is visible in the composer because it affects the next Run's Execution Profile. Provider readiness appears as compact status in the Workspace sidebar and opens a dedicated settings surface for Auth Flow steps; credentials and OAuth interactions never expand inline inside the transcript.

### Connection and recovery states

Healthy connection is a quiet header badge. `connecting` and `reconnecting` change the badge to an active semantic state without blocking transcript reading. `offline`, `stream.reset`, protocol incompatibility, unavailable Session, and projection rebuild use one contextual recovery surface in the conversation pane with the exact next action: reconnect, bootstrap again, refresh snapshot, cancel/retry, or inspect diagnostics.

The composer is disabled only when the selected Session cannot safely admit a command; loss of SSE alone does not erase durable content or pretend an accepted Run stopped. Session rows retain independent running/warning state so concurrent activity remains visible while another Session is selected.

### Visual and Agent interaction amendment

The later human decision replaces the prototype's Apple-derived styling with the project-owned, Google-format `DESIGN.md` derived from [Notion](https://getdesign.md/notion/design-md). This changes tokens, typography, shape, surface, and elevation rules; it does **not** reopen Variant A's information architecture. Treat the prototype as evidence for region ownership, responsive navigation, and state placement—not as final visual truth.

Use [AIcss](https://www.aicss.dev/#components) as a Codex-like interaction reference for transcript anatomy: compact expandable thinking/reasoning, inline tool/action status, append-in-place streaming text, accessible code blocks, and a stable bottom Agent input. These states remain chronological transcript content rather than chat-bubble decoration or a permanent activity inspector.

AIcss provides Vue copy-paste variants and may serve as the starting implementation after its license is verified; it is not a runtime dependency or source of product contracts. Copied components become project-owned and must be adapted to Pi/Gateway types, accessibility requirements, and `DESIGN.md` tokens. Do not add image generation, citations, comparison tables, dedicated file-diff rendering, or other patterns unless an existing v1 contract already has that semantic content.

### Rejected directions

Variant B's activity cockpit overemphasizes one Run and behaves poorly at medium width. Variant C's focus-first canvas is calm for reading but hides the multi-Session concurrency that differentiates the workbench. Elements may be borrowed from both, but neither replaces the three-region ownership model.

### Prototype asset

The three read-only variants, light/dark switch, reconnect states, tool expansion, and responsive behavior are captured off main on branch `prototype/workbench-shell`, commit `b0dac12`. Its selected layout and behavioral states remain evidence, but its earlier visual treatment is superseded by the Notion-derived `DESIGN.md`. It must be rewritten under production architecture and tests; no prototype code remains on the main branch.
