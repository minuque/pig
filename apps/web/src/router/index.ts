import { createRouter, createWebHistory } from "vue-router"

const WorkbenchShell = () => import("@/shell/WorkbenchShell.vue")
const SessionWorkbench = () => import("@features/session-workbench/index.vue")
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
  ],
})

export default router
