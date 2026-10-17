<script setup lang="ts">
/**
 * 统一空态：一盏孤灯 + 标题 + 提示 + 可选动作（slot）。
 * 空屏不是终点，是邀请——文案口径按 better-writing：指路，不道歉。
 */
defineProps<{
  title: string;
  hint?: string;
}>();
</script>

<template>
  <div class="empty-state">
    <div class="empty-state__lamp" aria-hidden="true">
      <div class="empty-state__beam"></div>
      <div class="empty-state__shade"><div class="empty-state__bulb"></div></div>
      <div class="empty-state__stem"></div>
    </div>
    <p class="empty-state__title xz-display">{{ title }}</p>
    <p v-if="hint" class="empty-state__hint">{{ hint }}</p>
    <div class="empty-state__action"><slot /></div>
  </div>
</template>

<style scoped>
.empty-state {
  padding: 44px 0 80px;
  text-align: center;
}
.empty-state__lamp {
  position: relative;
  width: 120px;
  height: 112px;
  margin: 0 auto 22px;
  pointer-events: none; /* 光锥会罩到下方按钮区，装饰不拦点击 */
}
/* 光锥：向下散开的一小束 */
.empty-state__beam {
  position: absolute;
  top: 56px;
  left: 50%;
  transform: translateX(-50%);
  width: 230px;
  height: 200px;
  clip-path: polygon(40% 0, 60% 0, 92% 100%, 8% 100%);
  background: linear-gradient(180deg, var(--xz-lamp-glow), transparent 80%);
  filter: blur(8px);
}
.empty-state__shade {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  width: 84px;
  height: 38px;
  clip-path: polygon(22% 0, 78% 0, 100% 100%, 0 100%);
  background: linear-gradient(180deg, var(--xz-panel-2), var(--xz-panel-3));
}
.empty-state__bulb {
  position: absolute;
  left: 50%;
  bottom: -1px;
  transform: translateX(-50%);
  width: 60px;
  height: 11px;
  border-radius: 50%;
  background: radial-gradient(50% 100% at 50% 0%, var(--xz-lamp-hi), var(--xz-lamp) 65%, transparent);
  filter: blur(1.5px);
}
.empty-state__stem {
  position: absolute;
  top: 48px;
  left: calc(50% + 40px);
  width: 3px;
  height: 50px;
  background: var(--xz-line-2);
  transform: rotate(16deg);
  transform-origin: top;
}
.empty-state__title {
  margin: 0;
  font-size: var(--xz-text-title);
  font-weight: 700;
}
.empty-state__hint {
  margin: 8px 0 22px;
  color: var(--xz-ink-2);
  font-size: var(--xz-text-sm);
  letter-spacing: 0.06em;
  max-width: 420px;
  margin-left: auto;
  margin-right: auto;
}
.empty-state__action {
  display: flex;
  justify-content: center;
  gap: 10px;
}
</style>