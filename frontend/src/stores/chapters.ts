import { defineStore } from "pinia";
import { ref } from "vue";

import { api } from "../api/client";

/** 与后端 schema.ts 的状态机枚举保持一致（单一事实在后端，前端镜像） */
export const CHAPTER_STATUS: Record<string, string> = {
  draft: "草稿",
  written: "已写",
  review: "待审查",
  final: "已定稿",
};
export type ChapterStatus = keyof typeof CHAPTER_STATUS;

export interface ChapterMeta {
  id: number;
  workId: number;
  title: string;
  synopsis: string;
  status: ChapterStatus;
  wordCount: number;
  sortNo: number;
  updatedAt: number;
}

export interface ChapterFull extends ChapterMeta {
  content: string;
}

export const useChaptersStore = defineStore("chapters", () => {
  const list = ref<ChapterMeta[]>([]);

  async function fetchList(workId: number) {
    const { chapters } = await api.get<{ chapters: ChapterMeta[] }>(`/works/${workId}/chapters`);
    list.value = chapters;
  }

  async function create(workId: number, input: { title?: string; content?: string } = {}) {
    return api.post<{ chapter: ChapterFull }>(`/works/${workId}/chapters`, input);
  }

  async function get(id: number) {
    return api.get<{ chapter: ChapterFull }>(`/chapters/${id}`);
  }

  /** 编辑页保存：title/synopsis/content/status 任意组合都是一个 PATCH */
  async function update(id: number, patch: Partial<Omit<ChapterFull, "id" | "workId" | "updatedAt" | "createdAt" | "sortNo">>) {
    return api.patch<{ chapter: ChapterFull }>(`/chapters/${id}`, patch);
  }

  /** 状态流转快的切换（列表页下拉/编辑器状态栏） */
  async function setStatus(id: number, status: ChapterStatus) {
    return update(id, { status });
  }

  async function remove(id: number) {
    await api.delete<{ ok: true }>(`/chapters/${id}`);
    list.value = list.value.filter((c) => c.id !== id);
  }

  return { list, fetchList, create, get, update, setStatus, remove };
});