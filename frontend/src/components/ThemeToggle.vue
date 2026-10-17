<script setup lang="ts">
import { useTheme } from "../stores/theme";

const { current, toggle } = useTheme();
</script>

<template>
  <button class="theme-toggle" :title="current === 'night' ? '切到白天' : '切到夜书房'" :aria-label="current === 'night' ? '切换到白天模式' : '切换到夜书房模式'" @click="toggle">
    <!-- 夜里给一盏太阳（点击见白天），白天给一弯月 -->
    <svg v-if="current === 'night'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2.5v2.5M12 19v2.5M2.5 12h2.5M19 12h2.5M5.2 5.2l1.8 1.8M17 17l1.8 1.8M18.8 5.2L17 7M7 17l-1.8 1.8" />
    </svg>
    <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M20 13.5A8.5 8.5 0 1 1 10.5 4 7 7 0 0 0 20 13.5Z" />
    </svg>
    <span class="theme-toggle__text">{{ current === "night" ? "白天" : "夜书房" }}</span>
  </button>
</template>

<style scoped>
.theme-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  background: transparent;
  border: 1px solid var(--xz-line);
  border-radius: 16px;
  color: var(--xz-ink-2);
  font-size: var(--xz-text-xs);
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease, background-color 0.15s ease;
}
.theme-toggle:hover {
  color: var(--xz-lamp);
  border-color: var(--xz-lamp);
  background: var(--xz-lamp-wash);
}
.theme-toggle:active {
  transform: scale(0.96);
}
.theme-toggle svg {
  flex-shrink: 0;
}
</style>