<template>
  <Story title="Dialog">
    <Variant title="Basic">
      <Dialog>
        <DialogTrigger>
          <template #render="{ props: part }">
            <Button v-bind="part" variant="secondary">Open dialog</Button>
          </template>
        </DialogTrigger>

        <DialogContent>
          <DialogTitle>Dialog title</DialogTitle>

          <DialogDescription>
            Dialog description text that explains what this panel is for.
          </DialogDescription>

          <div style="display: flex; justify-content: flex-end; gap: 8px; margin-block-start: 16px">
            <DialogClose>
              <template #render="{ props: part }">
                <Button v-bind="part" variant="secondary">Cancel</Button>
              </template>
            </DialogClose>

            <DialogClose>
              <template #render="{ props: part }">
                <Button v-bind="part">Confirm</Button>
              </template>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </Variant>

    <Variant title="Without close button">
      <Dialog>
        <DialogTrigger>
          <template #render="{ props: part }">
            <Button v-bind="part" variant="secondary">Open dialog</Button>
          </template>
        </DialogTrigger>

        <DialogContent :show-close-button="false">
          <DialogTitle>No close button</DialogTitle>

          <DialogDescription>
            The panel relies on the footer actions instead of the corner button.
          </DialogDescription>

          <div style="display: flex; justify-content: flex-end; gap: 8px; margin-block-start: 16px">
            <DialogClose>
              <template #render="{ props: part }">
                <Button v-bind="part">Got it</Button>
              </template>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </Variant>
  </Story>
</template>

<script setup lang="ts">
import Story from "@features/design-lab/components/DemoStory.vue"
import Variant from "@features/design-lab/components/DemoVariant.vue"
import { Button } from "@pig/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@pig/ui/dialog"
</script>
