import { createRouter, createWebHistory } from "vue-router"

const SessionWorkbench = () => import("@features/session-workbench/index.vue")
const Settings = () => import("@features/settings/index.vue")
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
      path: "/settings",
      component: Settings,
      children: [
        { path: "", redirect: "/settings/general" },
        {
          name: "settings-general",
          path: "general",
          component: () => import("@features/settings/components/GeneralPane.vue"),
        },
        {
          name: "settings-usage",
          path: "usage",
          component: () => import("@features/settings/components/UsagePane.vue"),
        },
        {
          name: "settings-skills",
          path: "skills",
          component: () => import("@features/settings/components/ResourcePane.vue"),
          props: { pane: "skills" },
        },
        {
          name: "settings-extensions",
          path: "extensions",
          component: () => import("@features/settings/components/ResourcePane.vue"),
          props: { pane: "extensions" },
        },
      ],
    },
  ],
})

export default router
