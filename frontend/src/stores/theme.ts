import { ref } from "vue";

/**
 * 夜书房 / 白天暖纸 双主题。
 * 状态单一来源：localStorage + <html data-theme>；组件只读 useTheme()。
 */
export type Theme = "night" | "day";

const KEY = "xz-theme";
const saved = localStorage.getItem(KEY) as Theme | null;
const current = ref<Theme>(saved === "day" ? "day" : "night");

function apply(t: Theme) {
  document.documentElement.dataset.theme = t;
}
apply(current.value);

export function useTheme() {
  function toggle() {
    const html = document.documentElement;
    current.value = current.value === "night" ? "day" : "night";
    localStorage.setItem(KEY, current.value);
    html.classList.add("theme-switching");
    apply(current.value);
    window.setTimeout(() => html.classList.remove("theme-switching"), 320);
  }

  return { current, toggle };
}