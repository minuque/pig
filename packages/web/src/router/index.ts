import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory("/"),
  routes: [
    { path: "/", component: () => import("../views/HomePage.vue") },
    { path: "/sessions/:sessionId", component: () => import("../views/HomePage.vue") },
  ],
});

export default router;
