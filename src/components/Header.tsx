import React, { useRef, useState, useEffect } from 'react';
import { 
  FileText, 
  FolderOpen, 
  Save,
  Download, 
  Printer, 
  Undo2, 
  Redo2, 
  ZoomIn, 
  ZoomOut, 
  LayoutGrid, 
  Sun, 
  Moon, 
  FilePlus, 
  Layers, 
  Sparkles, 
  HelpCircle, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown,
  Stamp,
  Image as ImageIcon,
  Minimize2,
  Lock,
  Eye,
  Check,
  Scissors,
  Hash,
  GitCompare,
  FileSpreadsheet,
  Settings as SettingsIcon
} from 'lucide-react';
import type { PDFDocumentState, ReaderFilter } from '../types/pdf';

interface HeaderProps {
  docState: PDFDocumentState;
  currentPageNumber: number;
  totalPages: number;
  onPageNumberChange: (pageNumber: number) => void;
  onOpenPdf: (file: File) => void;
  onOpenNativePdf?: () => void;
  onCloseDocument?: () => void;
  onLoadSample: () => void;
  onSavePdf: () => void;
  onSaveAsPdf: () => void;
  onPrint: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  zoom: number;
  onZoomChange: (newZoom: number) => void;
  onFitWidth: () => void;
  onFitPage: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onOpenOrganizeModal: () => void;
  onOpenMergeModal: () => void;
  onOpenSplitModal: () => void;
  onOpenPageNumberingModal: () => void;
  onOpenCompareModal: () => void;
  onOpenAboutModal: () => void;
  onOpenSettingsModal: () => void;
  onOpenWatermarkModal: () => void;
  onOpenExportImageModal: () => void;
  onOpenExportOfficeModal: () => void;
  onOpenSecurityModal: () => void;
  onOpenCompressModal: () => void;
  readerFilter: ReaderFilter;
  onReaderFilterChange: (filter: ReaderFilter) => void;
  isSearchOpen: boolean;
  onToggleSearch: () => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  docState,
  currentPageNumber,
  totalPages,
  onPageNumberChange,
  onOpenPdf,
  onOpenNativePdf,
  onCloseDocument,
  onLoadSample,
  onSavePdf,
  onSaveAsPdf,
  onPrint,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  zoom,
  onZoomChange,
  onFitWidth: _onFitWidth,
  onFitPage,
  theme,
  onToggleTheme,
  onOpenOrganizeModal,
  onOpenMergeModal,
  onOpenSplitModal,
  onOpenPageNumberingModal,
  onOpenCompareModal,
  onOpenAboutModal,
  onOpenSettingsModal,
  onOpenWatermarkModal,
  onOpenExportImageModal,
  onOpenExportOfficeModal,
  onOpenSecurityModal,
  onOpenCompressModal,
  readerFilter,
  onReaderFilterChange,
  isSearchOpen,
  onToggleSearch,
  sidebarOpen,
  onToggleSidebar,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pageInput, setPageInput] = useState(String(currentPageNumber || 1));
  const [prevPageNumber, setPrevPageNumber] = useState(currentPageNumber);
  if (currentPageNumber !== prevPageNumber) {
    setPrevPageNumber(currentPageNumber);
    setPageInput(String(currentPageNumber || 1));
  }
  const [toolsDropdownOpen, setToolsDropdownOpen] = useState(false);
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const toolsMenuRef = useRef<HTMLDivElement>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(e.target as Node)) {
        setToolsDropdownOpen(false);
      }
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) {
        setFilterDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onOpenPdf(e.target.files[0]);
      e.target.value = '';
    }
  };

  const handlePageInputSubmit = () => {
    const num = parseInt(pageInput, 10);
    if (!isNaN(num) && num >= 1 && num <= totalPages) {
      onPageNumberChange(num);
    } else {
      setPageInput(String(currentPageNumber));
    }
  };

  return (
    <header className="glass-panel" style={{
      height: '52px',
      minHeight: '52px',
      display: 'grid',
      gridTemplateColumns: 'auto 1fr auto',
      alignItems: 'center',
      padding: '0 12px',
      zIndex: 100,
      borderBottom: '1px solid var(--border-color)',
      overflow: 'visible',
      gap: '12px',
    }}>
      {/* 1. LEFT SECTION: Brand, Open, Save, Operations */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <button 
          onClick={onToggleSidebar}
          className={`btn-icon ${sidebarOpen ? 'active' : ''}`}
          data-tooltip="Sol Panel (Sayfalar & İçindekiler)"
          style={{ width: '32px', height: '32px' }}
        >
          <Layers size={16} />
        </button>

        {/* Brand Icon & Name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '2px' }}>
          <div style={{
            background: 'var(--accent-gradient)',
            width: '28px',
            height: '28px',
            borderRadius: '7px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-glow)',
            flexShrink: 0,
          }}>
            <FileText size={15} color="#ffffff" />
          </div>
          <div className="header-hide-compact" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontWeight: 700, fontSize: '13px', letterSpacing: '-0.2px', display: 'flex', alignItems: 'center', gap: '4px', lineHeight: 1.1 }}>
              <span>PDF Studio</span>
              <span style={{ 
                fontSize: '9px', 
                background: 'rgba(56, 189, 248, 0.15)', 
                color: 'var(--accent-primary)', 
                padding: '1px 4px', 
                borderRadius: '6px',
                fontWeight: 700
              }}>PRO</span>
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {docState.filename || 'Belge Yok'}
            </div>
          </div>
        </div>

        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileInput} 
          accept="application/pdf" 
          style={{ display: 'none' }} 
        />

        {/* Quick Open Button */}
        <button 
          onClick={onOpenNativePdf || (() => fileInputRef.current?.click())} 
          className="btn-ghost" 
          data-tooltip="PDF Aç (Ctrl+O)"
          style={{ fontSize: '12px', padding: '5px 8px', gap: '5px' }}
        >
          <FolderOpen size={14} />
          <span className="header-btn-label">Aç</span>
        </button>

        {/* Primary Direct Save Button (Ctrl+S) */}
        <button 
          onClick={onSavePdf} 
          className="btn-primary" 
          data-tooltip="Kaydet (Ctrl+S)"
          style={{ fontSize: '12px', padding: '5px 9px', gap: '5px', fontWeight: 600 }}
        >
          <Save size={13} />
          <span>Kaydet</span>
        </button>

        {/* Save As Button (Ctrl+Shift+S) */}
        <button 
          onClick={onSaveAsPdf} 
          className="btn-ghost" 
          data-tooltip="Farklı Kaydet... (Ctrl+Shift+S)"
          style={{ fontSize: '12px', padding: '5px 8px', gap: '4px' }}
        >
          <Download size={13} />
          <span className="header-btn-label">Farklı Kaydet</span>
        </button>

        {/* Unified Operations Dropdown */}
        <div ref={toolsMenuRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setToolsDropdownOpen(!toolsDropdownOpen)}
            className={`btn-ghost ${toolsDropdownOpen ? 'active' : ''}`}
            data-tooltip="Gelişmiş Belge Araçları"
            style={{ fontSize: '12px', padding: '5px 8px', gap: '4px' }}
          >
            <Sparkles size={14} color="var(--accent-primary)" />
            <span className="header-btn-label">İşlemler</span>
            <ChevronDown size={12} style={{ opacity: 0.7 }} />
          </button>

          {toolsDropdownOpen && (
            <div
              className="glass-dropdown animate-fade-in"
              style={{
                position: 'absolute',
                top: '38px',
                left: 0,
                display: 'flex',
                flexDirection: 'column',
                padding: '6px',
                gap: '2px',
                borderRadius: 'var(--radius-md)',
                minWidth: '230px',
                zIndex: 1000,
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              <button
                onClick={() => { onLoadSample(); setToolsDropdownOpen(false); }}
                className="btn-ghost"
                style={{ justifyContent: 'flex-start', padding: '7px 10px', fontSize: '12px', gap: '8px' }}
              >
                <Sparkles size={14} color="var(--accent-primary)" /> Örnek Şablon Yükle
              </button>

              <button
                onClick={() => { onOpenMergeModal(); setToolsDropdownOpen(false); }}
                className="btn-ghost"
                style={{ justifyContent: 'flex-start', padding: '7px 10px', fontSize: '12px', gap: '8px' }}
              >
                <FilePlus size={14} color="#38bdf8" /> PDF'leri Birleştir
              </button>

              <button
                onClick={() => { onOpenSplitModal(); setToolsDropdownOpen(false); }}
                className="btn-ghost"
                style={{ justifyContent: 'flex-start', padding: '7px 10px', fontSize: '12px', gap: '8px' }}
              >
                <Scissors size={14} color="#f43f5e" /> Sayfaları Böl & Ayıkla
              </button>

              <button
                onClick={() => { onOpenPageNumberingModal(); setToolsDropdownOpen(false); }}
                className="btn-ghost"
                style={{ justifyContent: 'flex-start', padding: '7px 10px', fontSize: '12px', gap: '8px' }}
              >
                <Hash size={14} color="#3b82f6" /> Sayfa Numaralandırma
              </button>

              <button
                onClick={() => { onOpenCompareModal(); setToolsDropdownOpen(false); }}
                className="btn-ghost"
                style={{ justifyContent: 'flex-start', padding: '7px 10px', fontSize: '12px', gap: '8px' }}
              >
                <GitCompare size={14} color="#10b981" /> İki PDF'i Karşılaştır
              </button>

              <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }} />

              <button
                onClick={() => { onOpenWatermarkModal(); setToolsDropdownOpen(false); }}
                className="btn-ghost"
                style={{ justifyContent: 'flex-start', padding: '7px 10px', fontSize: '12px', gap: '8px' }}
              >
                <Stamp size={14} color="#e11d48" /> Filigran / Damga Ekle
              </button>

              <button
                onClick={() => { onOpenExportImageModal(); setToolsDropdownOpen(false); }}
                className="btn-ghost"
                style={{ justifyContent: 'flex-start', padding: '7px 10px', fontSize: '12px', gap: '8px' }}
              >
                <ImageIcon size={14} color="#10b981" /> Resim Olarak Kaydet (PNG/JPG)
              </button>

              <button
                onClick={() => { onOpenExportOfficeModal(); setToolsDropdownOpen(false); }}
                className="btn-ghost"
                style={{ justifyContent: 'flex-start', padding: '7px 10px', fontSize: '12px', gap: '8px' }}
              >
                <FileSpreadsheet size={14} color="#3b82f6" /> Ofis Formatlarına Dışa Aktar (Word, Excel, PPT)
              </button>

              <button
                onClick={() => { onOpenCompressModal(); setToolsDropdownOpen(false); }}
                className="btn-ghost"
                style={{ justifyContent: 'flex-start', padding: '7px 10px', fontSize: '12px', gap: '8px' }}
              >
                <Minimize2 size={14} color="#f59e0b" /> Boyut Küçült & Optimize Et
              </button>

              <button
                onClick={() => { onOpenSecurityModal(); setToolsDropdownOpen(false); }}
                className="btn-ghost"
                style={{ justifyContent: 'flex-start', padding: '7px 10px', fontSize: '12px', gap: '8px' }}
              >
                <Lock size={14} color="#a855f7" /> PDF Parola & Şifreleme
              </button>

              <button
                onClick={() => { onOpenSettingsModal(); setToolsDropdownOpen(false); }}
                className="btn-ghost"
                style={{ justifyContent: 'flex-start', padding: '7px 10px', fontSize: '12px', gap: '8px' }}
              >
                <SettingsIcon size={14} color="#6366f1" /> Uygulama Ayarları & Tercihler
              </button>

              {docState.data && onCloseDocument && (
                <>
                  <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }} />
                  <button
                    onClick={() => { onCloseDocument(); setToolsDropdownOpen(false); }}
                    className="btn-ghost"
                    style={{ justifyContent: 'flex-start', padding: '7px 10px', fontSize: '12px', gap: '8px', color: '#f43f5e' }}
                  >
                    <FolderOpen size={14} /> Belgeyi Kapat (Ana Sayfa)
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. CENTER SECTION: Precision Navigator, Undo/Redo & Zoom */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
        {/* Undo / Redo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1px' }}>
          <button 
            onClick={onUndo} 
            disabled={!canUndo} 
            className="btn-icon" 
            data-tooltip="Geri Al (Ctrl+Z)"
            style={{ width: '28px', height: '28px' }}
          >
            <Undo2 size={14} />
          </button>
          <button 
            onClick={onRedo} 
            disabled={!canRedo} 
            className="btn-icon" 
            data-tooltip="Yinele (Ctrl+Y)"
            style={{ width: '28px', height: '28px' }}
          >
            <Redo2 size={14} />
          </button>
        </div>

        <div style={{ height: '16px', width: '1px', background: 'var(--border-color)', margin: '0 2px' }} />

        {/* Page Navigator Pill */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-color)',
          padding: '1px 2px',
        }}>
          <button
            onClick={() => onPageNumberChange(Math.max(1, currentPageNumber - 1))}
            disabled={currentPageNumber <= 1}
            className="btn-icon"
            data-tooltip="Önceki Sayfa"
            style={{ width: '24px', height: '24px' }}
          >
            <ChevronLeft size={14} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', padding: '0 4px', gap: '2px' }}>
            <input
              type="text"
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={handlePageInputSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handlePageInputSubmit();
              }}
              style={{
                width: '26px',
                textAlign: 'center',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '11px',
                fontWeight: 600,
              }}
            />
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>/ {totalPages || 1}</span>
          </div>

          <button
            onClick={() => onPageNumberChange(Math.min(totalPages, currentPageNumber + 1))}
            disabled={currentPageNumber >= totalPages}
            className="btn-icon"
            data-tooltip="Sonraki Sayfa"
            style={{ width: '24px', height: '24px' }}
          >
            <ChevronRight size={14} />
          </button>
        </div>

        <div style={{ height: '16px', width: '1px', background: 'var(--border-color)', margin: '0 2px' }} />

        {/* Zoom Controls Pill */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-color)',
          padding: '1px 2px',
        }}>
          <button 
            onClick={() => onZoomChange(Math.max(0.25, zoom - 0.15))} 
            className="btn-icon" 
            data-tooltip="Uzaklaştır"
            style={{ width: '24px', height: '24px' }}
          >
            <ZoomOut size={13} />
          </button>

          <span 
            onClick={onFitPage}
            data-tooltip="Tıklayın: Sayfaya Sığdır"
            style={{ 
              fontSize: '11px', 
              fontWeight: 600, 
              padding: '0 5px',
              textAlign: 'center',
              fontFamily: 'JetBrains Mono, monospace',
              cursor: 'pointer',
            }}
          >
            {Math.round(zoom * 100)}%
          </span>

          <button 
            onClick={() => onZoomChange(Math.min(4.0, zoom + 0.15))} 
            className="btn-icon" 
            data-tooltip="Yakınlaştır"
            style={{ width: '24px', height: '24px' }}
          >
            <ZoomIn size={13} />
          </button>
        </div>

        <button
          onClick={onToggleSearch}
          className={`btn-icon ${isSearchOpen ? 'active' : ''}`}
          data-tooltip="PDF İçinde Ara (Ctrl+F)"
          style={{ width: '28px', height: '28px' }}
        >
          <Search size={14} color={isSearchOpen ? 'var(--accent-primary)' : 'inherit'} />
        </button>
      </div>

      {/* 3. RIGHT SECTION: Reader Filters, Page Organizer, Print, Theme & Help */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
        {/* Eye Reader Mode Dropdown */}
        <div ref={filterMenuRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setFilterDropdownOpen(!filterDropdownOpen)}
            className={`btn-icon ${readerFilter !== 'normal' ? 'active' : ''}`}
            data-tooltip="Göz Yormayan Okuma Modları"
            style={{ width: '30px', height: '30px' }}
          >
            <Eye size={15} color={readerFilter !== 'normal' ? 'var(--accent-primary)' : 'inherit'} />
          </button>

          {filterDropdownOpen && (
            <div
              className="glass-dropdown animate-fade-in"
              style={{
                position: 'absolute',
                top: '38px',
                right: 0,
                display: 'flex',
                flexDirection: 'column',
                padding: '6px',
                gap: '2px',
                borderRadius: 'var(--radius-md)',
                minWidth: '170px',
                zIndex: 1000,
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              <button
                onClick={() => { onReaderFilterChange('normal'); setFilterDropdownOpen(false); }}
                className={`btn-ghost ${readerFilter === 'normal' ? 'active' : ''}`}
                style={{ justifyContent: 'space-between', padding: '6px 10px', fontSize: '12px' }}
              >
                <span>⚪ Normal Mod</span>
                {readerFilter === 'normal' && <Check size={12} color="var(--accent-primary)" />}
              </button>
              <button
                onClick={() => { onReaderFilterChange('sepia'); setFilterDropdownOpen(false); }}
                className={`btn-ghost ${readerFilter === 'sepia' ? 'active' : ''}`}
                style={{ justifyContent: 'space-between', padding: '6px 10px', fontSize: '12px', color: '#b45309' }}
              >
                <span>📜 Sıcak Sepia</span>
                {readerFilter === 'sepia' && <Check size={12} color="#b45309" />}
              </button>
              <button
                onClick={() => { onReaderFilterChange('dark'); setFilterDropdownOpen(false); }}
                className={`btn-ghost ${readerFilter === 'dark' ? 'active' : ''}`}
                style={{ justifyContent: 'space-between', padding: '6px 10px', fontSize: '12px' }}
              >
                <span>🌙 Gece Modu</span>
                {readerFilter === 'dark' && <Check size={12} color="var(--accent-primary)" />}
              </button>
              <button
                onClick={() => { onReaderFilterChange('contrast'); setFilterDropdownOpen(false); }}
                className={`btn-ghost ${readerFilter === 'contrast' ? 'active' : ''}`}
                style={{ justifyContent: 'space-between', padding: '6px 10px', fontSize: '12px' }}
              >
                <span>🔆 Yüksek Kontrast</span>
                {readerFilter === 'contrast' && <Check size={12} color="var(--accent-primary)" />}
              </button>
            </div>
          )}
        </div>

        <button 
          onClick={onOpenOrganizeModal} 
          className="btn-ghost" 
          data-tooltip="Sayfa Sıralama & Yönetim"
          style={{ fontSize: '12px', padding: '5px 8px', gap: '4px' }}
        >
          <LayoutGrid size={14} />
          <span className="header-btn-label">Sayfalar</span>
        </button>

        <button 
          onClick={onPrint} 
          className="btn-icon" 
          data-tooltip="Yazdır (Ctrl+P)"
          style={{ width: '30px', height: '30px' }}
        >
          <Printer size={15} />
        </button>

        <button 
          onClick={onToggleTheme} 
          className="btn-icon" 
          data-tooltip={theme === 'dark' ? 'Açık Tema' : 'Karanlık Tema'}
          style={{ width: '30px', height: '30px' }}
        >
          {theme === 'dark' ? <Sun size={15} color="#f59e0b" /> : <Moon size={15} />}
        </button>

        <button 
          onClick={onOpenSettingsModal} 
          className="btn-icon" 
          data-tooltip="Uygulama Ayarları & Tercihler"
          style={{ width: '30px', height: '30px' }}
        >
          <SettingsIcon size={15} />
        </button>

        <button 
          onClick={onOpenAboutModal} 
          className="btn-icon" 
          data-tooltip="Hakkında & Kısayollar"
          style={{ width: '30px', height: '30px' }}
        >
          <HelpCircle size={15} color="var(--accent-primary)" />
        </button>
      </div>
    </header>
  );
};
