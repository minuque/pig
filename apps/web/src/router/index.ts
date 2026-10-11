import { createRouter, createWebHistory } from "vue-router"

const SessionWorkbench = () => import("@features/session-workbench/index.vue")
const router = createRouter({
  history: createWebHistory("/"),
  routes: [
    {
      path: "/",
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
    {
      name: "settings",
      path: "/settings",
      component: () => import("@features/settings/index.vue"),
    },
  ],
})

export default router
