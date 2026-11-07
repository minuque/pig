<template>
  <Story title="Table">
    <Variant v-for="variant in variants" :key="variant" :title="variant">
      <TableRoot :variant="variant" size="s">
        <TableHeader>
          <TableRow>
            <TableCell kind="column-header">指标</TableCell>
            <TableCell kind="column-header">旧</TableCell>
            <TableCell kind="column-header">新</TableCell>
          </TableRow>
        </TableHeader>

        <TableBody>
          <TableRow v-for="row in rows" :key="row.name">
            <TableCell kind="row-header">{{ row.name }}</TableCell>
            <TableCell>{{ row.before }}</TableCell>
            <TableCell>{{ row.after }}</TableCell>
          </TableRow>
        </TableBody>
      </TableRoot>
    </Variant>
  </Story>
</template>

<script setup lang="ts">
import { TableBody, TableCell, TableHeader, TableRoot, TableRow } from "./index.js"

const variants = ["surface", "ghost"] as const
const rows = [
  { name: "首帧", before: "54.5ms", after: "56.1ms" },
  { name: "稳态", before: "54.6ms", after: "50.6ms" },
]
</script>
