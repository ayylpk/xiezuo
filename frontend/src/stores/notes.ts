import { defineStore } from "pinia";
import { ref } from "vue";

import { api } from "../api/client";

/** 随笔三型（与后端 schema.ts 的 NOTE_TYPES 一致） */
export const NOTE_TYPES: Record<string, string> = {
  note: "随笔",
  idea: "灵感",
  graveyard: "废弃段落",
};
export type NoteType = keyof typeof NOTE_TYPES;

export interface Note {
  id: number;
  workId: number;
  type: NoteType;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export const useNotesStore = defineStore("notes", () => {
  const list = ref<Note[]>([]);

  /** 一次拉全量，tab 过滤在视图层做（数据量小，避免反复请求） */
  async function fetchList(workId: number) {
    const { notes } = await api.get<{ notes: Note[] }>(`/works/${workId}/notes`);
    list.value = notes;
  }

  async function create(workId: number, input: { type: NoteType; title?: string; content: string }) {
    return api.post<{ note: Note }>(`/works/${workId}/notes`, input);
  }

  async function update(id: number, patch: Partial<Pick<Note, "type" | "title" | "content">>) {
    return api.patch<{ note: Note }>(`/notes/${id}`, patch);
  }

  async function remove(id: number) {
    await api.delete<{ ok: true }>(`/notes/${id}`);
    list.value = list.value.filter((n) => n.id !== id);
  }

  return { list, fetchList, create, update, remove };
});