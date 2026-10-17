import { defineStore } from "pinia";
import { ref } from "vue";

import { api } from "../api/client";

/** 登录态：user 非空 = 已登录。会话本身在服务端（cookie），前端只存镜像 */
export const useAuthStore = defineStore("auth", () => {
  const user = ref<{ id: number } | null>(null);
  const booted = ref(false); // 首次会话恢复完成后置 true，路由守卫依赖它

  async function fetchMe() {
    try {
      const { user: u } = await api.get<{ user: { id: number } }>("/auth/me");
      user.value = u;
    } catch {
      user.value = null;
    } finally {
      booted.value = true;
    }
  }

  async function login(username: string, password: string) {
    await api.post<{ ok: true }>("/auth/login", { username, password });
    await fetchMe();
  }

  async function logout() {
    await api.post<{ ok: true }>("/auth/logout").catch(() => undefined);
    user.value = null;
  }

  /** 401 全局事件：清本地镜像（App.vue 监听后负责跳转） */
  function invalidate() {
    user.value = null;
  }

  return { user, booted, fetchMe, login, logout, invalidate };
});