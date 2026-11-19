<template>
  <p data-slot="command-palette-empty"><slot /></p>
</template>

<style scoped>
[data-slot="command-palette-empty"] {
  margin: 0;
  padding-block: calc(var(--spacing) * 10);
  color: var(--fg-secondary);
  font-size: var(--text-body);
  text-align: center;
}
</style>
