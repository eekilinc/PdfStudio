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
      className="flex items-center gap-1.5 px-3 py-1.5 border-b select-none overflow-x-auto no-scrollbar"
      style={{
        backgroundColor: 'var(--header-bg, rgba(15, 23, 42, 0.75))',
        borderColor: 'var(--border-color, rgba(255, 255, 255, 0.08))',
        backdropFilter: 'blur(12px)',
      }}
      role="tablist"
      aria-label="Açık Belgeler"
    >
      <div className="flex items-center gap-1 overflow-x-auto max-w-full">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const displayName = tab.filename || 'İsimsiz Belge';

          return (
            <div
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelectTab(tab.id)}
              className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all duration-150 border max-w-[200px] shrink-0 ${
                isActive
                  ? 'bg-blue-600/20 text-blue-400 border-blue-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border-transparent'
              }`}
              title={tab.filePath || displayName}
            >
              <FileText className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-blue-400' : 'text-slate-500'}`} />
              <span className="truncate max-w-[130px]">{displayName}</span>

              {tab.isDirty && (
                <span
                  className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"
                  title="Kaydedilmemiş değişiklikler var"
                />
              )}

              {tabs.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => onCloseTab(tab.id, e)}
                  aria-label={`${displayName} sekmesini kapat`}
                  className="p-0.5 rounded-md hover:bg-slate-700/60 text-slate-500 hover:text-slate-200 transition-colors shrink-0 ml-0.5"
                >
                  <X className="w-3 h-3" />
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
        className="p-1.5 rounded-lg hover:bg-slate-800/60 text-slate-400 hover:text-slate-200 border border-transparent hover:border-slate-700/40 transition-all shrink-0 ml-1"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
