<template>
  <div data-slot="command-palette-group-label"><slot /></div>
</template>

<style scoped>
[data-slot="command-palette-group-label"] {
  padding: calc(var(--spacing) * 1.5) var(--space-xs);
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  font-weight: var(--font-weight-medium);
}
</style>
