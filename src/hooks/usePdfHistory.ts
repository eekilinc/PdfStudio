import { useState, useCallback } from 'react';
import type { PDFDocumentState } from '../types/pdf';

export function usePdfHistory(initialState: PDFDocumentState) {
  const [docState, setDocState] = useState<PDFDocumentState>(initialState);
  const [history, setHistory] = useState<PDFDocumentState[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [isDirty, setIsDirty] = useState<boolean>(false);

  const initHistory = useCallback((state: PDFDocumentState) => {
    setDocState(state);
    setHistory([state]);
    setHistoryIndex(0);
    setIsDirty(false);
  }, []);

  const updateDocWithHistory = useCallback((updater: (prev: PDFDocumentState) => PDFDocumentState) => {
    setDocState((prev) => {
      const nextState = updater(prev);
      setHistory((prevHist) => {
        const sliced = prevHist.slice(0, historyIndex + 1);
        return [...sliced, nextState];
      });
      setHistoryIndex((prevIdx) => prevIdx + 1);
      setIsDirty(true);
      return nextState;
    });
  }, [historyIndex]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const undo = useCallback((onAfterUndo?: () => void) => {
    if (historyIndex > 0) {
      const targetIndex = historyIndex - 1;
      setDocState(history[targetIndex]);
      setHistoryIndex(targetIndex);
      onAfterUndo?.();
    }
  }, [historyIndex, history]);

  const redo = useCallback((onAfterRedo?: () => void) => {
    if (historyIndex < history.length - 1) {
      const targetIndex = historyIndex + 1;
      setDocState(history[targetIndex]);
      setHistoryIndex(targetIndex);
      onAfterRedo?.();
    }
  }, [historyIndex, history]);

  const resetHistory = useCallback(() => {
    setHistory([]);
    setHistoryIndex(-1);
    setIsDirty(false);
  }, []);

  return {
    docState,
    setDocState,
    history,
    historyIndex,
    isDirty,
    setIsDirty,
    initHistory,
    updateDocWithHistory,
    canUndo,
    canRedo,
    undo,
    redo,
    resetHistory,
  };
}
