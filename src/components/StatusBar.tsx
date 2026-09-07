import React, { useState, useRef, useEffect } from 'react';
import { 
  Maximize2, 
  Minimize2, 
  Info, 
  ZoomIn, 
  ZoomOut, 
  Check, 
  CircleDot,
  MousePointer,
  Hand,
  FileEdit,
  PenTool,
  Highlighter,
  Type,
  Square,
  PenSquare,
  Stamp,
  EyeOff,
  Eraser,
  Ruler,
  CheckSquare,
  ImageIcon
} from 'lucide-react';
import type { ToolType } from '../types/pdf';

interface StatusBarProps {
  currentPage: number;
  totalPages: number;
  pageWidth?: number;
  pageHeight?: number;
  activeTool: ToolType;
  isDirty: boolean;
  zoom: number;
  onZoomChange: (newZoom: number) => void;
  onFitPage: () => void;
  onFitWidth: () => void;
  onOpenProperties: () => void;
  onToggleFullscreen: () => void;
  isFullscreen: boolean;
}

const ZOOM_PRESETS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

export const StatusBar: React.FC<StatusBarProps> = ({
  currentPage,
  totalPages,
  pageWidth = 595.28,
  pageHeight = 841.89,
  activeTool,
  isDirty,
  zoom,
  onZoomChange,
  onFitPage,
  onFitWidth,
  onOpenProperties,
  onToggleFullscreen,
  isFullscreen,
}) => {
  const [zoomMenuOpen, setZoomMenuOpen] = useState(false);
  const zoomMenuRef = useRef<HTMLDivElement>(null);

  // Close zoom menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (zoomMenuRef.current && !zoomMenuRef.current.contains(e.target as Node)) {
        setZoomMenuOpen(false);
      }
    };
    if (zoomMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [zoomMenuOpen]);

  // Determine standard paper size name
  const getPaperSizeLabel = (w: number, h: number) => {
    const minD = Math.min(w, h);
    const maxD = Math.max(w, h);
    // A4: 595 x 842 pt (~210 x 297 mm)
    if (Math.abs(minD - 595.28) < 10 && Math.abs(maxD - 841.89) < 10) {
      return 'A4 (210 × 297 mm)';
    }
    // US Letter: 612 x 792 pt (~216 x 279 mm)
    if (Math.abs(minD - 612) < 10 && Math.abs(maxD - 792) < 10) {
      return 'Letter (216 × 279 mm)';
    }
    // A3: 842 x 1191 pt
    if (Math.abs(minD - 841.89) < 10 && Math.abs(maxD - 1190.55) < 10) {
      return 'A3 (297 × 420 mm)';
    }
    // A5: 420 x 595 pt
    if (Math.abs(minD - 419.53) < 10 && Math.abs(maxD - 595.28) < 10) {
      return 'A5 (148 × 210 mm)';
    }
    return `${Math.round(w)} × ${Math.round(h)} pt`;
  };

  const getToolInfo = () => {
    switch (activeTool) {
      case 'select': return { label: 'Seç & Taşı (V)', icon: <MousePointer size={11} /> };
      case 'pan': return { label: 'Kaydır (H)', icon: <Hand size={11} /> };
      case 'edit-text': return { label: 'Metin Düzenleme', icon: <FileEdit size={11} color="var(--accent-primary)" /> };
      case 'text': return { label: 'Yeni Metin (T)', icon: <Type size={11} /> };
      case 'pen': return { label: 'Çizim Kalemi (P)', icon: <PenTool size={11} /> };
      case 'highlighter': return { label: 'Fosforlu Kalem', icon: <Highlighter size={11} /> };
      case 'rect':
      case 'circle':
      case 'line':
      case 'arrow': return { label: 'Geometrik Şekil', icon: <Square size={11} /> };
      case 'signature': return { label: 'Dijital İmza', icon: <PenSquare size={11} color="var(--accent-primary)" /> };
      case 'stamp': return { label: 'Damga & Kaşe', icon: <Stamp size={11} color="#e11d48" /> };
      case 'redact': return { label: 'Karartma / Gizleme', icon: <EyeOff size={11} color="#f43f5e" /> };
      case 'eraser': return { label: 'Silgi', icon: <Eraser size={11} /> };
      case 'measure': return { label: 'Mesafe Cetveli', icon: <Ruler size={11} color="#f59e0b" /> };
      case 'checkbox': return { label: 'Onay Kutusu', icon: <CheckSquare size={11} /> };
      case 'image': return { label: 'Görsel Ekle', icon: <ImageIcon size={11} color="#38bdf8" /> };
      default: return { label: 'Hazır', icon: <MousePointer size={11} /> };
    }
  };

  const tool = getToolInfo();

  return (
    <footer
      style={{
        height: '26px',
        minHeight: '26px',
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 10px',
        fontSize: '11px',
        color: 'var(--text-secondary)',
        zIndex: 50,
        userSelect: 'none',
        lineHeight: 1,
      }}
    >
      {/* 1. LEFT: Page & Document Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, color: 'var(--text-primary)' }}>
          <span>Sayfa {currentPage} / {totalPages || 1}</span>
        </div>

        <div style={{ height: '12px', width: '1px', background: 'var(--border-color)' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}>
          <span>{getPaperSizeLabel(pageWidth, pageHeight)}</span>
        </div>

        <div style={{ height: '12px', width: '1px', background: 'var(--border-color)' }} />

        {/* Active Tool Badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          background: 'var(--bg-tertiary)',
          padding: '2px 6px',
          borderRadius: '4px',
          color: 'var(--text-primary)',
          fontSize: '10.5px',
          fontWeight: 500,
        }}>
          {tool.icon}
          <span>{tool.label}</span>
        </div>
      </div>

      {/* 2. CENTER: Dirty State / Autosave Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {isDirty ? (
          <div 
            style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#f59e0b', fontSize: '10.5px', fontWeight: 500 }}
            data-tooltip="Değişiklikleri kaydetmek için Ctrl+S yapın"
          >
            <CircleDot size={10} color="#f59e0b" />
            <span>Kaydedilmemiş değişiklikler</span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981', fontSize: '10.5px' }}>
            <Check size={11} color="#10b981" />
            <span>Tüm değişiklikler kaydedildi</span>
          </div>
        )}
      </div>

      {/* 3. RIGHT: Zoom Controls, Metadata & Fullscreen */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {/* Zoom Quick Presets Menu */}
        <div ref={zoomMenuRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setZoomMenuOpen(!zoomMenuOpen)}
            className="btn-ghost"
            style={{
              padding: '2px 6px',
              fontSize: '11px',
              height: '20px',
              fontFamily: 'JetBrains Mono, monospace',
              fontWeight: 600,
            }}
            data-tooltip="Hızlı Yakınlaştırma Seçenekleri"
          >
            {Math.round(zoom * 100)}%
          </button>

          {zoomMenuOpen && (
            <div
              className="glass-dropdown animate-fade-in"
              style={{
                position: 'absolute',
                bottom: '26px',
                right: 0,
                display: 'flex',
                flexDirection: 'column',
                padding: '4px',
                gap: '2px',
                borderRadius: 'var(--radius-sm)',
                minWidth: '130px',
                zIndex: 1000,
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              {ZOOM_PRESETS.map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => { onZoomChange(lvl); setZoomMenuOpen(false); }}
                  className={`btn-ghost ${Math.abs(zoom - lvl) < 0.05 ? 'active' : ''}`}
                  style={{ justifyContent: 'space-between', padding: '4px 8px', fontSize: '11px' }}
                >
                  <span>%{Math.round(lvl * 100)}</span>
                  {Math.abs(zoom - lvl) < 0.05 && <Check size={11} color="var(--accent-primary)" />}
                </button>
              ))}

              <div style={{ height: '1px', background: 'var(--border-color)', margin: '2px 0' }} />

              <button
                onClick={() => { onFitPage(); setZoomMenuOpen(false); }}
                className="btn-ghost"
                style={{ justifyContent: 'flex-start', padding: '4px 8px', fontSize: '11px' }}
              >
                Sayfaya Sığdır (Ctrl+0)
              </button>
              <button
                onClick={() => { onFitWidth(); setZoomMenuOpen(false); }}
                className="btn-ghost"
                style={{ justifyContent: 'flex-start', padding: '4px 8px', fontSize: '11px' }}
              >
                Genişliğe Sığdır (Ctrl+1)
              </button>
            </div>
          )}
        </div>

        {/* Zoom In / Out Buttons */}
        <button
          onClick={() => onZoomChange(Math.max(0.25, zoom - 0.15))}
          className="btn-icon"
          data-tooltip="Uzaklaştır"
          style={{ width: '20px', height: '20px' }}
        >
          <ZoomOut size={12} />
        </button>

        <button
          onClick={() => onZoomChange(Math.min(4.0, zoom + 0.15))}
          className="btn-icon"
          data-tooltip="Yakınlaştır"
          style={{ width: '20px', height: '20px' }}
        >
          <ZoomIn size={12} />
        </button>

        <div style={{ height: '12px', width: '1px', background: 'var(--border-color)', margin: '0 2px' }} />

        {/* Document Properties Trigger */}
        <button
          onClick={onOpenProperties}
          className="btn-icon"
          data-tooltip="Belge Özellikleri & Meta Veri (Ctrl+D)"
          style={{ width: '20px', height: '20px' }}
        >
          <Info size={12} />
        </button>

        {/* Fullscreen / Presentation Mode Trigger */}
        <button
          onClick={onToggleFullscreen}
          className={`btn-icon ${isFullscreen ? 'active' : ''}`}
          data-tooltip={isFullscreen ? 'Tam Ekrandan Çık (Esc / F11)' : 'Sunum & Tam Ekran Modu (F11)'}
          style={{ width: '20px', height: '20px' }}
        >
          {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
        </button>
      </div>
    </footer>
  );
};
