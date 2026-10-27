import React, { useState } from 'react';
import { ExternalLink, Link2, Plus, Trash2 } from 'lucide-react';
import type { PdfLink } from '../types/pdf';
import { t } from '../utils/i18n';

interface LinksPanelProps {
  links: PdfLink[];
  /** How many pages the document has, for the target page picker. */
  totalPages: number;
  /** Move the viewer to a page. */
  onJumpToPage: (pageIndex: number) => void;
  /** Remove a link. */
  onDeleteLink: (id: string) => void;
  /** Put the viewer into the link tool, so the user can draw a link area. */
  onStartLinkTool: () => void;
}

/**
 * The hyperlinks of the document.
 *
 * The links are real annotations in the file, so the panel lists what the
 * document carries: an address that leaves the document, or a jump inside
 * it. A link that is removed here stays removed when the file is written.
 */
export const LinksPanel: React.FC<LinksPanelProps> = ({
  links,
  totalPages,
  onJumpToPage,
  onDeleteLink,
  onStartLinkTool,
}) => {
  const [query, setQuery] = useState('');

  const visible = links.filter((link) => {
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    const target = link.url ?? `sayfa ${(link.targetPageIndex ?? 0) + 1}`;
    return target.toLowerCase().includes(needle);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
          <span style={{ fontSize: '11.5px', fontWeight: 700, flex: 1 }}>
            Köprüler ({links.length})
          </span>
          <button
            className="btn-ghost"
            style={{ fontSize: '11px', padding: '3px 8px' }}
            onClick={onStartLinkTool}
            title="Sayfada bir alan seçerek yeni köprü ekle"
          >
            <Plus size={12} /> Ekle
          </button>
        </div>
        {links.length > 0 && (
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Köprü ara..."
            style={{
              width: '100%',
              fontSize: '12px',
              padding: '5px 8px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
            }}
          />
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
        {links.length === 0 ? (
          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', lineHeight: 1.6, textAlign: 'center', padding: '24px 8px' }}>
            Bu belgede köprü yok.
            <br />
            <span style={{ fontSize: '11px' }}>{t('links.empty-desc')}</span>
          </div>
        ) : (
          visible.map((link) => (
            <div
              key={link.id}
              style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 10px',
                marginBottom: '6px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                {link.kind === 'external' ? (
                  <ExternalLink size={13} color="#38bdf8" />
                ) : (
                  <Link2 size={13} color="#a855f7" />
                )}
                <span style={{ fontSize: '11px', fontWeight: 700, flex: 1 }}>
                  {link.kind === 'external' ? 'Dış adres' : 'Belge içi'}
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                  S{link.pageIndex + 1}
                </span>
                <button
                  className="btn-ghost"
                  style={{ fontSize: '10.5px', padding: '1px 5px', color: '#f43f5e' }}
                  onClick={() => onDeleteLink(link.id)}
                  title="Köprüyü kaldır"
                >
                  <Trash2 size={11} />
                </button>
              </div>

              <div
                onClick={() => onJumpToPage(link.kind === 'internal' && link.targetPageIndex !== undefined ? link.targetPageIndex : link.pageIndex)}
                style={{
                  fontSize: '11.5px',
                  color: 'var(--accent-primary)',
                  wordBreak: 'break-all',
                  cursor: 'pointer',
                  lineHeight: 1.4,
                }}
              >
                {link.kind === 'external'
                  ? link.url
                  : `Sayfa ${(link.targetPageIndex ?? 0) + 1}${link.targetPageIndex !== undefined && link.targetPageIndex >= totalPages ? ' (silinmiş)' : ''}`}
              </div>
            </div>
          ))
        )}

        {links.length > 0 && visible.length === 0 && (
          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', textAlign: 'center', padding: '20px 8px' }}>
            Eşleşen köprü yok.
          </div>
        )}
      </div>
    </div>
  );
};
