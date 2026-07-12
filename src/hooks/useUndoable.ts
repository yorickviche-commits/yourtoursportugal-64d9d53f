import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Lightweight undo/redo state hook.
 * - `set` pushes previous value onto the undo stack and clears redo.
 * - `reset` replaces value silently (no history push) — for DB hydration / initial loads.
 * - Ctrl+Z / Cmd+Z → undo   |   Ctrl+Shift+Z / Ctrl+Y → redo (when `bindKeyboard` is true and no editable element is focused).
 */
export function useUndoable<T>(initial: T, opts?: { limit?: number; bindKeyboard?: boolean; onUndo?: () => void; onRedo?: () => void }) {
  const limit = opts?.limit ?? 100;
  const bindKeyboard = opts?.bindKeyboard ?? false;
  const [state, setState] = useState<T>(initial);
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  const [version, setVersion] = useState(0); // to trigger re-renders for canUndo/canRedo

  const set = useCallback((next: T | ((prev: T) => T)) => {
    setState(prev => {
      const val = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
      // Skip push if unchanged, or if prev is null/undefined (initial hydration)
      if (Object.is(val, prev)) return prev;
      if (prev !== null && prev !== undefined) {
        past.current.push(prev);
        if (past.current.length > limit) past.current.shift();
        future.current = [];
      }
      return val;
    });
    setVersion(v => v + 1);
  }, [limit]);

  const reset = useCallback((v: T) => {
    past.current = [];
    future.current = [];
    setState(v);
    setVersion(v2 => v2 + 1);
  }, []);

  const undo = useCallback(() => {
    if (past.current.length === 0) return false;
    setState(cur => {
      const p = past.current.pop()!;
      future.current.push(cur);
      return p;
    });
    setVersion(v => v + 1);
    opts?.onUndo?.();
    return true;
  }, [opts]);

  const redo = useCallback(() => {
    if (future.current.length === 0) return false;
    setState(cur => {
      const f = future.current.pop()!;
      past.current.push(cur);
      return f;
    });
    setVersion(v => v + 1);
    opts?.onRedo?.();
    return true;
  }, [opts]);

  useEffect(() => {
    if (!bindKeyboard) return;
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key !== 'z' && key !== 'y') return;
      // Don't hijack native undo inside text fields / editors
      const t = e.target as HTMLElement | null;
      if (t) {
        const tag = t.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable) return;
      }
      if (key === 'z' && !e.shiftKey) {
        if (past.current.length > 0) { e.preventDefault(); undo(); }
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        if (future.current.length > 0) { e.preventDefault(); redo(); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [bindKeyboard, undo, redo]);

  return {
    state,
    set,
    reset,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    _version: version,
  };
}
