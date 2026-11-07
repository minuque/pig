<template>
  <Story title="Alert dialog">
    <Variant title="Default">
      <AlertDialog v-model:open="deleteOpen">
        <Button variant="soft" @click="deleteOpen = true">Delete item</Button>

        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this item?</AlertDialogTitle>

            <AlertDialogDescription>
              This action cannot be undone. The item will be removed permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Variant>

    <Variant title="Large">
      <AlertDialog v-model:open="largeOpen">
        <Button variant="soft" @click="largeOpen = true">Open large alert</Button>

        <AlertDialogContent size="4">
          <AlertDialogHeader>
            <AlertDialogTitle>Large alert dialog</AlertDialogTitle>

            <AlertDialogDescription>
              The wider panel gives longer explanations room to breathe.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Variant>
  </Story>
</template>

<script setup lang="ts">
import Story from "@features/design-lab/components/DemoStory.vue"
import Variant from "@features/design-lab/components/DemoVariant.vue"
import { ref } from "vue"
import { Button } from "@components/ui/button/index.js"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@components/ui/alert-dialog/index.js"

const deleteOpen = ref(false)
const largeOpen = ref(false)
</script>
