import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckSquare, List, Lock, Search, Type } from 'lucide-react';
import type { FormFieldInfo, FormFieldValue } from '../types/pdf';
import { t } from '../utils/i18n';

interface FormsPanelProps {
  fields: FormFieldInfo[];
  /** Values the user filled in, on top of the ones the file carries. */
  values: Record<string, FormFieldValue>;
  onChange: (name: string, value: FormFieldValue) => void;
  /** Move the viewer to the page a field sits on. */
  onJumpToPage: (pageIndex: number) => void;
}

/** The icon of a field kind. */
function KindIcon({ kind }: { kind: FormFieldInfo['kind'] }) {
  switch (kind) {
    case 'checkbox':
      return <CheckSquare size={13} color="#22c55e" />;
    case 'dropdown':
    case 'listbox':
      return <List size={13} color="#38bdf8" />;
    case 'signature':
      return <AlertTriangle size={13} color="#f59e0b" />;
    default:
      return <Type size={13} color="#a855f7" />;
  }
}

/**
 * The interactive form of the document.
 *
 * The fields are read out of the file itself, so the panel shows the form
 * the document really has — the one a reader sees — and the values entered
 * here are written into the form when the file is saved.
 */
export const FormsPanel: React.FC<FormsPanelProps> = ({ fields, values, onChange, onJumpToPage }) => {
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return fields;
    return fields.filter((f) => f.name.toLowerCase().includes(needle));
  }, [fields, query]);

  const valueOf = (field: FormFieldInfo): FormFieldValue => {
    if (Object.prototype.hasOwnProperty.call(values, field.name)) return values[field.name]!;
    return field.value;
  };

  if (fields.length === 0) {
    return (
      <div style={{ padding: '24px 14px', fontSize: '12px', color: 'var(--text-tertiary)', lineHeight: 1.6, textAlign: 'center' }}>
        Bu belgede etkileşimli form alanı yok.
        <br />
        <span style={{ fontSize: '11px' }}>{t('forms.empty-desc')}</span>
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    fontSize: '12px',
    padding: '5px 8px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
          <span style={{ fontSize: '11.5px', fontWeight: 700, flex: 1 }}>
            Form Alanları ({fields.length})
          </span>
        </div>
        <div style={{ position: 'relative' }}>
          <Search size={12} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Alan ara..."
            style={{ ...inputStyle, paddingLeft: '24px' }}
          />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
        {visible.map((field) => {
          const value = valueOf(field);

          return (
            <div
              key={field.name}
              style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 10px',
                marginBottom: '6px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <KindIcon kind={field.kind} />
                <span
                  style={{ fontSize: '11.5px', fontWeight: 700, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  title={field.name}
                >
                  {field.name}
                </span>
                {field.readOnly && <Lock size={11} color="var(--text-tertiary)" />}
                {field.required && (
                  <span style={{ color: '#ef4444', fontSize: '12px', fontWeight: 700 }}>*</span>
                )}
                {field.pageIndex >= 0 && (
                  <button
                    className="btn-ghost"
                    style={{ fontSize: '10px', padding: '1px 5px' }}
                    onClick={() => onJumpToPage(field.pageIndex)}
                    title="Sayfaya git"
                  >
                    S{field.pageIndex + 1}
                  </button>
                )}
              </div>

              {field.readOnly ? (
                <div style={{ fontSize: '11.5px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                  Salt okunur alan
                  {typeof value === 'string' && value ? `: ${value}` : ''}
                </div>
              ) : (
                <>
                  {field.kind === 'text' && (
                    <textarea
                      value={typeof value === 'string' ? value : ''}
                      rows={field.multiline ? 3 : 1}
                      placeholder="Değer girin..."
                      onChange={(e) => onChange(field.name, e.target.value)}
                      style={{ ...inputStyle, resize: 'vertical' }}
                    />
                  )}

                  {field.kind === 'checkbox' && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                      <input
                        type="checkbox"
                        checked={value === true}
                        onChange={(e) => onChange(field.name, e.target.checked)}
                      />
                      İşaretli
                    </label>
                  )}

                  {field.kind === 'radio' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {field.options.map((option) => (
                        <label key={option} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                          <input
                            type="radio"
                            name={field.name}
                            checked={value === option}
                            onChange={() => onChange(field.name, option)}
                          />
                          {option}
                        </label>
                      ))}
                      {field.options.length === 0 && (
                        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{t('forms.radio-none')}</span>
                      )}
                    </div>
                  )}

                  {(field.kind === 'dropdown' || field.kind === 'listbox') && (
                    <select
                      value={typeof value === 'string' ? value : ''}
                      onChange={(e) => onChange(field.name, e.target.value)}
                      style={inputStyle}
                    >
                      <option value="">— seçin —</option>
                      {field.options.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  )}

                  {field.kind === 'signature' && (
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                      İmza alanı — PDF'te dijital imza olarak doldurulur.
                    </div>
                  )}

                  {field.kind === 'button' && (
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{t('forms.button')}</div>
                  )}
                </>
              )}
            </div>
          );
        })}

        {visible.length === 0 && (
          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', textAlign: 'center', padding: '20px 8px' }}>
            Eşleşen alan yok.
          </div>
        )}
      </div>
    </div>
  );
};
