import { defineStore } from "pinia";
import { ref } from "vue";

import { api } from "../api/client";

export type WorkStatus = "ongoing" | "finished" | "shelved";

export interface Work {
  id: number;
  title: string;
  description: string;
  status: WorkStatus;
  createdAt: number;
  updatedAt: number;
  chapterCount?: number;
  totalWords?: number;
}

export const useWorksStore = defineStore("works", () => {
  const works = ref<Work[]>([]);
  const loaded = ref(false);

  async function fetchAll() {
    const { works: list } = await api.get<{ works: Work[] }>("/works");
    works.value = list;
    loaded.value = true;
  }

  async function create(title: string, description = "") {
    return api.post<{ work: Work }>("/works", { title, description });
  }

  async function update(id: number, patch: Partial<Pick<Work, "title" | "description" | "status">>) {
    return api.patch<{ work: Work }>(`/works/${id}`, patch);
  }

  async function remove(id: number) {
    await api.delete<{ ok: true }>(`/works/${id}`);
    works.value = works.value.filter((w) => w.id !== id);
  }

  return { works, loaded, fetchAll, create, update, remove };
});