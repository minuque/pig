import { defineComponent } from "vue";
import { createRouter, createWebHistory } from "vue-router";

// 路由仅作为 URL 状态源：session 选择由 useSessions 读取 route.params 驱动，
// 视图由 App 壳直接渲染（无 router-view），路由组件恒为空。
const Empty = defineComponent({ render: () => null });

const router = createRouter({
  history: createWebHistory("/"),
  routes: [
    { path: "/", component: Empty },
    { path: "/workspaces/:workspaceId/sessions/:sessionId", component: Empty },
  ],
});

export default router;
