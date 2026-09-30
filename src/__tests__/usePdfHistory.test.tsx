import { describe, it, expect } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { usePdfHistory } from '../hooks/usePdfHistory';
import type { PDFDocumentState } from '../types/pdf';

const dummyDoc1: PDFDocumentState = {
  filename: 'doc1.pdf',
  fileSize: 1000,
  data: null,
  numPages: 1,
  pages: [],
  pageOrder: [0],
  annotations: {},
};

const dummyDoc2: PDFDocumentState = {
  ...dummyDoc1,
  filename: 'doc2.pdf',
};

import { useEffect } from 'react';

describe('usePdfHistory hook', () => {
  it('should initialize with initial state and support undo/redo', () => {
    let hookResult: ReturnType<typeof usePdfHistory> | null = null;

    function TestComponent() {
      const res = usePdfHistory(dummyDoc1);
      useEffect(() => {
        hookResult = res;
      });
      return null;
    }

    const container = document.createElement('div');
    const root = createRoot(container);

    act(() => {
      root.render(<TestComponent />);
    });

    expect(hookResult).not.toBeNull();
    expect(hookResult?.docState.filename).toBe('doc1.pdf');
    expect(hookResult?.canUndo).toBe(false);
    expect(hookResult?.canRedo).toBe(false);
    expect(hookResult?.isDirty).toBe(false);

    // Initialise history explicitly
    act(() => {
      hookResult?.initHistory(dummyDoc1);
    });

    expect(hookResult?.canUndo).toBe(false);

    // Push state update
    act(() => {
      hookResult?.updateDocWithHistory(() => dummyDoc2);
    });

    expect(hookResult?.docState.filename).toBe('doc2.pdf');
    expect(hookResult?.canUndo).toBe(true);
    expect(hookResult?.canRedo).toBe(false);
    expect(hookResult?.isDirty).toBe(true);

    // Perform Undo
    act(() => {
      hookResult?.undo();
    });

    expect(hookResult?.docState.filename).toBe('doc1.pdf');
    expect(hookResult?.canUndo).toBe(false);
    expect(hookResult?.canRedo).toBe(true);

    // Perform Redo
    act(() => {
      hookResult?.redo();
    });

    expect(hookResult?.docState.filename).toBe('doc2.pdf');
    expect(hookResult?.canUndo).toBe(true);
    expect(hookResult?.canRedo).toBe(false);
  });
});
