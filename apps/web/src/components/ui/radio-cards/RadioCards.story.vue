<template>
  <Story title="RadioCards">
    <Variant title="Variants">
      <div style="display: flex; flex-direction: column; gap: 16px; max-width: 560px">
        <RadioCards v-model="value" variant="surface">
          <RadioCardsItem value="a">
            <div style="padding: 16px">Surface A</div>
          </RadioCardsItem>

          <RadioCardsItem value="b">
            <div style="padding: 16px">Surface B</div>
          </RadioCardsItem>
        </RadioCards>

        <RadioCards v-model="value" variant="classic">
          <RadioCardsItem value="a">
            <div style="padding: 16px">Classic A</div>
          </RadioCardsItem>

          <RadioCardsItem value="b">
            <div style="padding: 16px">Classic B</div>
          </RadioCardsItem>
        </RadioCards>
      </div>
    </Variant>

    <Variant title="Columns">
      <div style="max-width: 640px">
        <RadioCards v-model="value" columns="repeat(auto-fit, minmax(140px, 1fr))">
          <RadioCardsItem value="a">
            <div style="padding: 16px">One</div>
          </RadioCardsItem>

          <RadioCardsItem value="b">
            <div style="padding: 16px">Two</div>
          </RadioCardsItem>

          <RadioCardsItem value="c">
            <div style="padding: 16px">Three</div>
          </RadioCardsItem>
        </RadioCards>
      </div>
    </Variant>

    <Variant title="Disabled">
      <div style="max-width: 560px">
        <RadioCards v-model="value" disabled>
          <RadioCardsItem value="a">
            <div style="padding: 16px">Option A</div>
          </RadioCardsItem>

          <RadioCardsItem value="b">
            <div style="padding: 16px">Option B</div>
          </RadioCardsItem>
        </RadioCards>
      </div>
    </Variant>
  </Story>
</template>

<script setup lang="ts">
import { ref } from "vue"
import { RadioCards, RadioCardsItem } from "./index.js"

const value = ref("a")
</script>
