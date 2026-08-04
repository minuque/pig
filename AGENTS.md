# AGENTS.md

## UI Rules

Source: kvnkld, "The 10 rules to ship truly polished UI with Claude" — https://x.com/kvnkld/status/2066863634949779464

All UI work in this project follows these rules. Give numbers, never adjectives.
Scope: applies to `packages/web` and any UI-related task; backend/gateway work is unaffected.

### 1. Easing is everything. The default ease is banned.

- Never use browser defaults (`ease`, `ease-in-out`).
- House easing set as design variables:

```css
:root {
  --ease-smooth: cubic-bezier(0.22, 1, 0.36, 1); /* default for almost everything */
  --ease-out: cubic-bezier(0.17, 1, 0.32, 1); /* decorative entrances */
  --ease-spring: cubic-bezier(0.35, 1.55, 0.65, 1); /* badges, pops, overshoot */
  --ease-in-out: cubic-bezier(0.66, 0, 0.34, 1); /* symmetric moves */
}
```

- Never say "smooth" — give the exact curve and duration.

### 2. Define design tokens before building any component.

- Tokens for colors, corner radius, durations, motion curves, shadow stacks. All states/hover/dark-mode pull from the same set.
- No one-off values (13px corner radius, random 0.3s timings).

```css
:root {
  /* Corner radius */
  --radius-sm: 6px;
  --radius-md: 12px;
  --radius-lg: 24px;

  /* Duration */
  --duration-fast: 150ms;
  --duration-normal: 200ms;
  --duration-slow: 280ms;
}
```

### 3. Draggables use real physics, not fades and slides.

1. Track user speed, smoothed over time — a flick has weight.
2. Momentum on release: keep moving, slow down gradually to rest.
3. Soft boundaries: at the edge, stretch a little and spring back.

- Counters/live numbers: spring animation (stiffness/bounciness/mass), not fixed duration.

### 4. Add snap points.

- Two-zone system: tight pull-in zone to snap in, larger release zone to break free.
- When it catches, pulse the label for a micro flash of feedback.

### 5. Entrances blur in. They never just fade.

- `opacity: 0→1` + `translateY: 6px→0` + `filter: blur(2px)→0`, ~280ms on the smooth curve from Rule 1.

### 6. Real depth is layered light.

- Two standard presets, reused on everything:

```css
/* The everyday card (a panel sitting on a surface) */
--shadow-card:
  0 1px 2px rgba(0, 0, 0, 0.05), /* close drop  */ 0 2px 4px rgba(0, 0, 0, 0.02),
  /* soft spread */ 0 0 0 0.5px rgba(0, 0, 0, 0.08); /* hairline ring, not a border */

/* The elevated version (modals, lifted cards) */
--shadow-elevated:
  0 4px 8px rgba(0, 0, 0, 0.02), /* spread        */ 0 8px 12px rgba(0, 0, 0, 0.02),
  /* wide ambient  */ 0 2px 4px rgba(0, 0, 0, 0.02),
  /* mid           */ 0 1px 2px rgba(0, 0, 0, 0.04), /* contact       */ 0 0 0 0.5px #e0e0e0; /* hairline ring */
```

- Hairline ring replaces the border. Opacities stay tiny (2%–8%). Stack several blurs at different sizes.
- Animate the whole stack on hover.

### 7. Make everything tactile.

- Every clickable element scales to 0.98 on press (not 0.9). Buttons, swatches, tabs, footer rows.

```css
.button:active {
  transform: scale(0.98);
}
```

- Tooltips fade + lift 4px + clear a 2px blur, never instant pop-in.

### 8. Reveal height the right way.

- Expand/collapse: animate CSS grid rows. Never `max-height` hacks.

```css
.reveal {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.22s var(--ease-smooth);
}
.reveal[data-open="true"] {
  grid-template-rows: 1fr;
}
.reveal > * {
  overflow: hidden;
}
```

- Cross-container moves: FLIP (First → Last → Invert → Play).

### 9. Respect performance and accessibility.

- Honor `prefers-reduced-motion`: animations collapse to instant, decorative loops stop.
- Favor transform/opacity for long lists and large surfaces; shadow stacks and height reveals only in small, deliberate moments.

### 10. State-driven design is the actual job.

- A component is a system of states: idle / hover / pressed / loading / disabled / success.
- States are discovered through use, never specced up front:
  - Numbers roll digit-by-digit, not hard-cut.
  - Shimmer sweep across a label while a task works (light sweeping across the word, ~2s loop).
  - Play/pause icons cross-fade and scale, never swap.
