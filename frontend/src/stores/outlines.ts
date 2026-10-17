import { defineStore } from "pinia";
import { ref } from "vue";

import { api } from "../api/client";

export interface Outline {
  id: number;
  workId: number;
  parentId: number | null;
  title: string;
  content: string;
  sortNo: number;
  updatedAt: number;
}

export const useOutlinesStore = defineStore("outlines", () => {
  const outlines = ref<Outline[]>([]);
  let workId = 0;

  async function fetchList(wid: number) {
    workId = wid;
    const { outlines: list } = await api.get<{ outlines: Outline[] }>(`/works/${wid}/outlines`);
    outlines.value = list;
  }

  /** 组树：返回 [{ node, children }]，根 = parentId null */
  function tree(): { node: Outline; children: ReturnType<typeof tree> }[] {
    const byParent = new Map<number | null, Outline[]>();
    for (const o of outlines.value) {
      const key = o.parentId;
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key)!.push(o);
    }
    const build = (parent: number | null): { node: Outline; children: ReturnType<typeof tree> }[] =>
      (byParent.get(parent) ?? []).map((o) => ({ node: o, children: build(o.id) }));
    return build(null);
  }

  async function create(input: { title: string; content?: string; parentId?: number | null }) {
    return api.post<{ outline: Outline }>(`/works/${workId}/outlines`, input);
  }

  async function update(id: number, patch: { title?: string; content?: string }) {
    return api.patch<{ outline: Outline }>(`/outlines/${id}`, patch);
  }

  async function remove(id: number) {
    await api.delete<{ ok: true }>(`/outlines/${id}`);
  }

  return { outlines, fetchList, tree, create, update, remove };
});