import React from 'react';
import { Eye, EyeOff, Layers, Lock } from 'lucide-react';
import type { PdfLayer } from '../types/pdf';
import { t } from '../utils/i18n';

interface LayersPanelProps {
  layers: PdfLayer[];
  /** The page the viewer is on, used to mark the layers of that page. */
  currentPageIndex: number;
  /** Turn a layer on or off. */
  onToggleLayer: (name: string, visible: boolean) => void;
}

/**
 * The layers of the document.
 *
 * A layer is an optional content group: the parts of the page that belong
 * to it can be turned on and off, and the state is written into the file,
 * so the reader that opens the document next sees the same thing.
 */
export const LayersPanel: React.FC<LayersPanelProps> = ({
  layers,
  currentPageIndex,
  onToggleLayer,
}) => {
  if (layers.length === 0) {
    return (
      <div style={{ padding: '24px 14px', fontSize: '12px', color: 'var(--text-tertiary)', lineHeight: 1.6, textAlign: 'center' }}>
        Bu belgede katman yok.
        <br />
        <span style={{ fontSize: '11px' }}>{t('layers.empty-desc')}</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <Layers size={13} color="var(--accent-primary)" />
        <span style={{ fontSize: '11.5px', fontWeight: 700, flex: 1 }}>
          Katmanlar ({layers.length})
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
        {layers.map((layer) => {
          const onThisPage = layer.pageIndexes.includes(currentPageIndex);
          return (
            <label
              key={layer.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                padding: '8px 10px',
                marginBottom: '6px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                cursor: layer.locked ? 'default' : 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={layer.visible}
                disabled={layer.locked}
                onChange={(e) => onToggleLayer(layer.name, e.target.checked)}
                style={{ marginTop: 2 }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {layer.visible ? (
                    <Eye size={12} color="var(--accent-primary)" />
                  ) : (
                    <EyeOff size={12} color="var(--text-tertiary)" />
                  )}
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      flex: 1,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={layer.name}
                  >
                    {layer.name}
                  </span>
                  {layer.locked && <Lock size={11} color="var(--text-tertiary)" />}
                </div>
                <div style={{ fontSize: '10.5px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                  {layer.pageIndexes.length > 0
                    ? `${layer.pageIndexes.length} sayfada · ${layer.pageIndexes
                        .slice(0, 4)
                        .map((p) => p + 1)
                        .join(', ')}${layer.pageIndexes.length > 4 ? '…' : ''}`
                    : 'Sayfalarda kullanılmıyor'}
                  {onThisPage && ' · bu sayfada'}
                </div>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
};
