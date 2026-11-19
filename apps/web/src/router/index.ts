import { createRouter, createWebHistory } from "vue-router"

const WorkbenchShell = () => import("@/shell/WorkbenchShell.vue")
// 两侧 workbench 由壳层自己渲染，路由只记聚焦那一侧的会话
const FocusedRoute = { render: () => null }
// 设计页只在开发时注册，正式构建整段剔除
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
