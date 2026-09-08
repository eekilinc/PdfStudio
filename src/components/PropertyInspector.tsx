import React from 'react';
import { 
  Bold, 
  Italic, 
  Trash2, 
  Copy, 
  ArrowUp, 
  ArrowDown,
  Layers
} from 'lucide-react';
import type { ActiveToolConfig, Annotation } from '../types/pdf';

interface PropertyInspectorProps {
  activeConfig: ActiveToolConfig;
  selectedAnnotation: Annotation | null;
  onUpdateConfig: (partial: Partial<ActiveToolConfig>) => void;
  onUpdateSelectedAnnotation: (partial: Partial<Annotation>) => void;
  onDeleteSelectedAnnotation: () => void;
  onDuplicateSelectedAnnotation: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
}

const PRESET_COLORS = [
  '#0f172a', // Dark slate
  '#dc2626', // Red
  '#2563eb', // Blue
  '#16a34a', // Green
  '#d97706', // Amber/Orange
  '#7c3aed', // Purple
  '#facc15', // Yellow (Highlighter)
  '#ffffff', // White
];

export const PropertyInspector: React.FC<PropertyInspectorProps> = ({
  activeConfig,
  selectedAnnotation,
  onUpdateConfig,
  onUpdateSelectedAnnotation,
  onDeleteSelectedAnnotation,
  onDuplicateSelectedAnnotation,
  onBringForward,
  onSendBackward,
}) => {
  const currentTool = activeConfig.tool;
  const isSelected = !!selectedAnnotation;
  const annType = selectedAnnotation?.type || currentTool;

  // Determine current active values (either from selected annotation or current active tool config)
  const currentColor = selectedAnnotation ? selectedAnnotation.color : activeConfig.color;
  const currentStrokeWidth = selectedAnnotation?.strokeWidth !== undefined ? selectedAnnotation.strokeWidth : activeConfig.strokeWidth;
  const currentOpacity = selectedAnnotation?.opacity !== undefined ? selectedAnnotation.opacity : activeConfig.opacity;

  const handleColorChange = (newColor: string) => {
    onUpdateConfig({ color: newColor });
    if (selectedAnnotation) {
      onUpdateSelectedAnnotation({ color: newColor });
    }
  };

  const handleStrokeWidthChange = (w: number) => {
    onUpdateConfig({ strokeWidth: w });
    if (selectedAnnotation) {
      onUpdateSelectedAnnotation({ strokeWidth: w });
    }
  };

  const handleOpacityChange = (op: number) => {
    onUpdateConfig({ opacity: op });
    if (selectedAnnotation) {
      onUpdateSelectedAnnotation({ opacity: op });
    }
  };

  return (
    <div style={{
      height: '38px',
      minHeight: '38px',
      maxHeight: '38px',
      flexShrink: 0,
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border-color)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      gap: '12px',
      fontSize: '12px',
      zIndex: 35,
    }}>
      {/* Colors Section */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 500 }}>Renk:</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {PRESET_COLORS.map((c) => (
            <div
              key={c}
              onClick={() => handleColorChange(c)}
              style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                backgroundColor: c,
                cursor: 'pointer',
                border: currentColor.toLowerCase() === c.toLowerCase() ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                transform: currentColor.toLowerCase() === c.toLowerCase() ? 'scale(1.15)' : 'scale(1)',
                transition: 'all 0.15s ease',
              }}
            />
          ))}
          {/* Native HTML Color Picker */}
          <input
            type="color"
            value={currentColor.startsWith('#') ? currentColor : '#000000'}
            onChange={(e) => handleColorChange(e.target.value)}
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              background: 'transparent',
            }}
          />
        </div>
      </div>

      <div style={{ height: '16px', width: '1px', background: 'var(--border-color)' }} />

      {/* Stroke Width Slider for Drawing / Shapes */}
      {['pen', 'highlighter', 'rect', 'circle', 'line', 'arrow'].includes(annType) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Kalınlık:</span>
          <input
            type="range"
            min={1}
            max={annType === 'highlighter' ? 40 : 20}
            value={currentStrokeWidth}
            onChange={(e) => handleStrokeWidthChange(Number(e.target.value))}
            style={{ width: '70px', cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
          />
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', minWidth: '22px' }}>
            {currentStrokeWidth}px
          </span>
        </div>
      )}

      {/* Text Tool Properties */}
      {(annType === 'text' || activeConfig.tool === 'edit-text' || activeConfig.tool === 'text') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Font Size */}
          <select
            value={selectedAnnotation && 'fontSize' in selectedAnnotation ? (selectedAnnotation as any).fontSize : activeConfig.fontSize}
            onChange={(e) => {
              const sz = Number(e.target.value);
              onUpdateConfig({ fontSize: sz });
              if (selectedAnnotation) onUpdateSelectedAnnotation({ fontSize: sz } as any);
            }}
            style={{
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              padding: '2px 6px',
              fontSize: '11px',
            }}
          >
            {[9, 10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64].map((size) => (
              <option key={size} value={size}>{size} pt</option>
            ))}
          </select>

          {/* Font Family */}
          <select
            value={selectedAnnotation && 'fontFamily' in selectedAnnotation ? (selectedAnnotation as any).fontFamily : activeConfig.fontFamily}
            onChange={(e) => {
              const fam = e.target.value;
              onUpdateConfig({ fontFamily: fam });
              if (selectedAnnotation) onUpdateSelectedAnnotation({ fontFamily: fam } as any);
            }}
            style={{
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              padding: '2px 6px',
              fontSize: '11px',
              maxWidth: '170px',
            }}
          >
            <optgroup label="Sans-Serif">
              <option value="Inter, sans-serif">Inter</option>
              <option value="Roboto, sans-serif">Roboto</option>
              <option value="Arial, sans-serif">Arial</option>
              <option value="Segoe UI, sans-serif">Segoe UI</option>
              <option value="Calibri, sans-serif">Calibri</option>
              <option value="Verdana, sans-serif">Verdana</option>
            </optgroup>
            <optgroup label="Serif">
              <option value="Times New Roman, serif">Times New Roman</option>
              <option value="Georgia, serif">Georgia</option>
              <option value="Garamond, serif">Garamond</option>
              <option value="Cambria, serif">Cambria</option>
            </optgroup>
            <optgroup label="Monospace">
              <option value="JetBrains Mono, monospace">JetBrains Mono</option>
              <option value="Courier New, monospace">Courier New</option>
              <option value="Consolas, monospace">Consolas</option>
            </optgroup>
            <optgroup label="El Yazısı / Dekoratif">
              <option value="'Dancing Script', cursive">Dancing Script</option>
            </optgroup>
          </select>

          {/* Bold / Italic */}
          <button
            onClick={() => {
              const isBold = (selectedAnnotation && 'fontWeight' in selectedAnnotation ? (selectedAnnotation as any).fontWeight === 'bold' : activeConfig.fontWeight === 'bold');
              const nextVal = isBold ? 'normal' : 'bold';
              onUpdateConfig({ fontWeight: nextVal });
              if (selectedAnnotation) onUpdateSelectedAnnotation({ fontWeight: nextVal } as any);
            }}
            className={`btn-icon ${(selectedAnnotation && 'fontWeight' in selectedAnnotation ? (selectedAnnotation as any).fontWeight === 'bold' : activeConfig.fontWeight === 'bold') ? 'active' : ''}`}
            style={{ width: '26px', height: '26px' }}
            data-tooltip="Kalın (Bold)"
          >
            <Bold size={14} />
          </button>

          <button
            onClick={() => {
              const isItalic = (selectedAnnotation && 'fontStyle' in selectedAnnotation ? (selectedAnnotation as any).fontStyle === 'italic' : activeConfig.fontStyle === 'italic');
              const nextVal = isItalic ? 'normal' : 'italic';
              onUpdateConfig({ fontStyle: nextVal });
              if (selectedAnnotation) onUpdateSelectedAnnotation({ fontStyle: nextVal } as any);
            }}
            className={`btn-icon ${(selectedAnnotation && 'fontStyle' in selectedAnnotation ? (selectedAnnotation as any).fontStyle === 'italic' : activeConfig.fontStyle === 'italic') ? 'active' : ''}`}
            style={{ width: '26px', height: '26px' }}
            data-tooltip="İtalik"
          >
            <Italic size={14} />
          </button>
        </div>
      )}

      {/* Opacity slider */}
      <div 
        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        data-tooltip="Çizim & Nesne Saydamlık/Opaklık Ayarı (%10 - %100)"
      >
        <Layers size={13} color="var(--text-muted)" />
        <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Opaklık:</span>
        <input
          type="range"
          min={0.1}
          max={1.0}
          step={0.05}
          value={currentOpacity !== undefined ? currentOpacity : 1.0}
          onChange={(e) => handleOpacityChange(Number(e.target.value))}
          style={{ width: '64px', cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
        />
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', minWidth: '32px' }}>
          {Math.round((currentOpacity !== undefined ? currentOpacity : 1.0) * 100)}%
        </span>
      </div>

      {/* Selected Object Operations */}
      {isSelected && (
        <>
          <div style={{ height: '16px', width: '1px', background: 'var(--border-color)', margin: '0 4px' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}>
            <button
              onClick={onBringForward}
              className="btn-icon"
              data-tooltip="Öne Getir"
              style={{ width: '26px', height: '26px' }}
            >
              <ArrowUp size={14} />
            </button>

            <button
              onClick={onSendBackward}
              className="btn-icon"
              data-tooltip="Arkaya Gönder"
              style={{ width: '26px', height: '26px' }}
            >
              <ArrowDown size={14} />
            </button>

            <button
              onClick={onDuplicateSelectedAnnotation}
              className="btn-icon"
              data-tooltip="Çoğalt (Ctrl+D)"
              style={{ width: '26px', height: '26px' }}
            >
              <Copy size={14} />
            </button>

            <button
              onClick={onDeleteSelectedAnnotation}
              className="btn-icon"
              data-tooltip="Sil (Delete)"
              style={{ width: '26px', height: '26px', color: 'var(--danger)' }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </>
      )}
    </div>
  );
};
