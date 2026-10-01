import { useState, useCallback } from 'react';
import type { PDFDocumentState } from '../types/pdf';
import type { DocumentTabItem } from '../components/DocumentTabs';

export function useDocumentTabs() {
  const [tabs, setTabs] = useState<DocumentTabItem[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');

  const addTab = useCallback((filename: string, filePath: string | null, docState: PDFDocumentState): string => {
    const id = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newTab: DocumentTabItem = {
      id,
      filename,
      filePath,
      docState,
      currentPageIndex: 0,
      isDirty: false,
    };
    setTabs((prev) => {
      const filtered = prev.filter((t) => t.docState.data !== null);
      return [...filtered, newTab];
    });
    setActiveTabId(id);
    return id;
  }, []);

  const updateActiveTabDoc = useCallback((docState: PDFDocumentState, isDirty?: boolean, currentPageIndex?: number) => {
    setTabs((prev) =>
      prev.map((tab) => {
        if (tab.id === activeTabId) {
          return {
            ...tab,
            filename: docState.filename || tab.filename,
            docState,
            ...(isDirty !== undefined ? { isDirty } : {}),
            ...(currentPageIndex !== undefined ? { currentPageIndex } : {}),
          };
        }
        return tab;
      })
    );
  }, [activeTabId]);

  const clearAllTabs = useCallback(() => {
    setTabs([]);
    setActiveTabId('');
  }, []);

  return {
    tabs,
    setTabs,
    activeTabId,
    setActiveTabId,
    addTab,
    updateActiveTabDoc,
    clearAllTabs,
  };
}
