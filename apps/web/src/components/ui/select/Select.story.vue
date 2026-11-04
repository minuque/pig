<template>
  <Story title="Select">
    <Variant title="Sizes">
      <div style="display: flex; flex-direction: column; gap: 12px; max-width: 240px">
        <Select v-model="value" size="s">
          <SelectTrigger placeholder="Small" aria-label="Small select" />

          <SelectContent>
            <SelectItem value="apple">Apple</SelectItem>
            <SelectItem value="banana">Banana</SelectItem>
            <SelectItem value="cherry">Cherry</SelectItem>
          </SelectContent>
        </Select>

        <Select v-model="value" size="m">
          <SelectTrigger placeholder="Medium" aria-label="Medium select" />

          <SelectContent>
            <SelectItem value="apple">Apple</SelectItem>
            <SelectItem value="banana">Banana</SelectItem>
            <SelectItem value="cherry">Cherry</SelectItem>
          </SelectContent>
        </Select>

        <Select v-model="value" size="l">
          <SelectTrigger placeholder="Large" aria-label="Large select" />

          <SelectContent>
            <SelectItem value="apple">Apple</SelectItem>
            <SelectItem value="banana">Banana</SelectItem>
            <SelectItem value="cherry">Cherry</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </Variant>

    <Variant title="Trigger variants">
      <div style="display: flex; flex-direction: column; gap: 12px; max-width: 240px">
        <Select v-model="value">
          <SelectTrigger variant="surface" placeholder="Surface" aria-label="Surface select" />

          <SelectContent>
            <SelectItem value="apple">Apple</SelectItem>
            <SelectItem value="banana">Banana</SelectItem>
          </SelectContent>
        </Select>

        <Select v-model="value">
          <SelectTrigger variant="classic" placeholder="Classic" aria-label="Classic select" />

          <SelectContent>
            <SelectItem value="apple">Apple</SelectItem>
            <SelectItem value="banana">Banana</SelectItem>
          </SelectContent>
        </Select>

        <Select v-model="value">
          <SelectTrigger variant="soft" placeholder="Soft" aria-label="Soft select" />

          <SelectContent>
            <SelectItem value="apple">Apple</SelectItem>
            <SelectItem value="banana">Banana</SelectItem>
          </SelectContent>
        </Select>

        <Select v-model="value">
          <SelectTrigger variant="ghost" placeholder="Ghost" aria-label="Ghost select" />

          <SelectContent>
            <SelectItem value="apple">Apple</SelectItem>
            <SelectItem value="banana">Banana</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </Variant>

    <Variant title="Groups">
      <div style="max-width: 240px">
        <Select v-model="value">
          <SelectTrigger placeholder="Pick a fruit" aria-label="Grouped select" />

          <SelectContent>
            <SelectGroup>
              <SelectLabel>Citrus</SelectLabel>
              <SelectItem value="orange">Orange</SelectItem>
              <SelectItem value="lemon">Lemon</SelectItem>
            </SelectGroup>

            <SelectSeparator />

            <SelectGroup>
              <SelectLabel>Berries</SelectLabel>
              <SelectItem value="strawberry">Strawberry</SelectItem>
              <SelectItem value="blueberry">Blueberry</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </Variant>
  </Story>
</template>

<script setup lang="ts">
import { ref } from "vue"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
} from "./index.js"

const value = ref("apple")
</script>
