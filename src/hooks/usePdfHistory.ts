import { useCallback, useEffect, useRef, useState } from 'react';
import type { PDFDocumentState } from '../types/pdf';

/**
 * Upper bound on retained undo snapshots.
 *
 * A snapshot is a shallow copy of the document state, so the PDF `ArrayBuffer`
 * is shared by reference and never duplicated. What does grow per snapshot is
 * the annotation map, so the cap keeps a long editing session bounded. Without
 * it, every pointer move of a drag or an eraser sweep appended a full snapshot
 * and the tab grew until it ran out of memory.
 */
export const MAX_HISTORY_LENGTH = 100;

interface HistoryState {
  /** The document currently rendered by the app. */
  docState: PDFDocumentState;
  /** Undo stack, oldest first. `snapshots[index]` is always the current state. */
  snapshots: PDFDocumentState[];
  /** Cursor into `snapshots`. */
  index: number;
  /**
   * The document exactly as it was last loaded from disk or last written to it,
   * or `null` when it has diverged from any known saved state.
   *
   * Tracked by reference rather than by cursor index: every mutation produces a
   * fresh object, so identity is both a correct and an O(1) "has unsaved
   * changes" test. An index comparison would wrongly report "clean" whenever a
   * transient update replaced the snapshot sitting at the saved position.
   */
  savedDoc: PDFDocumentState | null;
  /**
   * The undo step currently being rewritten in place, or `null` when no gesture
   * is open.
   *
   * The first in-place update of a gesture opens a fresh step; later updates
   * carrying the same `key` overwrite that same step. A drag or an eraser sweep
   * therefore costs exactly one Ctrl+Z, and — critically — the state from
   * *before* the gesture survives at `index - 1` instead of being overwritten.
   *
   * Keying on an explicit token (rather than merely "a step is open") keeps a
   * discrete edit that happens to follow a gesture from being swallowed into it.
   */
  openGesture: { index: number; key: string } | null;
}

/** Append `next` after dropping the redo tail, then enforce the length cap. */
function commit(base: PDFDocumentState[], next: PDFDocumentState): Pick<HistoryState, 'snapshots' | 'index'> {
  const grown = [...base, next];
  const overflow = grown.length - MAX_HISTORY_LENGTH;
  return overflow > 0
    ? { snapshots: grown.slice(overflow), index: MAX_HISTORY_LENGTH - 1 }
    : { snapshots: grown, index: grown.length - 1 };
}

export function usePdfHistory(initialState: PDFDocumentState) {
  const [state, setState] = useState<HistoryState>(() => ({
    docState: initialState,
    snapshots: [initialState],
    index: 0,
    savedDoc: initialState,
    openGesture: null,
  }));

  // Mirror of the latest committed state, so `undo`/`redo` can decide whether a
  // step is available *before* scheduling the transition. Reading the cursor
  // inside the updater instead would force the caller's side effect to run
  // inside it, which React may invoke twice under StrictMode.
  const latest = useRef(state);
  useEffect(() => {
    latest.current = state;
  }, [state]);

  const { docState, snapshots, index } = state;

  const isDirty = docState !== state.savedDoc;
  const canUndo = index > 0;
  const canRedo = index < snapshots.length - 1;

  /** Load a document and discard any previous history (open / tab switch). */
  const initHistory = useCallback((next: PDFDocumentState) => {
    setState({ docState: next, snapshots: [next], index: 0, savedDoc: next, openGesture: null });
  }, []);

  /**
   * Record the current state as the saved baseline (after a successful write).
   * Leaves the undo stack intact so the user can still step back past the save.
   */
  const markSaved = useCallback(() => {
    setState((prev) => (prev.savedDoc === prev.docState ? prev : { ...prev, savedDoc: prev.docState }));
  }, []);

  /**
   * Flag the document as diverged from its saved baseline without recording an
   * undo step. For edits that replace the document wholesale — writing new PDF
   * bytes back and re-parsing them, for instance.
   */
  const markDirty = useCallback(() => {
    setState((prev) => (prev.savedDoc === null ? prev : { ...prev, savedDoc: null }));
  }, []);

  /**
   * Apply a mutation and record it as a new undo step.
   *
   * The updater stays pure and the whole transition happens in a single
   * `setState` call, so it is safe under StrictMode double-invocation and two
   * updates landing in the same tick cannot interleave their history writes.
   */
  const updateDocWithHistory = useCallback((updater: (prev: PDFDocumentState) => PDFDocumentState) => {
    setState((prev) => {
      const next = updater(prev.docState);
      if (next === prev.docState) return prev; // updater opted out
      return {
        ...prev,
        docState: next,
        ...commit(prev.snapshots.slice(0, prev.index + 1), next),
        openGesture: null,
      };
    });
  }, []);

  /**
   * Apply a mutation as part of a continuous gesture — dragging an annotation,
   * sweeping the eraser — which fires on every pointer move.
   *
   * The first call for a given `gestureKey` commits a new step; every later call
   * with the same key rewrites it, so undoing once reverts the whole gesture and
   * the pre-gesture document is never overwritten. Calls with a different key
   * start their own step.
   */
  const updateDocInPlace = useCallback(
    (updater: (prev: PDFDocumentState) => PDFDocumentState, gestureKey: string) => {
      setState((prev) => {
        const next = updater(prev.docState);
        if (next === prev.docState) return prev;

        if (prev.openGesture?.index === prev.index && prev.openGesture.key === gestureKey) {
          const snapshots = prev.snapshots.slice();
          snapshots[prev.index] = next;
          return { ...prev, docState: next, snapshots };
        }

        const head = commit(prev.snapshots.slice(0, prev.index + 1), next);
        return { ...prev, docState: next, ...head, openGesture: { index: head.index, key: gestureKey } };
      });
    },
    [],
  );

  /**
   * Apply a mutation with no history bookkeeping — for changes that are not
   * user edits, such as adopting the filename chosen in a Save As dialog.
   */
  const updateDocSilently = useCallback((updater: (prev: PDFDocumentState) => PDFDocumentState) => {
    setState((prev) => {
      const next = updater(prev.docState);
      return next === prev.docState ? prev : { ...prev, docState: next };
    });
  }, []);

  const undo = useCallback((onAfterUndo?: () => void) => {
    if (latest.current.index <= 0) return;
    onAfterUndo?.();
    setState((prev) => {
      if (prev.index <= 0) return prev;
      const target = prev.snapshots[prev.index - 1];
      return target === undefined
        ? prev
        : { ...prev, docState: target, index: prev.index - 1, openGesture: null };
    });
  }, []);

  const redo = useCallback((onAfterRedo?: () => void) => {
    const last = latest.current.snapshots.length - 1;
    if (latest.current.index >= last) return;
    onAfterRedo?.();
    setState((prev) => {
      if (prev.index >= prev.snapshots.length - 1) return prev;
      const target = prev.snapshots[prev.index + 1];
      return target === undefined
        ? prev
        : { ...prev, docState: target, index: prev.index + 1, openGesture: null };
    });
  }, []);

  return {
    docState,
    isDirty,
    canUndo,
    canRedo,
    initHistory,
    markSaved,
    markDirty,
    updateDocWithHistory,
    updateDocInPlace,
    updateDocSilently,
    undo,
    redo,
  };
}
