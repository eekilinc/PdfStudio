import React, { useState } from 'react';
import { Link2, X } from 'lucide-react';

interface LinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called with the chosen target. */
  onSubmit: (target: { kind: 'external'; url: string } | { kind: 'internal'; targetPageIndex: number }) => void;
  /** How many pages the document has, for the target page picker. */
  totalPages: number;
  /** The page the link is placed on, shown in the header. */
  pageNumber?: number;
}

/**
 * Asks where a link should point.
 *
 * A link is either an address that leaves the document or a jump to
 * another page of it. The choice is written into the file as a URI
 * action or as a destination.
 */
export const LinkModal: React.FC<LinkModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  totalPages,
  pageNumber,
}) => {
  const [mode, setMode] = useState<'external' | 'internal'>('external');
  const [url, setUrl] = useState('');
  const [targetPage, setTargetPage] = useState(1);

  if (!isOpen) return null;

  const submit = () => {
    if (mode === 'external') {
      const value = url.trim();
      if (!value) return;
      // A bare address is written as it is; the reader decides what to do
      // with it, exactly as it does with a link in any other document.
      onSubmit({ kind: 'external', url: value });
      return;
    }
    const index = Math.min(Math.max(1, targetPage), Math.max(1, totalPages)) - 1;
    onSubmit({ kind: 'internal', targetPageIndex: index });
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    fontSize: '13px',
    padding: '8px 10px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card animate-fade-in" style={{ width: '460px' }}>
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontWeight: 600, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Link2 size={18} color="#38bdf8" />
            Köprü Ekle
            {pageNumber !== undefined && (
              <span style={{ fontSize: '11.5px', fontWeight: 500, color: 'var(--text-tertiary)' }}>
                Sayfa {pageNumber}
              </span>
            )}
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Kapat">
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
            <button
              className={`btn-ghost ${mode === 'external' ? 'active' : ''}`}
              style={{ flex: 1, fontSize: '12px', justifyContent: 'center' }}
              onClick={() => setMode('external')}
            >
              Dış Adres (URL)
            </button>
            <button
              className={`btn-ghost ${mode === 'internal' ? 'active' : ''}`}
              style={{ flex: 1, fontSize: '12px', justifyContent: 'center' }}
              onClick={() => setMode('internal')}
            >
              Belge İçi Sayfa
            </button>
          </div>

          {mode === 'external' ? (
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
              }}
              placeholder="https://ornek.com"
              autoFocus
              style={inputStyle}
            />
          ) : (
            <div>
              <label style={{ fontSize: '11.5px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Hedef sayfa
              </label>
              <input
                type="number"
                min={1}
                max={Math.max(1, totalPages)}
                value={targetPage}
                onChange={(e) => setTargetPage(Number(e.target.value) || 1)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submit();
                }}
                autoFocus
                style={inputStyle}
              />
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '6px' }}>
                Belgede {totalPages} sayfa var.
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
          }}
        >
          <button className="btn-ghost" onClick={onClose}>
            Vazgeç
          </button>
          <button
            className="btn-primary"
            onClick={submit}
            disabled={mode === 'external' && !url.trim()}
          >
            Ekle
          </button>
        </div>
      </div>
    </div>
  );
};
