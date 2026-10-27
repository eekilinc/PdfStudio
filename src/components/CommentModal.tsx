import React, { useState } from 'react';
import { MessageSquare, X } from 'lucide-react';

interface CommentModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called with the text of the comment. */
  onSubmit: (contents: string) => void;
  /** The page the comment is placed on, shown in the header. */
  pageNumber?: number;
  /** The author written into the comment. */
  author?: string;
}

/**
 * Asks for the text of a comment.
 *
 * The comment itself is a real annotation in the file, so it carries an
 * author and a date and can be answered later.
 */
export const CommentModal: React.FC<CommentModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  pageNumber,
  author,
}) => {
  const [text, setText] = useState('');

  if (!isOpen) return null;

  const submit = () => {
    const value = text.trim();
    if (!value) return;
    onSubmit(value);
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
            <MessageSquare size={18} color="#f59e0b" />
            Yorum Ekle
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
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit();
            }}
            placeholder="Yorumunuzu yazın..."
            rows={5}
            autoFocus
            style={{
              width: '100%',
              resize: 'vertical',
              fontSize: '13px',
              lineHeight: 1.5,
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
            }}
          />
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '8px' }}>
            Yorum, PDF dosyasına gerçek bir açıklama olarak yazılır; diğer okuyucular da görür.
            {author && ` Yazar: ${author}.`}
          </div>
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
          <button className="btn-primary" onClick={submit} disabled={!text.trim()}>
            Ekle
          </button>
        </div>
      </div>
    </div>
  );
};
