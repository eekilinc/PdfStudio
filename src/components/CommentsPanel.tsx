import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Plus,
  Reply,
  Trash2,
  XCircle,
} from 'lucide-react';
import type { PdfComment, PdfCommentStatus } from '../types/pdf';
import { t, tpl } from '../utils/i18n';

interface CommentsPanelProps {
  comments: PdfComment[];
  /** Page the viewer is on, used to mark the comments of that page. */
  currentPageIndex: number;
  /** Move the viewer to the page a comment sits on. */
  onJumpToPage: (pageIndex: number) => void;
  /** Add a comment, optionally as a reply to another one. */
  onAddComment: (contents: string, parentId?: string) => void;
  /** Set or clear the review status of a comment. */
  onSetStatus: (id: string, status?: PdfCommentStatus) => void;
  /** Remove a comment together with its replies. */
  onDeleteComment: (id: string) => void;
  /** Put the viewer into the note tool, so the user can drop a comment. */
  onStartCommentTool: () => void;
}

/** The statuses a comment can be resolved with. */
const STATUSES: PdfCommentStatus[] = ['Accepted', 'Rejected', 'Completed', 'Cancelled'];

/** A short label for a status. */
const STATUS_LABELS: Record<PdfCommentStatus, string> = {
  Accepted: 'comments.status.accepted',
  Rejected: 'comments.status.rejected',
  Completed: 'comments.status.completed',
  Cancelled: 'comments.status.cancelled',
};

/** The icon of a comment kind. */
function KindIcon({ kind }: { kind: PdfComment['kind'] }) {
  const color = kind === 'note' ? '#f59e0b' : kind === 'highlight' ? '#22c55e' : '#38bdf8';
  return <MessageSquare size={13} color={color} />;
}

/** The date of a comment, in the reader's own language. */
function formatDate(value?: string): string {
  if (!value) return '';
  // PDF dates look like D:20260101120000+01'00'.
  const match = /^D:(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/.exec(value);
  if (!match) return value;
  const [, y, m, d, hh, mm] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * The comments of the document.
 *
 * A comment here is a real annotation in the file, so the panel is a
 * review list rather than a drawing layer: the comments can be answered,
 * resolved and removed, and every change is written into the PDF.
 */
export const CommentsPanel: React.FC<CommentsPanelProps> = ({
  comments,
  currentPageIndex,
  onJumpToPage,
  onAddComment,
  onSetStatus,
  onDeleteComment,
  onStartCommentTool,
}) => {
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const threads = useMemo(() => {
    const byParent = new Map<string | undefined, PdfComment[]>();
    for (const comment of comments) {
      const list = byParent.get(comment.parentId) ?? [];
      list.push(comment);
      byParent.set(comment.parentId, list);
    }
    return byParent.get(undefined) ?? [];
  }, [comments]);

  const repliesOf = (id: string) => comments.filter((c) => c.parentId === id);

  const submitReply = (parentId: string) => {
    const text = replyText.trim();
    if (!text) return;
    onAddComment(text, parentId);
    setReplyText('');
    setReplyTo(null);
  };

  const renderComment = (comment: PdfComment, isReply: boolean) => {
    const replies = repliesOf(comment.id);
    const isCollapsed = collapsed[comment.id];

    return (
      <div
        key={comment.id}
        style={{
          borderLeft: isReply ? '2px solid var(--border-color)' : 'none',
          marginLeft: isReply ? '10px' : 0,
          paddingLeft: isReply ? '8px' : 0,
          marginTop: '6px',
        }}
      >
        <div
          onClick={() => onJumpToPage(comment.pageIndex)}
          style={{
            background: 'var(--bg-tertiary)',
            border: `1px solid ${comment.pageIndex === currentPageIndex ? 'var(--accent-primary)' : 'var(--border-color)'}`,
            borderRadius: 'var(--radius-md)',
            padding: '8px 10px',
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <KindIcon kind={comment.kind} />
            <span style={{ fontSize: '11.5px', fontWeight: 700, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {comment.author || 'Anonim'}
            </span>
            <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
              {formatDate(comment.modified)}
            </span>
          </div>

          <div style={{ fontSize: '12px', lineHeight: 1.45, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {comment.contents || '(boş yorum)'}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
            {comment.status && (
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-full)',
                  background: comment.status === 'Accepted' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                  color: comment.status === 'Accepted' ? '#22c55e' : '#ef4444',
                }}
              >
                {t(STATUS_LABELS[comment.status])}
              </span>
            )}

            <button
              className="btn-ghost"
              style={{ fontSize: '10.5px', padding: '2px 6px' }}
              onClick={(e) => {
                e.stopPropagation();
                setReplyTo(replyTo === comment.id ? null : comment.id);
                setReplyText('');
              }}
            >
              <Reply size={11} /> {t('comments.panel.reply')}
            </button>

            <button
              className="btn-ghost"
              style={{ fontSize: '10.5px', padding: '2px 6px' }}
              title={t('comments.panel.status')}
              onClick={(e) => {
                e.stopPropagation();
                const index = comment.status ? STATUSES.indexOf(comment.status) : -1;
                const next = index >= 0 && index < STATUSES.length - 1 ? STATUSES[index + 1] : undefined;
                onSetStatus(comment.id, next);
              }}
            >
              {comment.status === 'Accepted' ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
              {t('comments.panel.status')}
            </button>

            <button
              className="btn-ghost"
              style={{ fontSize: '10.5px', padding: '2px 6px', color: '#f43f5e' }}
              onClick={(e) => {
                e.stopPropagation();
                onDeleteComment(comment.id);
              }}
            >
              <Trash2 size={11} />
            </button>

            {replies.length > 0 && (
              <button
                className="btn-ghost"
                style={{ fontSize: '10.5px', padding: '2px 6px' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setCollapsed((prev) => ({ ...prev, [comment.id]: !prev[comment.id] }));
                }}
              >
                {isCollapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
                {tpl('comments.panel.replies', { count: replies.length })}
              </button>
            )}
          </div>

          {replyTo === comment.id && (
            <div style={{ marginTop: '8px' }} onClick={(e) => e.stopPropagation()}>
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={t('comments.panel.replyPlaceholder')}
                autoFocus
                rows={3}
                style={{
                  width: '100%',
                  resize: 'vertical',
                  fontSize: '12px',
                  padding: '6px 8px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                }}
              />
              <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button className="btn-ghost" style={{ fontSize: '11px' }} onClick={() => setReplyTo(null)}>
                  Vazgeç
                </button>
                <button
                  className="btn-primary"
                  style={{ fontSize: '11px', padding: '4px 10px' }}
                  onClick={() => submitReply(comment.id)}
                  disabled={!replyText.trim()}
                >
                  Yanıtla
                </button>
              </div>
            </div>
          )}
        </div>

        {!isCollapsed && replies.map((reply) => renderComment(reply, true))}
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
          {tpl('comments.panel.title', { count: comments.length })}
        </span>
        <button
          className="btn-ghost"
          style={{ fontSize: '11px', padding: '3px 8px' }}
          onClick={onStartCommentTool}
          title={t('comments.panel.startTool')}
        >
          <Plus size={12} /> Ekle
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
        {threads.length === 0 ? (
          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', lineHeight: 1.6, textAlign: 'center', padding: '24px 8px' }}>
            Henüz yorum yok.
            <br />
            <span style={{ fontSize: '11px' }}>{t('comments.panel.empty-desc')}</span>
          </div>
        ) : (
          threads.map((comment) => renderComment(comment, false))
        )}
      </div>
    </div>
  );
};
