import { createRouter, createWebHistory } from "vue-router"

const WorkbenchShell = () => import("@/shell/WorkbenchShell.vue")
const FocusedRoute = { render: () => null }
const devRoutes = import.meta.env.DEV
  ? [{ path: "/design/:page(.*)*", component: () => import("@features/design-lab/index.vue") }]
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
          component: FocusedRoute,
        },
        {
          name: "session",
          path: "/sessions/:sessionId",
          component: FocusedRoute,
        },
        {
          name: "error",
          path: "/error",
          component: FocusedRoute,
        },
      ],
    },
  ],
})

export default router
