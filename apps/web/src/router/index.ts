import { createRouter, createWebHistory } from "vue-router"

const WorkbenchShell = () => import("@/shell/WorkbenchShell.vue")
const SessionWorkbench = () => import("@features/session-workbench/index.vue")
// 设计页只在开发时注册，正式构建整段剔除
const devRoutes = import.meta.env.DEV
  ? [{ path: "/design", component: () => import("@features/design-lab/index.vue") }]
  : []
const router = createRouter({
  history: createWebHistory("/"),
  routes: [
    ...devRoutes,
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
