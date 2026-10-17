import { defineStore } from "pinia";
import { ref } from "vue";

import { api } from "../api/client";

/** 批注可以挂的实体类型（与后端 ANNOTATION_TARGETS 一致） */
export const ANNOTATION_TARGETS = ["chapter", "entity", "outline", "foreshadow", "timeline", "note"] as const;
export type AnnotationTarget = (typeof ANNOTATION_TARGETS)[number];

export interface Annotation {
  id: number;
  entityType: AnnotationTarget;
  entityId: number;
  content: string;
  createdAt: number;
  updatedAt: number;
}

/** 批注 store：当前只挂在章节上（出版社），backend 已支持任意实体 */
export const useAnnotationsStore = defineStore("annotations", () => {
  const list = ref<Annotation[]>([]);

  async function fetchByTarget(entityType: AnnotationTarget, entityId: number) {
    const { annotations } = await api.get<{ annotations: Annotation[] }>(
      `/annotations?entityType=${entityType}&entityId=${entityId}`,
    );
    list.value = annotations;
  }

  async function create(entityType: AnnotationTarget, entityId: number, content: string) {
    const { annotation } = await api.post<{ annotation: Annotation }>("/annotations", { entityType, entityId, content });
    list.value.push(annotation);
    return annotation;
  }

  async function update(id: number, content: string) {
    const { annotation } = await api.patch<{ annotation: Annotation }>(`/annotations/${id}`, { content });
    const idx = list.value.findIndex((a) => a.id === id);
    if (idx >= 0) list.value[idx] = annotation;
    return annotation;
  }

  async function remove(id: number) {
    await api.delete<{ ok: true }>(`/annotations/${id}`);
    list.value = list.value.filter((a) => a.id !== id);
  }

  return { list, fetchByTarget, create, update, remove };
});