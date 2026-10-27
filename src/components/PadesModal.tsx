import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, Lock, X } from 'lucide-react';
import { checkPades, type PadesFinding, type PadesReport } from '../utils/pades';
import type { PDFDocumentState } from '../types/pdf';

interface PadesModalProps {
  isOpen: boolean;
  onClose: () => void;
  docState: PDFDocumentState;
  onShowToast?: (text: string, type?: 'success' | 'error' | 'info') => void;
}

/** The colour a severity is shown in. */
function severityColor(severity: PadesFinding['severity']): string {
  if (severity === 'error') return '#f43f5e';
  if (severity === 'warning') return '#f59e0b';
  return '#38bdf8';
}

/**
 * The PAdES readiness of the document.
 *
 * The report says what the document still needs to carry a digitally signed
 * version; the actual signing requires a native crypto stack and is performed
 * by the Tauri backend.
 */
export const PadesModal: React.FC<PadesModalProps> = ({
  isOpen,
  onClose,
  docState,
  onShowToast: _onShowToast,
}) => {
  const [report, setReport] = useState<PadesReport | null>(null);
  const [status, setStatus] = useState<'scanning' | 'ready' | 'failed'>('scanning');

  useEffect(() => {
    if (!isOpen || !docState.data) return;
    let cancelled = false;

    checkPades(docState.data)
      .then((result) => {
        if (cancelled) return;
        setReport(result);
        setStatus('ready');
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
            <Lock size={18} color="var(--accent-primary)" />
            PAdES Dijital İmza Hazırlığı
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
                  background: errors > 0 ? 'rgba(244, 63, 94, 0.08)' : warnings > 0 ? 'rgba(245, 158, 11, 0.08)' : 'rgba(34, 197, 94, 0.08)',
                  marginBottom: '12px',
                }}
              >
                {errors > 0 ? (
                  <AlertTriangle size={18} color="#f43f5e" />
                ) : warnings > 0 ? (
                  <AlertTriangle size={18} color="#f59e0b" />
                ) : (
                  <CheckCircle2 size={18} color="#22c55e" />
                )}
                <div style={{ fontSize: '12.5px', fontWeight: 600 }}>
                  {errors} hata, {warnings} uyarı, {report?.findings.length ?? 0} bulgu
                </div>
              </div>

              {report?.findings.map((f, i) => (
                <div
                  key={i}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    marginBottom: '8px',
                    background: 'var(--bg-secondary)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: severityColor(f.severity),
                      }}
                    >
                      {f.severity}
                    </span>
                    <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)' }}>{f.title}</span>
                    <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-muted)' }}>
                      {f.fixable ? 'uygulanabilir' : 'elle'}
                    </span>
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{f.detail}</div>
                </div>
              ))}

              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(56, 189, 248, 0.06)',
                  fontSize: '11.5px',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5,
                  marginTop: '8px',
                }}
              >
                <Info size={12} style={{ verticalAlign: 'middle', marginRight: '6px', color: 'var(--accent-primary)' }} />
                PAdES imzası için bir sertifika (PKCS#12) ve bir zaman damgası servisi (TSA) gerekir. Uygulama şu an
                yalnızca hazırlık raporu üretir; gerçek imzalama native bir crypto yığını ile Tauri arka ucunda yapılmalıdır.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
