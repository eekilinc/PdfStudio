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
  Plus
} from 'lucide-react';
import type { ToolType, ReaderFilter } from '../types/pdf';

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
    { id: 'open', title: 'PDF Belgesi Aç', category: 'Dosya', icon: <FolderOpen size={15} />, shortcut: 'Ctrl+O', action: onOpenNativePdf },
    { id: 'save', title: 'Belgeyi Kaydet', category: 'Dosya', icon: <Save size={15} />, shortcut: 'Ctrl+S', action: onSavePdf },
    { id: 'save-as', title: 'Farklı Kaydet...', category: 'Dosya', icon: <Download size={15} />, shortcut: 'Ctrl+Shift+S', action: onSaveAsPdf },
    { id: 'print', title: 'Yazdır', category: 'Dosya', icon: <Printer size={15} />, shortcut: 'Ctrl+P', action: onPrint },
    { id: 'properties', title: 'Belge Özellikleri & Meta Veriler', category: 'Dosya', icon: <Info size={15} />, shortcut: 'Ctrl+D', action: onOpenProperties },

    // Düzenleme & Çizim Araçları
    { id: 'tool-select', title: 'Seç & Taşı & Kopyala', category: 'Araçlar', icon: <MousePointer size={15} />, shortcut: 'V', action: () => onSelectTool('select') },
    { id: 'tool-edit-text', title: 'PDF Metnini Doğrudan Düzenle', category: 'Araçlar', icon: <FileEdit size={15} color="var(--accent-primary)" />, shortcut: 'E', action: () => onSelectTool('edit-text') },
    { id: 'tool-text', title: 'Yeni Metin Ekle', category: 'Araçlar', icon: <Type size={15} />, shortcut: 'T', action: () => onSelectTool('text') },
    { id: 'tool-pen', title: 'Serbest Çizim Kalemi', category: 'Araçlar', icon: <PenTool size={15} />, shortcut: 'P', action: () => onSelectTool('pen') },
    { id: 'tool-highlighter', title: 'Fosforlu Vurgulayıcı Kalem', category: 'Araçlar', icon: <Highlighter size={15} />, action: () => onSelectTool('highlighter') },
    { id: 'tool-signature', title: 'Dijital El Yazısı İmza Ekle', category: 'Araçlar', icon: <PenSquare size={15} color="var(--accent-primary)" />, action: onOpenSignatureModal },
    { id: 'tool-stamp', title: 'Kurumsal Kaşe & Onay Damgası Ekle', category: 'Araçlar', icon: <Stamp size={15} color="#e11d48" />, action: onOpenStampModal },
    { id: 'tool-redact', title: 'Hassas Verileri Karart & Gizle (Redaction)', category: 'Araçlar', icon: <EyeOff size={15} color="#f43f5e" />, action: () => onSelectTool('redact') },
    { id: 'tool-eraser', title: 'Silgi (Açıklamaları Sil)', category: 'Araçlar', icon: <Eraser size={15} />, action: () => onSelectTool('eraser') },
    { id: 'tool-measure', title: 'Cetvel / Mesafe Ölçüm Aracı', category: 'Araçlar', icon: <Ruler size={15} color="#f59e0b" />, action: () => onSelectTool('measure') },
    { id: 'tool-checkbox', title: 'İnteraktif Onay Kutusu Ekle', category: 'Araçlar', icon: <CheckSquare size={15} />, action: () => onSelectTool('checkbox') },

    // Belge İşlemleri & Dönüştürme
    { id: 'ocr', title: 'OCR Taranmış Belgeyi Oku & Metne Çevir', category: 'İşlemler', icon: <ScanText size={15} color="#10b981" />, action: onOpenOcrModal },
    { id: 'merge', title: 'Birden Fazla PDF\'i Birleştir', category: 'İşlemler', icon: <Layers size={15} color="#38bdf8" />, action: onOpenMergeModal },
    { id: 'split', title: 'Sayfaları Böl & Dışa Ayıkla', category: 'İşlemler', icon: <Scissors size={15} color="#f43f5e" />, action: onOpenSplitModal },
    { id: 'compare', title: 'İki PDF Belgesini Yan Yana Karşılaştır', category: 'İşlemler', icon: <GitCompare size={15} color="#10b981" />, action: onOpenCompareModal },
    { id: 'watermark', title: 'Filigran (Watermark) Ekle', category: 'İşlemler', icon: <Stamp size={15} color="#e11d48" />, action: onOpenWatermarkModal },
    { id: 'page-numbers', title: 'Sayfa Numaralandırma Şablonu Ekle', category: 'İşlemler', icon: <Hash size={15} color="#3b82f6" />, action: onOpenPageNumberingModal },
    { id: 'export-office', title: 'Ofis Formatlarına Dışa Aktarma Merkezi (Word, Excel, PPT, CSV, MD)', category: 'İşlemler', icon: <FileSpreadsheet size={15} color="#3b82f6" />, action: onOpenExportOfficeModal },
    { id: 'export-word', title: 'Microsoft Word Belgesine Dönüştür (.docx)', category: 'Dışa Aktar', icon: <FileText size={15} color="#2563eb" />, action: onOpenExportOfficeModal },
    { id: 'export-excel', title: 'Microsoft Excel Tablosuna Dönüştür (.xlsx)', category: 'Dışa Aktar', icon: <FileSpreadsheet size={15} color="#16a34a" />, action: onOpenExportOfficeModal },
    { id: 'export-pptx', title: 'PowerPoint Sunumuna Dönüştür (.pptx)', category: 'Dışa Aktar', icon: <Presentation size={15} color="#ea580c" />, action: onOpenExportOfficeModal },
    { id: 'export-csv', title: 'CSV Veri Tablosu Olarak Kaydet (.csv)', category: 'Dışa Aktar', icon: <FileSpreadsheet size={15} color="#059669" />, action: onOpenExportOfficeModal },
    { id: 'export-image', title: 'Sayfaları Resim Olarak Kaydet (PNG/JPG)', category: 'İşlemler', icon: <ImageIcon size={15} color="#10b981" />, action: onOpenExportImageModal },
    { id: 'compress', title: 'PDF Boyutunu Küçült & Optimize Et', category: 'İşlemler', icon: <Minimize2 size={15} color="#f59e0b" />, action: onOpenCompressModal },
    { id: 'security', title: 'AES-256 Parola ile Şifrele & İzinleri Kısıtla', category: 'İşlemler', icon: <Lock size={15} color="#a855f7" />, action: onOpenSecurityModal },
    { id: 'organize', title: 'Sayfa Sıralama, Çoğaltma & Silme', category: 'İşlemler', icon: <LayoutGrid size={15} />, action: onOpenOrganizeModal },
    { id: 'add-blank', title: 'A4 Temiz Boş Sayfa Ekle', category: 'İşlemler', icon: <Plus size={15} color="#10b981" />, action: onAddBlankPage },

    // Görünüm & Sistem
    { id: 'fullscreen', title: 'Tam Ekran Sunum & Okuma Modu', category: 'Görünüm', icon: <Maximize2 size={15} />, shortcut: 'F11', action: onToggleFullscreen },
    { id: 'fit-page', title: 'Sayfaya Sığdır (Fit to Page)', category: 'Görünüm', icon: <Maximize2 size={15} />, shortcut: 'Ctrl+0', action: onFitPage },
    { id: 'fit-width', title: 'Genişliğe Sığdır (Fit to Width)', category: 'Görünüm', icon: <Maximize2 size={15} />, shortcut: 'Ctrl+1', action: onFitWidth },
    { id: 'search', title: 'PDF İçinde Kelime Ara', category: 'Görünüm', icon: <Search size={15} />, shortcut: 'Ctrl+F', action: onToggleSearch },
    { id: 'theme', title: 'Açık / Karanlık Tema Değiştir', category: 'Görünüm', icon: <Sun size={15} color="#f59e0b" />, action: onToggleTheme },
    { id: 'reader-dark', title: 'Göz Yormayan Gece Modu Filtresi', category: 'Görünüm', icon: <Moon size={15} />, action: () => onReaderFilterChange('dark') },
    { id: 'reader-sepia', title: 'Sıcak Kitap Kağıdı Sepia Filtresi', category: 'Görünüm', icon: <Eye size={15} color="#b45309" />, action: () => onReaderFilterChange('sepia') },
    { id: 'settings', title: 'Uygulama Ayarları & Tercihler', category: 'Görünüm', icon: <SettingsIcon size={15} color="#6366f1" />, action: onOpenSettingsModal },
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
            placeholder="Bir komut veya araç arayın... (Örn: İmza, OCR, Birleştir, Word)"
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
            <span><kbd>↑↓</kbd> Gezin</span>
            <span><kbd>Enter</kbd> Seç</span>
            <span><kbd>Esc</kbd> Kapat</span>
          </div>
          <span>PDF Studio Pro Command Palette</span>
        </div>
      </div>
    </div>
  );
};
