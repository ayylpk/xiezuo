import { createRouter, createWebHistory } from "vue-router";

import { useAuthStore } from "../stores/auth";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/login", name: "login", component: () => import("../views/LoginView.vue"), meta: { public: true } },
    { path: "/", name: "dashboard", component: () => import("../views/DashboardView.vue") },
    { path: "/works/:id", name: "work", component: () => import("../views/WorkView.vue") },
    { path: "/works/:id/chapters", name: "chapters", component: () => import("../views/ChaptersView.vue") },
    { path: "/works/:id/chapters/:cid", name: "chapter-editor", component: () => import("../views/ChapterEditorView.vue") },
    { path: "/works/:id/entities", name: "entities", component: () => import("../views/EntitiesView.vue") },
    { path: "/works/:id/outlines", name: "outlines", component: () => import("../views/OutlinesView.vue") },
    { path: "/works/:id/foreshadows", name: "foreshadows", component: () => import("../views/ForeshadowsView.vue") },
    { path: "/works/:id/timeline", name: "timeline", component: () => import("../views/TimelineView.vue") },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
});

/**
 * 路由守卫：M1 的会话守卫——首次导航先 fetchMe 恢复会话（刷新页面不掉线），
 * 非公开页无登录态 → 跳 /login
 */
router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (!auth.booted && !auth.user) {
    await auth.fetchMe();
  }
  if (to.meta.public && auth.user) return { name: "dashboard" };
  if (!to.meta.public && !auth.user) return { name: "login", query: { redirect: to.fullPath } };
});

// 401 全局事件：清会话 + 跳登录（由 api/client 派发）
window.addEventListener("auth:unauthorized", () => {
  const auth = useAuthStore();
  auth.invalidate();
  if (router.currentRoute.value.name !== "login") router.push({ name: "login" });
});

export default router;