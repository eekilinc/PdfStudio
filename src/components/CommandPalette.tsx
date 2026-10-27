import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  FolderOpen, 
  Save, 
  Download, 
  Printer, 
  Info, 
  MousePointer, 
  FileEdit, 
  Type, 
  PenTool, 
  Highlighter, 
  PenSquare, 
  Stamp, 
  EyeOff, 
  Eraser, 
  Ruler, 
  CheckSquare, 
  ScanText, 
  Layers, 
  Scissors, 
  GitCompare, 
  Hash, 
  FileSpreadsheet, 
  FileText,
  Presentation,
  ImageIcon, 
  Minimize2, 
  Lock, 
  LayoutGrid, 
  Maximize2, 
  Sun, 
  Moon, 
  Eye, 
  Settings as SettingsIcon,
  Plus,
  MessageSquare,
  ScanSearch,
  Link2,
  Accessibility,
  FileBadge,
  Bookmark as BookmarkIcon,
  FileText as FileTextIcon
} from 'lucide-react';
import type { ToolType, ReaderFilter } from '../types/pdf';
import { t } from '../utils/i18n';

interface CommandItem {
  id: string;
  title: string;
  category: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  // Actions
  onOpenNativePdf: () => void;
  onSavePdf: () => void;
  onSaveAsPdf: () => void;
  onPrint: () => void;
  onOpenProperties: () => void;
  onSelectTool: (tool: ToolType) => void;
  onOpenSignatureModal: () => void;
  onOpenStampModal: () => void;
  onOpenOcrModal: () => void;
  onOpenMergeModal: () => void;
  onOpenSplitModal: () => void;
  onOpenCompareModal: () => void;
  onOpenWatermarkModal: () => void;
  onOpenPageNumberingModal: () => void;
  onOpenExportOfficeModal: () => void;
  onOpenExportImageModal: () => void;
  onOpenCompressModal: () => void;
  onOpenSecurityModal: () => void;
  onOpenOrganizeModal: () => void;
  onOpenSettingsModal: () => void;
  onOpenInspectorModal: () => void;
  onOpenPageSetupModal: () => void;
  onOpenAccessibilityModal: () => void;
  onOpenPdfaModal: () => void;
  onOpenPadesModal: () => void;
  onOpenCommentsPanel: () => void;
  onOpenFormsPanel: () => void;
  onOpenLinksPanel: () => void;
  onOpenBookmarksPanel: () => void;
  onAddBlankPage: () => void;
  onToggleFullscreen: () => void;
  onFitPage: () => void;
  onFitWidth: () => void;
  onToggleSearch: () => void;
  onToggleTheme: () => void;
  onReaderFilterChange: (f: ReaderFilter) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onOpenNativePdf,
  onSavePdf,
  onSaveAsPdf,
  onPrint,
  onOpenProperties,
  onSelectTool,
  onOpenSignatureModal,
  onOpenStampModal,
  onOpenOcrModal,
  onOpenMergeModal,
  onOpenSplitModal,
  onOpenCompareModal,
  onOpenWatermarkModal,
  onOpenPageNumberingModal,
  onOpenExportOfficeModal,
  onOpenExportImageModal,
  onOpenCompressModal,
  onOpenSecurityModal,
  onOpenOrganizeModal,
  onOpenSettingsModal,
  onOpenInspectorModal,
  onOpenPageSetupModal,
  onOpenAccessibilityModal,
  onOpenPdfaModal,
  onOpenPadesModal,
  onOpenCommentsPanel,
  onOpenFormsPanel,
  onOpenLinksPanel,
  onOpenBookmarksPanel,
  onAddBlankPage,
  onToggleFullscreen,
  onFitPage,
  onFitWidth,
  onToggleSearch,
  onToggleTheme,
  onReaderFilterChange,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commands: CommandItem[] = [
    // Dosya İşlemleri
    { id: 'open', title: t('cmd.file.open'), category: t('cmd.category.file'), icon: <FolderOpen size={15} />, shortcut: 'Ctrl+O', action: onOpenNativePdf },
    { id: 'save', title: t('cmd.file.save'), category: t('cmd.category.file'), icon: <Save size={15} />, shortcut: 'Ctrl+S', action: onSavePdf },
    { id: 'save-as', title: t('cmd.file.saveAs'), category: t('cmd.category.file'), icon: <Download size={15} />, shortcut: 'Ctrl+Shift+S', action: onSaveAsPdf },
    { id: 'print', title: t('cmd.file.print'), category: t('cmd.category.file'), icon: <Printer size={15} />, shortcut: 'Ctrl+P', action: onPrint },
    { id: 'properties', title: t('cmd.file.properties'), category: t('cmd.category.file'), icon: <Info size={15} />, shortcut: 'Ctrl+D', action: onOpenProperties },

    // Düzenleme & Çizim Araçları
    { id: 'tool-select', title: t('cmd.tool.select'), category: t('cmd.category.tools'), icon: <MousePointer size={15} />, shortcut: 'V', action: () => onSelectTool('select') },
    { id: 'tool-edit-text', title: t('cmd.tool.editText'), category: t('cmd.category.tools'), icon: <FileEdit size={15} color="var(--accent-primary)" />, shortcut: 'E', action: () => onSelectTool('edit-text') },
    { id: 'tool-text', title: t('cmd.tool.text'), category: t('cmd.category.tools'), icon: <Type size={15} />, shortcut: 'T', action: () => onSelectTool('text') },
    { id: 'tool-pen', title: t('cmd.tool.pen'), category: t('cmd.category.tools'), icon: <PenTool size={15} />, shortcut: 'P', action: () => onSelectTool('pen') },
    { id: 'tool-highlighter', title: t('cmd.tool.highlighter'), category: t('cmd.category.tools'), icon: <Highlighter size={15} />, action: () => onSelectTool('highlighter') },
    { id: 'tool-signature', title: t('cmd.tool.signature'), category: t('cmd.category.tools'), icon: <PenSquare size={15} color="var(--accent-primary)" />, action: onOpenSignatureModal },
    { id: 'tool-stamp', title: t('cmd.tool.stamp'), category: t('cmd.category.tools'), icon: <Stamp size={15} color="#e11d48" />, action: onOpenStampModal },
    { id: 'tool-redact', title: t('cmd.tool.redact'), category: t('cmd.category.tools'), icon: <EyeOff size={15} color="#f43f5e" />, action: () => onSelectTool('redact') },
    { id: 'tool-eraser', title: t('cmd.tool.eraser'), category: t('cmd.category.tools'), icon: <Eraser size={15} />, action: () => onSelectTool('eraser') },
    { id: 'tool-measure', title: t('cmd.tool.measure'), category: t('cmd.category.tools'), icon: <Ruler size={15} color="#f59e0b" />, action: () => onSelectTool('measure') },
    { id: 'tool-checkbox', title: t('cmd.tool.checkbox'), category: t('cmd.category.tools'), icon: <CheckSquare size={15} />, action: () => onSelectTool('checkbox') },

    // Belge İşlemleri & Dönüştürme
    { id: 'ocr', title: t('cmd.ocr'), category: t('cmd.category.operations'), icon: <ScanText size={15} color="#10b981" />, action: onOpenOcrModal },
    { id: 'merge', title: t('cmd.merge'), category: t('cmd.category.operations'), icon: <Layers size={15} color="#38bdf8" />, action: onOpenMergeModal },
    { id: 'split', title: t('cmd.split'), category: t('cmd.category.operations'), icon: <Scissors size={15} color="#f43f5e" />, action: onOpenSplitModal },
    { id: 'compare', title: t('cmd.compare'), category: t('cmd.category.operations'), icon: <GitCompare size={15} color="#10b981" />, action: onOpenCompareModal },
    { id: 'watermark', title: t('cmd.watermark'), category: t('cmd.category.operations'), icon: <Stamp size={15} color="#e11d48" />, action: onOpenWatermarkModal },
    { id: 'page-numbers', title: t('cmd.pageNumbers'), category: t('cmd.category.operations'), icon: <Hash size={15} color="#3b82f6" />, action: onOpenPageNumberingModal },
    { id: 'export-office', title: t('cmd.exportOffice'), category: t('cmd.category.operations'), icon: <FileSpreadsheet size={15} color="#3b82f6" />, action: onOpenExportOfficeModal },
    { id: 'export-word', title: t('cmd.exportWord'), category: t('cmd.category.export'), icon: <FileText size={15} color="#2563eb" />, action: onOpenExportOfficeModal },
    { id: 'export-excel', title: t('cmd.exportExcel'), category: t('cmd.category.export'), icon: <FileSpreadsheet size={15} color="#16a34a" />, action: onOpenExportOfficeModal },
    { id: 'export-pptx', title: t('cmd.exportPptx'), category: t('cmd.category.export'), icon: <Presentation size={15} color="#ea580c" />, action: onOpenExportOfficeModal },
    { id: 'export-csv', title: t('cmd.exportCsv'), category: t('cmd.category.export'), icon: <FileSpreadsheet size={15} color="#059669" />, action: onOpenExportOfficeModal },
    { id: 'export-image', title: t('cmd.exportImage'), category: t('cmd.category.operations'), icon: <ImageIcon size={15} color="#10b981" />, action: onOpenExportImageModal },
    { id: 'compress', title: t('cmd.compress'), category: t('cmd.category.operations'), icon: <Minimize2 size={15} color="#f59e0b" />, action: onOpenCompressModal },
    { id: 'security', title: t('cmd.security'), category: t('cmd.category.operations'), icon: <Lock size={15} color="#a855f7" />, action: onOpenSecurityModal },
    { id: 'organize', title: t('cmd.organize'), category: t('cmd.category.operations'), icon: <LayoutGrid size={15} />, action: onOpenOrganizeModal },
    { id: 'add-blank', title: t('cmd.addBlank'), category: t('cmd.category.operations'), icon: <Plus size={15} color="#10b981" />, action: onAddBlankPage },

    // Görünüm & Sistem
    { id: 'fullscreen', title: t('cmd.fullscreen'), category: t('cmd.category.view'), icon: <Maximize2 size={15} />, shortcut: 'F11', action: onToggleFullscreen },
    { id: 'fit-page', title: t('cmd.fitPage'), category: t('cmd.category.view'), icon: <Maximize2 size={15} />, shortcut: 'Ctrl+0', action: onFitPage },
    { id: 'fit-width', title: t('cmd.fitWidth'), category: t('cmd.category.view'), icon: <Maximize2 size={15} />, shortcut: 'Ctrl+1', action: onFitWidth },
    { id: 'search', title: t('cmd.search'), category: t('cmd.category.view'), icon: <Search size={15} />, shortcut: 'Ctrl+F', action: onToggleSearch },
    { id: 'theme', title: t('cmd.theme'), category: t('cmd.category.view'), icon: <Sun size={15} color="#f59e0b" />, action: onToggleTheme },
    { id: 'reader-dark', title: t('cmd.readerDark'), category: t('cmd.category.view'), icon: <Moon size={15} />, action: () => onReaderFilterChange('dark') },
    { id: 'reader-sepia', title: t('cmd.readerSepia'), category: t('cmd.category.view'), icon: <Eye size={15} color="#b45309" />, action: () => onReaderFilterChange('sepia') },
    { id: 'settings', title: t('cmd.settings'), category: t('cmd.category.view'), icon: <SettingsIcon size={15} color="#6366f1" />, action: onOpenSettingsModal },
    { id: 'comments-panel', title: t('cmd.commentsPanel'), category: t('cmd.category.view'), icon: <MessageSquare size={15} color="#f59e0b" />, action: onOpenCommentsPanel },
    { id: 'links-panel', title: t('cmd.linksPanel'), category: t('cmd.category.view'), icon: <Link2 size={15} color="#38bdf8" />, action: onOpenLinksPanel },
    { id: 'bookmarks-panel', title: t('cmd.bookmarksPanel'), category: t('cmd.category.view'), icon: <BookmarkIcon size={15} color="#a855f7" />, action: onOpenBookmarksPanel },
    { id: 'forms-panel', title: t('cmd.formsPanel'), category: t('cmd.category.view'), icon: <FileTextIcon size={15} color="#22c55e" />, action: onOpenFormsPanel },
    { id: 'document-inspector', title: t('cmd.inspector'), category: t('cmd.category.operations'), icon: <ScanSearch size={15} color="#a855f7" />, action: onOpenInspectorModal },
    { id: 'page-setup', title: t('cmd.pageSetup'), category: t('cmd.category.operations'), icon: <Layers size={15} color="#0ea5e9" />, action: onOpenPageSetupModal },
    { id: 'accessibility', title: t('cmd.accessibility'), category: t('cmd.category.operations'), icon: <Accessibility size={15} color="#a855f7" />, action: onOpenAccessibilityModal },
    { id: 'pdfa', title: t('cmd.pdfa'), category: t('cmd.category.operations'), icon: <FileBadge size={15} color="#0ea5e9" />, action: onOpenPdfaModal },
    { id: 'pades', title: t('cmd.pades'), category: t('cmd.category.operations'), icon: <Lock size={15} color="#a855f7" />, action: onOpenPadesModal },
  ];

  const filteredCommands = commands.filter((cmd) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      cmd.title.toLowerCase().includes(q) ||
      cmd.category.toLowerCase().includes(q) ||
      (cmd.shortcut && cmd.shortcut.toLowerCase().includes(q))
    );
  });

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }

  const [prevQuery, setPrevQuery] = useState(query);
  if (query !== prevQuery) {
    setPrevQuery(query);
    setSelectedIndex(0);
  }

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selectedEl = listRef.current.children[selectedIndex] as HTMLElement;
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filteredCommands.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % (filteredCommands.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = filteredCommands[selectedIndex];
      if (target) {
        target.action();
        onClose();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card animate-fade-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '560px',
          width: '92%',
          background: 'var(--bg-panel-solid)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px var(--border-color)',
        }}
      >
        {/* Search Input Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '14px 18px',
          borderBottom: '1px solid var(--border-color)',
        }}>
          <Search size={18} color="var(--accent-primary)" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('cmd.searchPlaceholder')}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: '14px',
              fontWeight: 500,
            }}
          />
          <kbd style={{
            fontSize: '10px',
            background: 'var(--bg-tertiary)',
            color: 'var(--text-muted)',
            padding: '2px 6px',
            borderRadius: '4px',
            border: '1px solid var(--border-color)',
            fontFamily: 'monospace',
          }}>
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div 
          ref={listRef}
          style={{
            maxHeight: '340px',
            overflowY: 'auto',
            padding: '6px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          {filteredCommands.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              Eşleşen komut bulunamadı.
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={cmd.id}
                  onClick={() => {
                    cmd.action();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: isSelected ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.1s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                    }}>
                      {cmd.icon}
                    </div>
                    <span style={{
                      fontSize: '13px',
                      fontWeight: isSelected ? 600 : 400,
                      color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                    }}>
                      {cmd.title}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', opacity: 0.8 }}>
                      {cmd.category}
                    </span>
                    {cmd.shortcut && (
                      <kbd style={{
                        fontSize: '10px',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-muted)',
                        padding: '1px 5px',
                        borderRadius: '3px',
                        border: '1px solid var(--border-color)',
                        fontFamily: 'monospace',
                      }}>
                        {cmd.shortcut}
                      </kbd>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Hint */}
        <div style={{
          padding: '8px 16px',
          background: 'var(--bg-secondary)',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: 'var(--text-muted)',
        }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <span><kbd>↑↓</kbd> {t('cmd.navigate')}</span>
            <span><kbd>Enter</kbd> {t('cmd.enterSelect')}</span>
            <span><kbd>Esc</kbd> {t('cmd.escClose')}</span>
          </div>
          <span>{t('cmd.footer')}</span>
        </div>
      </div>
    </div>
  );
};
