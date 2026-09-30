import { describe, it, expect } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useDocumentTabs } from '../hooks/useDocumentTabs';
import type { PDFDocumentState } from '../types/pdf';

const dummyDoc: PDFDocumentState = {
  filename: 'test.pdf',
  fileSize: 100,
  data: new ArrayBuffer(10),
  numPages: 1,
  pages: [],
  pageOrder: [0],
  annotations: {},
};

import { useEffect } from 'react';

describe('useDocumentTabs hook', () => {
  it('should add, switch, update, and clear tabs', () => {
    let hookResult: ReturnType<typeof useDocumentTabs> | null = null;

    function TestComponent() {
      const res = useDocumentTabs();
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

    expect(hookResult?.tabs.length).toBe(0);

    // Add first tab
    let tabId1 = '';
    act(() => {
      tabId1 = hookResult!.addTab('doc1.pdf', '/path/doc1.pdf', dummyDoc);
    });

    expect(hookResult?.tabs.length).toBe(1);
    expect(hookResult?.activeTabId).toBe(tabId1);

    // Add second tab
    let tabId2 = '';
    act(() => {
      tabId2 = hookResult!.addTab('doc2.pdf', '/path/doc2.pdf', dummyDoc);
    });

    expect(hookResult?.tabs.length).toBe(2);
    expect(hookResult?.activeTabId).toBe(tabId2);

    // Switch tab
    act(() => {
      hookResult!.setActiveTabId(tabId1);
    });
    expect(hookResult?.activeTabId).toBe(tabId1);

    // Update active tab doc
    act(() => {
      hookResult!.updateActiveTabDoc({ ...dummyDoc, filename: 'doc1_updated.pdf' }, true, 0);
    });

    expect(hookResult?.tabs.find((t) => t.id === tabId1)?.filename).toBe('doc1_updated.pdf');
    expect(hookResult?.tabs.find((t) => t.id === tabId1)?.isDirty).toBe(true);

    // Clear all tabs
    act(() => {
      hookResult!.clearAllTabs();
    });

    expect(hookResult?.tabs.length).toBe(0);
    expect(hookResult?.activeTabId).toBe('');
  });
});
