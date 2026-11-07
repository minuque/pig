<template>
  <Story title="Dialog">
    <Variant title="Basic">
      <Dialog>
        <DialogTrigger as-child>
          <Button variant="soft">Open dialog</Button>
        </DialogTrigger>

        <DialogContent>
          <DialogTitle>Dialog title</DialogTitle>

          <DialogDescription>
            Dialog description text that explains what this panel is for.
          </DialogDescription>

          <div style="display: flex; justify-content: flex-end; gap: 8px; margin-block-start: 16px">
            <DialogClose as-child>
              <Button variant="soft">Cancel</Button>
            </DialogClose>

            <DialogClose as-child>
              <Button>Confirm</Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </Variant>

    <Variant title="Large">
      <Dialog>
        <DialogTrigger as-child>
          <Button variant="soft">Open large dialog</Button>
        </DialogTrigger>

        <DialogContent size="4">
          <DialogTitle>Large dialog</DialogTitle>

          <DialogDescription>
            A wider panel keeps long content readable without scrolling.
          </DialogDescription>

          <div style="display: flex; justify-content: flex-end; gap: 8px; margin-block-start: 16px">
            <DialogClose as-child>
              <Button variant="soft">Close</Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </Variant>

    <Variant title="Without close button">
      <Dialog>
        <DialogTrigger as-child>
          <Button variant="soft">Open dialog</Button>
        </DialogTrigger>

        <DialogContent :show-close-button="false">
          <DialogTitle>No close button</DialogTitle>

          <DialogDescription>
            The panel relies on the footer actions instead of the corner button.
          </DialogDescription>

          <div style="display: flex; justify-content: flex-end; gap: 8px; margin-block-start: 16px">
            <DialogClose as-child>
              <Button>Got it</Button>
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
import { Button } from "@components/ui/button/index.js"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@components/ui/dialog/index.js"
</script>
