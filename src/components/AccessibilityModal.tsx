import React, { useEffect, useState } from 'react';
import {
  Accessibility,
  AlertTriangle,
  CheckCircle2,
  Image as ImageIcon,
  Info,
  Loader2,
  Tag,
  X,
} from 'lucide-react';
import { checkAccessibility, figureKey, type A11yFinding, type A11yReport } from '../utils/a11y';
import type { AccessibilityState, PDFDocumentState } from '../types/pdf';

interface AccessibilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  docState: PDFDocumentState;
  /** Called with the settings the user chose; they are written on the next save. */
  onApply: (accessibility: AccessibilityState) => void;
  onShowToast?: (text: string, type?: 'success' | 'error' | 'info') => void;
}

/** The languages the document can be marked with. */
const LANGUAGES: Array<{ value: string; label: string }> = [
  { value: 'tr', label: 'Türkçe' },
  { value: 'en', label: 'English' },
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Français' },
  { value: 'es', label: 'Español' },
  { value: 'it', label: 'Italiano' },
  { value: 'nl', label: 'Nederlands' },
  { value: 'ru', label: 'Русский' },
  { value: 'ar', label: 'العربية' },
  { value: 'ja', label: '日本語' },
];

/** The colour a severity is shown in. */
function severityColor(severity: A11yFinding['severity']): string {
  if (severity === 'error') return '#f43f5e';
  if (severity === 'warning') return '#f59e0b';
  return '#38bdf8';
}

/**
 * The accessibility checker.
 *
 * The report says what stands in the way of the document being read by a
 * screen reader, and the fixes are applied to the document itself: the
 * language, the title, the descriptions of the fields and the figures, and
 * the structure that ties the pages together.
 */
export const AccessibilityModal: React.FC<AccessibilityModalProps> = ({
  isOpen,
  onClose,
  docState,
  onApply,
  onShowToast,
}) => {
  const [report, setReport] = useState<A11yReport | null>(null);
  const [status, setStatus] = useState<'scanning' | 'ready' | 'failed'>('scanning');
  const [altTexts, setAltTexts] = useState<Record<string, string>>({});
  const [language, setLanguage] = useState('');
  const [title, setTitle] = useState('');
  const [tagged, setTagged] = useState(false);
  const [displayDocTitle, setDisplayDocTitle] = useState(false);
  const [fieldDescriptions, setFieldDescriptions] = useState(false);

  useEffect(() => {
    if (!isOpen || !docState.data) return;
    let cancelled = false;

    checkAccessibility(docState.data)
      .then((result) => {
        if (cancelled) return;
        setReport(result);
        setStatus('ready');

        // The state of the document is the starting point of the report, so
        // a fix that was already applied is not offered again.
        const existing = docState.accessibility ?? { tagged: false, altTexts: {} };
        setLanguage(existing.language ?? result.language ?? '');
        setTitle(existing.title ?? result.title ?? '');
        setTagged(existing.tagged || result.tagged);
        setDisplayDocTitle(existing.displayDocTitle ?? false);
        setFieldDescriptions(existing.fieldDescriptions ?? false);

        const texts: Record<string, string> = { ...existing.altTexts };
        for (const figure of result.figures) {
          if (figure.alt && texts[figureKey(figure.pageIndex, figure.name)] === undefined) {
            texts[figureKey(figure.pageIndex, figure.name)] = figure.alt;
          }
        }
        setAltTexts(texts);
      })
      .catch(() => {
        if (cancelled) return;
        setReport(null);
        setStatus('failed');
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, docState.data, docState.accessibility]);

  if (!isOpen) return null;

  const isScanning = status === 'scanning';

  const apply = () => {
    onApply({
      tagged,
      altTexts,
      language: language || undefined,
      title: title.trim() ? title : '',
      displayDocTitle: displayDocTitle || undefined,
      fieldDescriptions: fieldDescriptions || undefined,
    });
    onShowToast?.('Erişilebilirlik ayarları kaydedildi; dosyayı kaydedin.', 'success');
    onClose();
  };

  const errors = report?.findings.filter((f) => f.severity === 'error').length ?? 0;
  const warnings = report?.findings.filter((f) => f.severity === 'warning').length ?? 0;

  return (
    <div className="modal-backdrop">
      <div className="modal-card animate-fade-in" style={{ width: '720px', maxHeight: '88vh', overflow: 'auto' }}>
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
            <Accessibility size={18} color="var(--accent-primary)" />
            Erişilebilirlik Denetleyicisi
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Kapat">
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '16px 20px' }}>
          {isScanning ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '20px 0', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
              <Loader2 size={15} className="spin" /> Belge inceleniyor...
            </div>
          ) : (
            <>
              {/* The headline */}
              <div
                style={{
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'center',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  background:
                    errors > 0
                      ? 'rgba(244, 63, 94, 0.08)'
                      : warnings > 0
                        ? 'rgba(245, 158, 11, 0.08)'
                        : 'rgba(34, 197, 94, 0.08)',
                  border: `1px solid ${
                    errors > 0 ? 'rgba(244,63,94,0.3)' : warnings > 0 ? 'rgba(245,158,11,0.3)' : 'rgba(34,197,94,0.3)'
                  }`,
                  marginBottom: '14px',
                }}
              >
                {errors > 0 ? (
                  <AlertTriangle size={20} color="#f43f5e" />
                ) : warnings > 0 ? (
                  <AlertTriangle size={20} color="#f59e0b" />
                ) : (
                  <CheckCircle2 size={20} color="#22c55e" />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 700 }}>
                    {errors > 0
                      ? `${errors} hata, ${warnings} uyarı bulundu`
                      : warnings > 0
                        ? `${warnings} uyarı bulundu`
                        : 'Belgede bilinen bir sorun bulunamadı'}
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {report?.pageCount ?? 0} sayfa ·{' '}
                    {report?.tagged ? 'belge etiketli' : 'belge etiketli değil'} ·{' '}
                    {report?.figures.length ?? 0} görsel
                  </div>
                </div>
              </div>

              {/* The findings */}
              {report && report.findings.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                    Bulgular
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {report.findings.map((finding) => (
                      <div
                        key={finding.rule}
                        style={{
                          display: 'flex',
                          gap: '10px',
                          padding: '9px 11px',
                          borderRadius: 'var(--radius-md)',
                          background: 'var(--bg-tertiary)',
                          border: '1px solid var(--border-color)',
                        }}
                      >
                        <Info size={14} color={severityColor(finding.severity)} style={{ flexShrink: 0, marginTop: 2 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '12.5px', fontWeight: 700 }}>{finding.title}</div>
                          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: 1.5 }}>
                            {finding.detail}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                            {finding.rule}
                            {finding.pageIndex !== undefined ? ` · sayfa ${finding.pageIndex + 1}` : ''}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* The fixes */}
              <div
                style={{
                  background: 'var(--bg-secondary)',
                  padding: '14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  marginBottom: '16px',
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  Düzeltmeler
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={tagged}
                    onChange={(e) => setTagged(e.target.checked)}
                  />
                  <Tag size={14} color="#a855f7" />
                  Belgeyi etiketle (yapı ağacı oluştur)
                </label>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12.5px', width: '150px' }}>Belge dili</span>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    style={{
                      flex: 1,
                      minWidth: '160px',
                      fontSize: '12.5px',
                      padding: '6px 9px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <option value="">— belirtilmemiş —</option>
                    {LANGUAGES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12.5px', width: '150px' }}>Belge başlığı</span>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Başlık (boş bırakılırsa kaldırılır)"
                    style={{
                      flex: 1,
                      minWidth: '160px',
                      fontSize: '12.5px',
                      padding: '6px 9px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={displayDocTitle}
                    onChange={(e) => setDisplayDocTitle(e.target.checked)}
                  />
                  Okuyucunun pencere başlığında belge başlığını göster
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={fieldDescriptions}
                    onChange={(e) => setFieldDescriptions(e.target.checked)}
                  />
                  Form alanlarına açıklama ekle (alan adından)
                </label>
              </div>

              {/* The figures */}
              {report && report.figures.length > 0 && (
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                    Görseller ve açıklamaları
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {report.figures.map((figure) => {
                      const key = figureKey(figure.pageIndex, figure.name);
                      return (
                        <div
                          key={key}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '8px 11px',
                            borderRadius: 'var(--radius-md)',
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--border-color)',
                          }}
                        >
                          <ImageIcon size={14} color={altTexts[key] ? '#22c55e' : '#f59e0b'} style={{ flexShrink: 0 }} />
                          <span style={{ fontSize: '11.5px', color: 'var(--text-tertiary)', width: '64px', flexShrink: 0 }}>
                            Sayfa {figure.pageIndex + 1}
                          </span>
                          <input
                            value={altTexts[key] ?? ''}
                            onChange={(e) => setAltTexts((prev) => ({ ...prev, [key]: e.target.value }))}
                            placeholder="Görselin açıklaması (alt text)"
                            style={{
                              flex: 1,
                              minWidth: 0,
                              fontSize: '12.5px',
                              padding: '5px 9px',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--border-color)',
                              background: 'var(--bg-primary)',
                              color: 'var(--text-primary)',
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
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
          <button className="btn-primary" onClick={apply} disabled={isScanning}>
            Düzeltmeleri Uygula
          </button>
        </div>
      </div>
    </div>
  );
};
