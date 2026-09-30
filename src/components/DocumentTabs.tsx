import React from 'react';
import { FileText, Plus, X } from 'lucide-react';
import type { PDFDocumentState } from '../types/pdf';

export interface DocumentTabItem {
  id: string;
  filename: string;
  filePath: string | null;
  docState: PDFDocumentState;
  currentPageIndex: number;
  isDirty: boolean;
}

interface DocumentTabsProps {
  tabs: DocumentTabItem[];
  activeTabId: string;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string, e: React.MouseEvent) => void;
  onNewTab: () => void;
}

export const DocumentTabs: React.FC<DocumentTabsProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
}) => {
  if (tabs.length === 0) return null;

  return (
    <div
      className="doc-tabs-bar"
      role="tablist"
      aria-label="Açık Belgeler"
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <div
        className="doc-tabs-list"
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const displayName = tab.filename || 'İsimsiz Belge';

          return (
            <div
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelectTab(tab.id)}
              className={`doc-tab-item ${isActive ? 'active' : ''}`}
              title={tab.filePath || displayName}
              style={{
                display: 'inline-flex',
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <FileText
                size={14}
                style={{
                  color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)',
                  flexShrink: 0,
                }}
              />
              <span className="doc-tab-title">{displayName}</span>

              {tab.isDirty && (
                <span
                  className="doc-tab-dirty-indicator"
                  title="Kaydedilmemiş değişiklikler var"
                />
              )}

              {tabs.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => onCloseTab(tab.id, e)}
                  aria-label={`${displayName} sekmesini kapat`}
                  className="doc-tab-close-btn"
                  title="Sekmeyi Kapat"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onNewTab}
        aria-label="Yeni Belge Aç"
        title="Yeni Belge Aç / Ekle"
        className="doc-tab-add-btn"
      >
        <Plus size={14} />
      </button>
    </div>
  );
};
