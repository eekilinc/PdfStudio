import React, { useState } from 'react';
import {
  Bookmark,
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import type { PdfBookmark } from '../types/pdf';
import { t } from '../utils/i18n';

interface BookmarksPanelProps {
  bookmarks: PdfBookmark[];
  /** The page the viewer is on, used to mark the bookmarks of that page. */
  currentPageIndex: number;
  /** Move the viewer to the page a bookmark points at. */
  onJumpToPage: (pageIndex: number) => void;
  /** Add a bookmark, optionally under another one. */
  onAddBookmark: (parentId?: string) => void;
  /** Rename a bookmark. */
  onRenameBookmark: (id: string, title: string) => void;
  /** Remove a bookmark together with the ones nested under it. */
  onDeleteBookmark: (id: string) => void;
}

/**
 * The bookmarks of the document.
 *
 * The outline is written into the file, so a bookmark added here is in the
 * PDF itself and every reader shows it. The tree can be edited in place:
 * renamed, removed, and extended with a nested bookmark.
 */
export const BookmarksPanel: React.FC<BookmarksPanelProps> = ({
  bookmarks,
  currentPageIndex,
  onJumpToPage,
  onAddBookmark,
  onRenameBookmark,
  onDeleteBookmark,
}) => {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const startEditing = (bookmark: PdfBookmark) => {
    setEditing(bookmark.id);
    setDraft(bookmark.title);
  };

  const commit = (id: string) => {
    const title = draft.trim();
    if (title) onRenameBookmark(id, title);
    setEditing(null);
    setDraft('');
  };

  const renderItem = (bookmark: PdfBookmark, depth: number) => {
    const children = bookmark.children ?? [];
    const isCollapsed = collapsed[bookmark.id];
    const isEditing = editing === bookmark.id;

    return (
      <div key={bookmark.id}>
        <div
          className="btn-ghost"
          onClick={() => onJumpToPage(bookmark.pageIndex)}
          style={{
            justifyContent: 'flex-start',
            padding: '6px 8px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '12px',
            lineHeight: '1.4',
            textAlign: 'left',
            gap: '4px',
            width: '100%',
            opacity: bookmark.pageIndex === currentPageIndex ? 1 : 0.92,
          }}
        >
          {children.length > 0 ? (
            <span
              onClick={(e) => {
                e.stopPropagation();
                setCollapsed((prev) => ({ ...prev, [bookmark.id]: !prev[bookmark.id] }));
              }}
              style={{ display: 'flex', flexShrink: 0 }}
            >
              {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
            </span>
          ) : (
            <span style={{ width: 12, flexShrink: 0 }} />
          )}

          <Bookmark size={13} color="var(--accent-primary)" style={{ flexShrink: 0 }} />

          {isEditing ? (
            <input
              value={draft}
              autoFocus
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => commit(bookmark.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit(bookmark.id);
                if (e.key === 'Escape') setEditing(null);
              }}
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: '12px',
                padding: '2px 5px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--accent-primary)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
              }}
            />
          ) : (
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {bookmark.title}
            </span>
          )}

          {!isEditing && (
            <>
              <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', flexShrink: 0 }}>
                s. {bookmark.pageIndex + 1}
              </span>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onAddBookmark(bookmark.id);
                }}
                title="Alt yer imi ekle"
                style={{ display: 'flex', flexShrink: 0, color: 'var(--text-tertiary)' }}
              >
                <CornerDownRight size={11} />
              </span>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  startEditing(bookmark);
                }}
                title="Yeniden adlandır"
                style={{ display: 'flex', flexShrink: 0, color: 'var(--text-tertiary)' }}
              >
                <Pencil size={11} />
              </span>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteBookmark(bookmark.id);
                }}
                title="Sil"
                style={{ display: 'flex', flexShrink: 0, color: '#f43f5e' }}
              >
                <Trash2 size={11} />
              </span>
            </>
          )}
        </div>

        {!isCollapsed &&
          children.map((child) => renderItem(child, depth + 1))}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span style={{ fontSize: '11.5px', fontWeight: 700, flex: 1 }}>
          Yer İmleri ({countAll(bookmarks)})
        </span>
        <button
          className="btn-ghost"
          style={{ fontSize: '11px', padding: '3px 8px' }}
          onClick={() => onAddBookmark()}
          title="Bulunduğunuz sayfaya yer imi ekle"
        >
          <Plus size={12} /> Ekle
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 6px' }}>
        {bookmarks.length === 0 ? (
          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', lineHeight: 1.6, textAlign: 'center', padding: '24px 8px' }}>
            Bu belgede yer imi yok.
            <br />
            <span style={{ fontSize: '11px' }}>{t('bookmarks.empty-desc')}</span>
          </div>
        ) : (
          bookmarks.map((bookmark) => renderItem(bookmark, 0))
        )}
      </div>
    </div>
  );
};

/** The number of bookmarks in the tree, nested ones included. */
function countAll(bookmarks: PdfBookmark[]): number {
  return bookmarks.reduce((sum, b) => sum + 1 + countAll(b.children ?? []), 0);
}
