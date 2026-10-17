import { defineStore } from "pinia";
import { ref } from "vue";

import { api } from "../api/client";

export const FORESHADOW_STATUS: Record<string, string> = {
  open: "未收",
  closed: "已收",
  dropped: "废弃",
};
export type ForeshadowStatus = keyof typeof FORESHADOW_STATUS;

export interface Foreshadow {
  id: number;
  workId: number;
  content: string;
  plantedChapterId: number | null;
  revealChapterId: number | null;
  status: ForeshadowStatus;
  updatedAt: number;
}

export interface TimelineEvent {
  id: number;
  workId: number;
  storyTime: string;
  event: string;
  chapterId: number | null;
  sortNo: number;
  updatedAt: number;
}

export const usePlanningStore = defineStore("planning", () => {
  const foreshadows = ref<Foreshadow[]>([]);
  const timeline = ref<TimelineEvent[]>([]);
  let workId = 0;

  // ---- 伏笔 ----
  async function fetchForeshadows(wid: number) {
    workId = wid;
    const { foreshadows: list } = await api.get<{ foreshadows: Foreshadow[] }>(`/works/${wid}/foreshadows`);
    foreshadows.value = list;
  }

  async function createForeshadow(input: Partial<Foreshadow> & { content: string }) {
    return api.post<{ foreshadow: Foreshadow }>(`/works/${workId}/foreshadows`, input);
  }

  async function updateForeshadow(id: number, patch: Partial<Foreshadow>) {
    return api.patch<{ foreshadow: Foreshadow }>(`/foreshadows/${id}`, patch);
  }

  async function removeForeshadow(id: number) {
    await api.delete<{ ok: true }>(`/foreshadows/${id}`);
  }

  // ---- 时间线 ----
  async function fetchTimeline(wid: number) {
    workId = wid;
    const { timeline: list } = await api.get<{ timeline: TimelineEvent[] }>(`/works/${wid}/timeline`);
    timeline.value = list;
  }

  async function createEvent(input: { storyTime: string; event: string; chapterId?: number | null }) {
    return api.post<{ event: TimelineEvent }>(`/works/${workId}/timeline`, input);
  }

  async function updateEvent(id: number, patch: { storyTime?: string; event?: string; chapterId?: number | null }) {
    return api.patch<{ event: TimelineEvent }>(`/timeline/${id}`, patch);
  }

  async function removeEvent(id: number) {
    await api.delete<{ ok: true }>(`/timeline/${id}`);
  }

  return {
    foreshadows,
    timeline,
    fetchForeshadows,
    createForeshadow,
    updateForeshadow,
    removeForeshadow,
    fetchTimeline,
    createEvent,
    updateEvent,
    removeEvent,
  };
});