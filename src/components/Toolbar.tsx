import React, { useState, useRef } from 'react';
import { 
  MousePointer, 
  Hand, 
  FileEdit,
  PenTool, 
  Highlighter, 
  Type, 
  Square, 
  Circle, 
  Minus, 
  ArrowUpRight, 
  Stamp, 
  PenSquare, 
  EyeOff, 
  Eraser, 
  ChevronDown,
  ScanText,
  Image as ImageIcon,
  Ruler,
  CheckSquare
} from 'lucide-react';
import type { ToolType, ActiveToolConfig } from '../types/pdf';

interface ToolbarProps {
  activeConfig: ActiveToolConfig;
  onSelectTool: (tool: ToolType) => void;
  onOpenSignatureModal: () => void;
  onOpenStampModal: () => void;
  onOpenOcrModal: () => void;
  onInsertImage: (file: File) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  activeConfig,
  onSelectTool,
  onOpenSignatureModal,
  onOpenStampModal,
  onOpenOcrModal,
  onInsertImage,
}) => {
  const [shapesDropdownOpen, setShapesDropdownOpen] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const isShapeActive = ['rect', 'circle', 'line', 'arrow'].includes(activeConfig.tool);

  const getShapeIcon = () => {
    switch (activeConfig.tool) {
      case 'circle': return <Circle size={16} />;
      case 'line': return <Minus size={16} />;
      case 'arrow': return <ArrowUpRight size={16} />;
      default: return <Square size={16} />;
    }
  };

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onInsertImage(e.target.files[0]);
      e.target.value = '';
    }
  };

  return (
    <div className="glass-panel" style={{
      height: '44px',
      minHeight: '44px',
      maxHeight: '44px',
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '4px',
      padding: '0 10px',
      borderBottom: '1px solid var(--border-color)',
      position: 'relative',
      zIndex: 40,
    }}>
      {/* Navigation Tools */}
      <button
        onClick={() => onSelectTool('select')}
        className={`btn-icon ${activeConfig.tool === 'select' ? 'active' : ''}`}
        data-tooltip="Seç & Taşı & Kopyala (V)"
        style={{ width: '30px', height: '30px' }}
      >
        <MousePointer size={15} />
      </button>

      <button
        onClick={() => onSelectTool('pan')}
        className={`btn-icon ${activeConfig.tool === 'pan' ? 'active' : ''}`}
        data-tooltip="Sayfayı Kaydır / Gezin (H)"
        style={{ width: '30px', height: '30px' }}
      >
        <Hand size={15} />
      </button>

      <div style={{ height: '18px', width: '1px', background: 'var(--border-color)', margin: '0 2px' }} />

      {/* Direct PDF Text Edit Tool */}
      <button
        onClick={() => onSelectTool('edit-text')}
        className={`btn-ghost ${activeConfig.tool === 'edit-text' ? 'active' : ''}`}
        data-tooltip="PDF Metnini Doğrudan Değiştir / Düzenle"
        style={{
          fontSize: '11px',
          padding: '4px 8px',
          fontWeight: 600,
          background: activeConfig.tool === 'edit-text' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
          color: activeConfig.tool === 'edit-text' ? 'var(--accent-primary)' : 'inherit',
          border: activeConfig.tool === 'edit-text' ? '1px solid var(--accent-primary)' : '1px solid transparent',
        }}
      >
        <FileEdit size={14} color="var(--accent-primary)" />
        <span>Metin Düzenle</span>
      </button>

      {/* OCR Scanner Tool */}
      <button
        onClick={onOpenOcrModal}
        className="btn-ghost"
        data-tooltip="OCR Taranmış Belgeyi Oku & Düzenlenebilir Yap"
        style={{ fontSize: '11px', padding: '4px 8px', fontWeight: 600 }}
      >
        <ScanText size={14} color="#10b981" />
        <span>OCR Tara</span>
      </button>

      <div style={{ height: '18px', width: '1px', background: 'var(--border-color)', margin: '0 2px' }} />

      {/* Freehand Drawing & Highlighter */}
      <button
        onClick={() => onSelectTool('pen')}
        className={`btn-icon ${activeConfig.tool === 'pen' ? 'active' : ''}`}
        data-tooltip="Çizim Kalemi (P)"
        style={{ width: '30px', height: '30px' }}
      >
        <PenTool size={15} />
      </button>

      <button
        onClick={() => onSelectTool('highlighter')}
        className={`btn-icon ${activeConfig.tool === 'highlighter' ? 'active' : ''}`}
        data-tooltip="Fosforlu Vurgulayıcı"
        style={{ width: '30px', height: '30px' }}
      >
        <Highlighter size={15} />
      </button>

      {/* Text Tool */}
      <button
        onClick={() => onSelectTool('text')}
        className={`btn-icon ${activeConfig.tool === 'text' ? 'active' : ''}`}
        data-tooltip="Yeni Metin Ekle (T)"
        style={{ width: '30px', height: '30px' }}
      >
        <Type size={15} />
      </button>

      {/* Checkbox Tool */}
      <button
        onClick={() => onSelectTool('checkbox')}
        className={`btn-icon ${activeConfig.tool === 'checkbox' ? 'active' : ''}`}
        data-tooltip="Onay Kutusu Ekle (☑)"
        style={{ width: '30px', height: '30px' }}
      >
        <CheckSquare size={15} />
      </button>

      {/* Image Insert Button */}
      <input
        type="file"
        ref={imageInputRef}
        onChange={handleImageFile}
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        style={{ display: 'none' }}
      />
      <button
        onClick={() => imageInputRef.current?.click()}
        className="btn-icon"
        data-tooltip="Resim / Görsel / Logo Ekle"
        style={{ width: '30px', height: '30px' }}
      >
        <ImageIcon size={15} color="#38bdf8" />
      </button>

      {/* Measurement / Ruler Tool */}
      <button
        onClick={() => onSelectTool('measure')}
        className={`btn-icon ${activeConfig.tool === 'measure' ? 'active' : ''}`}
        data-tooltip="Cetvel / Mesafe Ölçüm Aracı"
        style={{ width: '30px', height: '30px' }}
      >
        <Ruler size={15} color="#f59e0b" />
      </button>

      {/* Shapes Dropdown Button */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => {
            if (!isShapeActive) {
              onSelectTool('rect');
            } else {
              setShapesDropdownOpen(!shapesDropdownOpen);
            }
          }}
          className={`btn-icon ${isShapeActive ? 'active' : ''}`}
          data-tooltip="Şekiller (Kare, Daire, Ok)"
          style={{ width: 'auto', padding: '0 6px', gap: '3px', height: '30px' }}
        >
          {getShapeIcon()}
          <ChevronDown size={11} onClick={(e) => {
            e.stopPropagation();
            setShapesDropdownOpen(!shapesDropdownOpen);
          }} />
        </button>

        {shapesDropdownOpen && (
          <div 
            className="glass-dropdown animate-fade-in"
            style={{
              position: 'absolute',
              top: '36px',
              left: 0,
              display: 'flex',
              flexDirection: 'column',
              padding: '6px',
              gap: '3px',
              borderRadius: 'var(--radius-md)',
              minWidth: '140px',
              zIndex: 100,
            }}
          >
            <button
              onClick={() => { onSelectTool('rect'); setShapesDropdownOpen(false); }}
              className={`btn-ghost ${activeConfig.tool === 'rect' ? 'active' : ''}`}
              style={{ justifyContent: 'flex-start', padding: '6px 8px', fontSize: '12px' }}
            >
              <Square size={14} /> Dikdörtgen
            </button>
            <button
              onClick={() => { onSelectTool('circle'); setShapesDropdownOpen(false); }}
              className={`btn-ghost ${activeConfig.tool === 'circle' ? 'active' : ''}`}
              style={{ justifyContent: 'flex-start', padding: '6px 8px', fontSize: '12px' }}
            >
              <Circle size={14} /> Daire
            </button>
            <button
              onClick={() => { onSelectTool('line'); setShapesDropdownOpen(false); }}
              className={`btn-ghost ${activeConfig.tool === 'line' ? 'active' : ''}`}
              style={{ justifyContent: 'flex-start', padding: '6px 8px', fontSize: '12px' }}
            >
              <Minus size={14} /> Düz Çizgi
            </button>
            <button
              onClick={() => { onSelectTool('arrow'); setShapesDropdownOpen(false); }}
              className={`btn-ghost ${activeConfig.tool === 'arrow' ? 'active' : ''}`}
              style={{ justifyContent: 'flex-start', padding: '6px 8px', fontSize: '12px' }}
            >
              <ArrowUpRight size={14} /> Ok İşareti
            </button>
          </div>
        )}
      </div>

      <div style={{ height: '18px', width: '1px', background: 'var(--border-color)', margin: '0 2px' }} />

      {/* Signature & Stamps */}
      <button
        onClick={onOpenSignatureModal}
        className={`btn-ghost ${activeConfig.tool === 'signature' ? 'active' : ''}`}
        data-tooltip="Dijital İmza Ekle"
        style={{ fontSize: '11px', padding: '4px 8px', fontWeight: 600 }}
      >
        <PenSquare size={14} color="var(--accent-primary)" />
        <span>İmza</span>
      </button>

      <button
        onClick={onOpenStampModal}
        className={`btn-ghost ${activeConfig.tool === 'stamp' ? 'active' : ''}`}
        data-tooltip="Kaşe & Damga Ekle"
        style={{ fontSize: '11px', padding: '4px 8px', fontWeight: 600 }}
      >
        <Stamp size={14} color="#e11d48" />
        <span>Damga</span>
      </button>

      <div style={{ height: '18px', width: '1px', background: 'var(--border-color)', margin: '0 2px' }} />

      {/* Redaction / Whiteout */}
      <button
        onClick={() => onSelectTool('redact')}
        className={`btn-icon ${activeConfig.tool === 'redact' ? 'active' : ''}`}
        data-tooltip="Karart / Gizle (Hassas Veri Kapatma)"
        style={{ width: '30px', height: '30px' }}
      >
        <EyeOff size={15} color={activeConfig.tool === 'redact' ? '#ffffff' : '#f43f5e'} />
      </button>

      {/* Eraser */}
      <button
        onClick={() => onSelectTool('eraser')}
        className={`btn-icon ${activeConfig.tool === 'eraser' ? 'active' : ''}`}
        data-tooltip="Silgi (Açıklamaları Sil)"
        style={{ width: '30px', height: '30px' }}
      >
        <Eraser size={15} />
      </button>
    </div>
  );
};
