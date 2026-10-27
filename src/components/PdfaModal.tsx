import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileBadge, Info, Loader2, X } from 'lucide-react';
import { checkPdfA, type PdfaFinding, type PdfaReport } from '../utils/pdfa';
import type { PDFDocumentState } from '../types/pdf';

interface PdfaModalProps {
  isOpen: boolean;
  onClose: () => void;
  docState: PDFDocumentState;
  /** Called with the chosen target; it is written when the document is saved. */
  onApply: (target: { part: string; conformance: string }) => void;
  onShowToast?: (text: string, type?: 'success' | 'error' | 'info') => void;
}

/** The targets the application can write. */
const TARGETS: Array<{ part: string; conformance: string; label: string }> = [
  { part: '2', conformance: 'B', label: 'PDF/A-2b — genel erişilebilirlik' },
  { part: '3', conformance: 'B', label: 'PDF/A-3b — ek dosyalara izin verir' },
];

/** The colour a severity is shown in. */
function severityColor(severity: PdfaFinding['severity']): string {
  if (severity === 'error') return '#f43f5e';
  if (severity === 'warning') return '#f59e0b';
  return '#38bdf8';
}

/**
 * The archival check of the document.
 *
 * The report says what the document still needs to be a PDF/A file, and
 * the preparation writes what can be written: the metadata that declares
 * the part and the conformance, the identifier of the file and the title.
 */
export const PdfaModal: React.FC<PdfaModalProps> = ({
  isOpen,
  onClose,
  docState,
  onApply,
  onShowToast,
}) => {
  const [report, setReport] = useState<PdfaReport | null>(null);
  const [status, setStatus] = useState<'scanning' | 'ready' | 'failed'>('scanning');
  const [target, setTarget] = useState(TARGETS[0]!);

  useEffect(() => {
    if (!isOpen || !docState.data) return;
    let cancelled = false;

    checkPdfA(docState.data)
      .then((result) => {
        if (cancelled) return;
        setReport(result);
        setStatus('ready');
        if (result.declared) {
          const match = TARGETS.find(
            (t) => t.part === result.declared!.part && t.conformance === result.declared!.conformance,
          );
          if (match) setTarget(match);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setReport(null);
        setStatus('failed');
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, docState.data]);

  if (!isOpen) return null;

  const isScanning = status === 'scanning';
  const errors = report?.findings.filter((f) => f.severity === 'error').length ?? 0;
  const warnings = report?.findings.filter((f) => f.severity === 'warning').length ?? 0;

  const apply = () => {
    onApply({ part: target.part, conformance: target.conformance });
    onShowToast?.('PDF/A bildirimi kaydedildi; dosyayı kaydedin.', 'success');
    onClose();
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card animate-fade-in" style={{ width: '640px', maxHeight: '85vh', overflow: 'auto' }}>
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
            <FileBadge size={18} color="var(--accent-primary)" />
            PDF/A Hazırlığı
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
              <div
                style={{
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'center',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: errors > 0 ? 'rgba(244, 63, 94, 0.08)' : 'rgba(34, 197, 94, 0.08)',
                  border: `1px solid ${errors > 0 ? 'rgba(244,63,94,0.3)' : 'rgba(34,197,94,0.3)'}`,
                  marginBottom: '14px',
                }}
              >
                {errors > 0 ? (
                  <AlertTriangle size={20} color="#f43f5e" />
                ) : (
                  <CheckCircle2 size={20} color="#22c55e" />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 700 }}>
                    {errors > 0
                      ? `${errors} hata, ${warnings} uyarı bulundu`
                      : warnings > 0
                        ? `${warnings} uyarı bulundu`
                        : 'Belge PDF/A koşullarını karşılıyor'}
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {report?.declared
                      ? `Belge ${report.declared.part} uyumluluğu (${report.declared.conformance}) bildiriyor.`
                      : 'Belge henüz bir PDF/A uyumluluğu bildirmiyor.'}
                  </div>
                </div>
              </div>

              {report && report.findings.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                    Eksikler
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
                            {finding.fixable ? ' · uygulama yazabilir' : ' · elle yapılmalı'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div
                style={{
                  background: 'var(--bg-secondary)',
                  padding: '14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  Hedef
                </div>
                {TARGETS.map((item) => (
                  <label
                    key={`${item.part}${item.conformance}`}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', cursor: 'pointer' }}
                  >
                    <input
                      type="radio"
                      name="pdfa-target"
                      checked={target.part === item.part && target.conformance === item.conformance}
                      onChange={() => setTarget(item)}
                    />
                    {item.label}
                  </label>
                ))}

                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', lineHeight: 1.5, marginTop: '4px' }}>
                  Hazırlık, belgeye PDF/A bildirimini (XMP meta verisi), dosya kimliğini ve başlığı
                  yazar. **Çıktı amacının renk profili** uygulama tarafından üretilemez; bu adım
                  profesyonel bir araçla yapılmalıdır.
                </div>
              </div>
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
            PDF/A Hazırlığını Uygula
          </button>
        </div>
      </div>
    </div>
  );
};
