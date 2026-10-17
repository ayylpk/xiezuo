<script setup lang="ts">
/**
 * 全局顶栏：品牌/返回 + 中部标题区（slot center）+ 右侧操作区（slot actions）。
 * 所有页面共用，取代此前 9 个页面各自硬编码 #fff 顶栏。
 */
import { useRouter } from "vue-router";

import ThemeToggle from "./ThemeToggle.vue";

const props = defineProps<{
  /** 传入则显示返回按钮（如 "/" 或 "/works/3"），不传则品牌可点回书架 */
  backTo?: string;
  backLabel?: string;
}>();

const router = useRouter();
</script>

<template>
  <header class="desk-header">
    <div class="desk-header__left">
      <button v-if="props.backTo" class="desk-header__back" @click="router.push(props.backTo)">
        ← {{ props.backLabel ?? "返回" }}
      </button>
      <router-link v-else to="/" class="desk-header__brand xz-display">写作台</router-link>
      <span class="desk-header__divider" v-if="props.backTo"></span>
      <slot name="center" />
    </div>
    <div class="desk-header__right">
      <slot name="actions" />
      <ThemeToggle />
    </div>
  </header>
</template>

<style scoped>
.desk-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 28px;
  background: var(--xz-panel);
  border-bottom: 1px solid var(--xz-line);
  position: sticky;
  top: 0;
  z-index: 10;
}
.desk-header__left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0; /* 允许标题截断 */
}
.desk-header__right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
.desk-header__brand {
  font-size: 20px;
  font-weight: 700;
  color: var(--xz-ink);
  text-decoration: none;
  letter-spacing: 0.08em;
}
.desk-header__back {
  border: none;
  background: transparent;
  color: var(--xz-ink-2);
  font-size: var(--xz-text-body);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--td-radius-default);
  transition: color 0.15s ease, background-color 0.15s ease;
  white-space: nowrap;
}
.desk-header__back:hover {
  color: var(--xz-lamp);
  background: var(--xz-lamp-wash);
}
.desk-header__divider {
  width: 1px;
  height: 18px;
  background: var(--xz-line-2);
}
</style>