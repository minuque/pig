<template>
  <div class="table-scroll">
    <table><slot /></table>
  </div>
</template>

<style scoped>
.table-scroll {
  max-width: 100%;
  overflow-x: auto;
}
</style>
