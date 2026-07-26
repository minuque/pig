---
format: google-labs-design-md
format_version: 0.1.0-alpha.1
source: notion-warm-minimalism-adapted-for-coding-workbench
colors:
  light:
    canvas: "#F7F6F3"
    surface: "#FFFFFF"
    surface_muted: "#EFEEE9"
    foreground: "#20201E"
    foreground_muted: "#686762"
    border: "#D9D7D0"
    primary: "#2563EB"
    primary_foreground: "#FFFFFF"
    focus: "#1D4ED8"
    success: "#18794E"
    warning: "#946200"
    danger: "#C62F3A"
    info: "#2563EB"
    code_surface: "#ECEBE6"
    thinking: "#6D5BD0"
    tool: "#287F8F"
  dark:
    canvas: "#171715"
    surface: "#20201E"
    surface_muted: "#292926"
    foreground: "#F2F1ED"
    foreground_muted: "#B6B4AD"
    border: "#44423D"
    primary: "#78A9FF"
    primary_foreground: "#101827"
    focus: "#9ABEFF"
    success: "#63C99A"
    warning: "#E5B94E"
    danger: "#FF7B86"
    info: "#78A9FF"
    code_surface: "#111110"
    thinking: "#B7A8FF"
    tool: "#72C7D2"
typography:
  ui: "Inter, ui-sans-serif, system-ui, sans-serif"
  code: "JetBrains Mono, ui-monospace, SFMono-Regular, monospace"
  display: "Georgia, ui-serif, serif"
  size_xs: 12px
  size_sm: 13px
  size_md: 15px
  size_lg: 20px
  line_compact: 1.35
  line_reading: 1.6
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  target_min: 44px
rounded:
  control: 8px
  panel: 12px
  status: 999px
  compact: 4px
motion:
  fast: 120ms
  normal: 180ms
  reduced_motion: "no non-essential animation; transitions resolve immediately"
components:
  button_primary:
    background_light: "{colors.light.primary}"
    background_dark: "{colors.dark.primary}"
    foreground_light: "{colors.light.primary_foreground}"
    foreground_dark: "{colors.dark.primary_foreground}"
    radius: "{rounded.control}"
    min_height: "{spacing.target_min}"
  focus_ring:
    color_light: "{colors.light.focus}"
    color_dark: "{colors.dark.focus}"
    width: 2px
    offset: 2px
  workbench:
    background_light: "{colors.light.canvas}"
    background_dark: "{colors.dark.canvas}"
    border_light: "{colors.light.border}"
    border_dark: "{colors.dark.border}"
  code_block:
    background_light: "{colors.light.code_surface}"
    background_dark: "{colors.dark.code_surface}"
    font: "{typography.code}"
---

## Overview

This file is the visual source of truth for the local coding workbench. It adapts Notion-like warm minimalism to a dense three-region Workspace rail, Session sidebar, and conversation panel. Reka UI owns accessible behavior, shadcn-vue is project-owned component source, Tailwind v4 consumes these semantic tokens, and Lucide Vue supplies icons. No feature may establish a second visual token system.

Light is the default; light, dark, and system themes are first-release requirements. Quiet chrome, compact rectangular geometry, hairlines, and one restrained primary action color take precedence over marketing scale, decorative grids, stickers, or large empty areas.

## Colors

Use only semantic roles. Canvas, surface, muted surface, foreground, border, primary, focus, success, warning, danger, and info are complete in both themes. Statuses always pair color with text, icon, shape, or state name. Primary is reserved for the current principal action; it does not decorate navigation.

Thinking and tool colors are limited to transcript activity and never replace warning or error semantics. Disabled controls use muted foreground and preserve readable contrast. Selection, hover, loading, invalid, offline, reconnecting, interrupted, unavailable, and quarantined states must remain distinguishable in both themes. Text targets WCAG 2.2 AA contrast: 4.5:1 for normal text and 3:1 for large text and essential UI graphics.

## Typography

Operational UI and transcript prose use the UI stack. Code, commands, identifiers, paths shown with explicit user consent, diffs, and tool output use the code stack at no less than 13px. The serif display stack is restricted to sparse empty-state headings; it is never used for controls, dense lists, or long transcripts.

Transcript reading uses the reading line height; navigation and metadata use the compact line height. User-controlled text may wrap without changing control labels or obscuring status names.

## Layout

Desktop uses three regions: a compact Workspace rail, a Session sidebar, and a flexible conversation panel. Borders and surface steps, not shadows, separate persistent regions. Spacing follows the 4/8/12/16/24px scale. Transcript content preserves useful code width and avoids oversized chat bubbles.

At narrow widths navigation becomes keyboard-accessible modal sheets and the application presents one primary panel at a time. Focus enters a sheet on open, remains contained, and returns to its trigger on close. Every pointer target is at least 44 by 44 CSS pixels, including icon actions and transcript controls; visual glyphs may remain smaller inside that hit area.

## Elevation & Depth

Persistent panels are flat. Hairlines and surface steps provide hierarchy. Soft elevation is reserved for overlays, dialogs, menus, and sheets; it may not communicate durable resource state. Backdrops must retain sufficient separation in both themes without hiding the focused surface.

## Shapes

Controls use 8px radii, panels 12px, and compact inline containers 4px. Pills are reserved for statuses, tabs, and short immutable labels. Transcript messages, code, and tool details remain rectangular to maximize scanning and horizontal space.

## Components

Buttons, inputs, rows, dialogs, sheets, menus, tabs, alerts, and toasts map all Reka/shadcn-vue states to the tokens above. All interactive controls have a persistent semantic name, visible 2px focus indicator, and disabled, loading, invalid, and destructive states. Focus is never indicated by color alone or removed without an equivalent replacement.

Session rows show selection, keyboard focus, hover, queued, running, interrupted, unavailable, and background output as separate combinations of label and icon. Transcript items cover message, tool call, tool result, compaction, model change, notice, and unsupported content. Thinking and tool details are collapsible controls with programmatic expanded state. Streaming updates in place and a throttled live region announces phase changes or completed chunks rather than every token.

Code blocks preserve original text for copy, wrap only when explicitly selected, and otherwise scroll horizontally. Authentication secrets remain in local input state and are cleared after submission. Recovery and destructive actions use inline alerts or dialogs; a transient toast alone is insufficient.

Motion uses short opacity or position transitions only when they explain continuity. Under `prefers-reduced-motion: reduce`, disable smooth scrolling, pulsing, cursor animation, and non-essential transforms; state changes remain immediate and understandable.

## Do's and Don'ts

- Do use semantic tokens for every representative DOM color and verify both themes.
- Do preserve keyboard order, visible focus, focus return, modal containment, semantic names, and 44px targets.
- Do announce meaningful Run phases and completed output without token-by-token live-region noise.
- Do pair status color with text or icon and meet WCAG 2.2 AA contrast.
- Do keep dense technical content readable with restrained spacing and horizontal code overflow.
- Don't use raw hex values in feature components or generic shadcn-vue defaults as a parallel theme.
- Don't use raw HTML rendering, color-only status, focus suppression, or hover-only actions.
- Don't animate during reduced motion, force transcript autoscroll away from a reader, or use marketing hero scale.
- Don't imply Workspace authorization is an operating-system sandbox.
