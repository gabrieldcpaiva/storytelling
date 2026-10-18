import { useCallback, useEffect, useState } from 'react';
import { Project, validateProject } from './model';
import { sampleProjects } from './samples';

const STORAGE_KEY = 'immersive-story-engine:workspace:v1';
interface Store {
  projects: Project[];
  activeId: string;
  undo: Project[];
  redo: Project[];
}
function initialStore(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (
        data.version === 1 &&
        Array.isArray(data.projects) &&
        data.projects.length > 0 &&
        data.projects.length <= 100 &&
        data.projects.every(validateProject)
      ) {
        return {
          projects: data.projects,
          activeId: data.projects.some((p: Project) => p.id === data.activeId)
            ? data.activeId
            : data.projects[0].id,
          undo: [],
          redo: [],
        };
      }
    }
  } catch {
    /* A damaged or unavailable local store never blocks the editor. */
  }
  return { projects: sampleProjects(), activeId: 'frozen-light', undo: [], redo: [] };
}

export function useStudio() {
  const [store, setStore] = useState<Store>(initialStore);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
  const project = store.projects.find((p) => p.id === store.activeId)!;
  useEffect(() => {
    setSaveState('saving');
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ version: 1, projects: store.projects, activeId: store.activeId }),
        );
        setSaveState('saved');
      } catch {
        setSaveState('error');
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [store.projects, store.activeId]);

  const mutate = useCallback((recipe: (project: Project) => void) => {
    setStore((previous) => {
      const current = previous.projects.find((p) => p.id === previous.activeId)!;
      const next = structuredClone(current);
      recipe(next);
      if (JSON.stringify(next) === JSON.stringify(current)) return previous;
      return {
        ...previous,
        projects: previous.projects.map((p) => (p.id === previous.activeId ? next : p)),
        undo: [...previous.undo.slice(-49), current],
        redo: [],
      };
    });
  }, []);

  const switchProject = useCallback(
    (id: string) =>
      setStore((s) =>
        s.projects.some((p) => p.id === id) ? { ...s, activeId: id, undo: [], redo: [] } : s,
      ),
    [],
  );
  const addProject = useCallback(
    (project: Project) =>
      setStore((s) => ({
        ...s,
        projects: [...s.projects, project],
        activeId: project.id,
        undo: [],
        redo: [],
      })),
    [],
  );
  const undo = useCallback(
    () =>
      setStore((s) => {
        const last = s.undo.at(-1);
        if (!last) return s;
        const current = s.projects.find((p) => p.id === s.activeId)!;
        return {
          ...s,
          projects: s.projects.map((p) => (p.id === s.activeId ? last : p)),
          undo: s.undo.slice(0, -1),
          redo: [...s.redo, current],
        };
      }),
    [],
  );
  const redo = useCallback(
    () =>
      setStore((s) => {
        const next = s.redo.at(-1);
        if (!next) return s;
        const current = s.projects.find((p) => p.id === s.activeId)!;
        return {
          ...s,
          projects: s.projects.map((p) => (p.id === s.activeId ? next : p)),
          undo: [...s.undo, current],
          redo: s.redo.slice(0, -1),
        };
      }),
    [],
  );
  return {
    project,
    projects: store.projects,
    mutate,
    switchProject,
    addProject,
    undo,
    redo,
    canUndo: store.undo.length > 0,
    canRedo: store.redo.length > 0,
    saveState,
  };
}

export type Mutate = (recipe: (project: Project) => void) => void;
export type Notify = (message: string, kind?: 'success' | 'error' | 'info') => void;
