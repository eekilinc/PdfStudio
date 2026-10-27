import React, { useEffect, useState } from 'react';
import { Loader2, ScanSearch, ShieldCheck, X } from 'lucide-react';
import { scanDocument } from '../utils/pdfInspect';
import type { PDFDocumentState, SanitizeFinding, SanitizeOptions } from '../types/pdf';

interface DocumentInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  docState: PDFDocumentState;
  /** Called with the options the user chose; they are applied on the next save. */
  onApply: (options: SanitizeOptions) => void;
  onShowToast?: (text: string, type?: 'success' | 'error' | 'info') => void;
}

/** The entries of the inspector, in the order they are shown. */
const CATEGORIES: Array<{ key: keyof SanitizeOptions; label: string; detail: string }> = [
  {
    key: 'metadata',
    label: 'Belge bilgileri',
    detail: 'Başlık, yazar, konu, anahtar kelimeler ve üretici bilgisi',
  },
  {
    key: 'xmp',
    label: 'XMP meta verisi',
    detail: 'Genişletilmiş meta veri akışı',
  },
  {
    key: 'attachments',
    label: 'Gömülü dosyalar',
    detail: 'PDF içine eklenmiş ekler',
  },
  {
    key: 'javascript',
    label: 'Betikler ve otomatik eylemler',
    detail: 'Belge düzeyinde JavaScript ve açılış eylemleri',
  },
  {
    key: 'links',
    label: 'Köprüler',
    detail: 'Sayfadaki dış bağlantılar',
  },
  {
    key: 'formFields',
    label: 'Etkileşimli form alanları',
    detail: 'Doldurulabilir alanlar ve bunların görünümleri',
  },
  {
    key: 'comments',
    label: 'Yorumlar',
    detail: 'Notlar, vurgular ve yanıtlar',
  },
];

/**
 * The document inspector.
 *
 * It reports what the file carries that a reader does not need — hidden
 * metadata, embedded files, scripts — and removes the chosen parts when
 * the document is written. The removal is applied on save rather than
 * immediately, so the user can undo it like any other change.
 */
export const DocumentInspectorModal: React.FC<DocumentInspectorModalProps> = ({
  isOpen,
  onClose,
  docState,
  onApply,
  onShowToast,
}) => {
  const [findings, setFindings] = useState<SanitizeFinding[] | null>(null);
  const [options, setOptions] = useState<SanitizeOptions>({});

  useEffect(() => {
    if (!isOpen || !docState.data) return;
    let cancelled = false;

    scanDocument(docState.data)
      .then((result) => {
        if (!cancelled) setFindings(result);
      })
      .catch(() => {
        if (!cancelled) setFindings([]);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, docState.data]);

  if (!isOpen) return null;

  /** The scan has not answered yet. */
  const isScanning = findings === null;

  const countFor = (key: keyof SanitizeOptions) =>
    (findings ?? []).filter((f) => f.category === key).reduce((sum, f) => sum + f.count, 0);

  const toggle = (key: keyof SanitizeOptions) => {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const apply = () => {
    const selected = Object.entries(options).filter(([, value]) => value).map(([key]) => key);
    if (selected.length === 0) {
      onShowToast?.('Kaldırılacak bir şey seçilmedi.', 'info');
      return;
    }
    onApply(options);
    onShowToast?.(
      `Seçilen ${selected.length} öğe kaydedildiğinde kaldırılacak. Dosyayı kaydedin.`,
      'success',
    );
    onClose();
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card animate-fade-in" style={{ width: '560px', maxHeight: '85vh', overflow: 'auto' }}>
        {/* Header */}
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
            <ScanSearch size={18} color="var(--accent-primary)" />
            Belge Denetleyicisi
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Kapat">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 20px' }}>
          <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: 0 }}>
            Belgenin içinde gizli bilgi veya riskli içerik olup olmadığını inceleyin. Seçtiğiniz öğeler
            dosya kaydedildiğinde kaldırılır; işlem geri alınabilir.
          </p>

          {isScanning ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '20px 0', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
              <Loader2 size={15} className="spin" /> Belge taranıyor...
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {CATEGORIES.map((category) => {
                const count = countFor(category.key);
                const checked = !!options[category.key];
                return (
                  <label
                    key={category.key}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      padding: '10px 12px',
                      border: `1px solid ${checked ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                      background: checked ? 'rgba(56, 189, 248, 0.07)' : 'var(--bg-tertiary)',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(category.key)}
                      style={{ marginTop: 2 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12.5px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {category.label}
                        {count > 0 ? (
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: 'var(--radius-full)',
                              background: 'rgba(239, 68, 68, 0.15)',
                              color: '#f87171',
                            }}
                          >
                            {count} bulundu
                          </span>
                        ) : (
                          <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                            bulunamadı
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                        {category.detail}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}

          <div
            style={{
              marginTop: '14px',
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              display: 'flex',
              gap: '8px',
              fontSize: '11.5px',
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
            }}
          >
            <ShieldCheck size={15} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
            Kaldırma işlemi dosyaya yazıldığında uygulanır. Belgenin görünümü korunur; yalnızca
            seçilen bilgiler dosyadan çıkarılır.
          </div>
        </div>

        {/* Footer */}
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
            Seçimleri Uygula
          </button>
        </div>
      </div>
    </div>
  );
};
