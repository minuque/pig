import { createRouter, createWebHistory } from "vue-router";

// 路由切屏：/ 欢迎页，/sessions/:id 工作台，/error 启动失败。共享工作区由 App provide。
const router = createRouter({
  history: createWebHistory("/"),
  routes: [
    {
      path: "/",
      component: () => import("@features/session-workbench/components/SessionWelcome.vue"),
    },
    {
      name: "session",
      path: "/sessions/:sessionId",
      component: () => import("@features/session-workbench/index.vue"),
    },
    {
      name: "error",
      path: "/error",
      component: () => import("@features/startup/components/StartupError.vue"),
    },
  ],
});

export default router;
