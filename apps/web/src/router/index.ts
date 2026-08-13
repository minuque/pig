import { createRouter, createWebHistory } from "vue-router";

// 路由切屏：/ 欢迎页，/sessions/:id 工作台。共享工作区由 App provide。
const router = createRouter({
  history: createWebHistory("/"),
  routes: [
    {
      path: "/",
      component: () => import("@features/sessions/SessionWelcome.vue"),
    },
    {
      name: "session",
      path: "/sessions/:sessionId",
      component: () => import("@features/sessions/SessionWorkbench.vue"),
    },
  ],
});

export default router;
