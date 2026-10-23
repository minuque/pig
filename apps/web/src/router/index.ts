import { createRouter, createWebHistory } from "vue-router"

const WorkbenchShell = () => import("@/shell/WorkbenchShell.vue")
const SessionWorkbench = () => import("@features/session-workbench/index.vue")
const UiCanvas = () => import("@/canvas/UiCanvas.vue")
const router = createRouter({
  history: createWebHistory("/"),
  routes: [
    {
      path: "/",
      component: WorkbenchShell,
      children: [
        {
          path: "",
          component: SessionWorkbench,
        },
        {
          name: "session",
          path: "/sessions/:sessionId",
          component: SessionWorkbench,
        },
        {
          name: "error",
          path: "/error",
          component: SessionWorkbench,
        },
      ],
    },
    {
      name: "ui-canvas",
      path: "/canvas",
      component: UiCanvas,
    },
  ],
})

export default router
