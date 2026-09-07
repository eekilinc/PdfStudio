import React, { useState } from 'react';
import { X, Image as ImageIcon, Download, Loader2 } from 'lucide-react';
import { getSharedPdfDoc } from '../utils/pdfInit';
import type { PDFDocumentState } from '../types/pdf';

interface ExportImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  docState: PDFDocumentState;
  currentPageNumber: number;
  onShowToast?: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export const ExportImageModal: React.FC<ExportImageModalProps> = ({
  isOpen,
  onClose,
  docState,
  currentPageNumber,
  onShowToast,
}) => {
  const [format, setFormat] = useState<'image/png' | 'image/jpeg'>('image/png');
  const [scale, setScale] = useState<number>(2.0); // 2x high resolution
  const [scope, setScope] = useState<'current' | 'all'>('current');
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);

  const notify = (text: string, type: 'success' | 'error' | 'info' = 'error') => {
    if (onShowToast) onShowToast(text, type);
    else alert(text);
  };

  if (!isOpen) return null;

  const handleExport = async () => {
    if (!docState.data) return;
    setIsExporting(true);
    setProgress(0);

    try {
      const pdf = await getSharedPdfDoc(docState.data);
      if (!pdf) throw new Error('PDF yüklenemedi');

      const ext = format === 'image/png' ? 'png' : 'jpg';
      const baseFilename = (docState.filename || 'Belge').replace(/\.pdf$/i, '');

      if (scope === 'current') {
        const page = await pdf.getPage(currentPageNumber);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas context hatası');

        await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;

        const dataUrl = canvas.toDataURL(format, 0.92);
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `${baseFilename}_Sayfa_${currentPageNumber}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        // Export all pages sequentially
        const activePages = docState.pageOrder
          .map((idx) => docState.pages.find((p) => p.pageIndex === idx))
          .filter((p) => p !== undefined && !p.isDeleted);

        for (let i = 0; i < activePages.length; i++) {
          const p = activePages[i];
          if (!p) continue;
          const page = await pdf.getPage(p.originalPageNumber);
          const viewport = page.getViewport({ scale, rotation: p.rotation || 0 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;

          await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;

          const dataUrl = canvas.toDataURL(format, 0.92);
          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = `${baseFilename}_Sayfa_${i + 1}.${ext}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);

          setProgress(Math.round(((i + 1) / activePages.length) * 100));
          await new Promise((r) => setTimeout(r, 150));
        }
      }

      notify('Resim dışa aktarma başarıyla tamamlandı.', 'success');
      onClose();
    } catch (err) {
      console.error('Image export error:', err);
      notify('Resim dışa aktarılırken hata oluştu: ' + (err as Error).message, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card animate-fade-in" style={{ width: '500px' }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ fontWeight: 600, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ImageIcon size={18} color="var(--accent-primary)" />
            <span>Sayfaları Resim (PNG/JPG) Olarak Dışa Aktar</span>
          </div>
          <button onClick={onClose} className="btn-icon" style={{ width: '28px', height: '28px' }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Scope Options */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
              Dışa Aktarılacak Alan:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                onClick={() => setScope('current')}
                className={`btn-ghost ${scope === 'current' ? 'active' : ''}`}
                style={{ padding: '10px', fontSize: '12px', justifyContent: 'center' }}
              >
                Yalnızca Mevcut Sayfa ({currentPageNumber})
              </button>
              <button
                onClick={() => setScope('all')}
                className={`btn-ghost ${scope === 'all' ? 'active' : ''}`}
                style={{ padding: '10px', fontSize: '12px', justifyContent: 'center' }}
              >
                Tüm Sayfalar ({docState.pageOrder.length} Sayfa)
              </button>
            </div>
          </div>

          {/* Format & Resolution Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {/* Format */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Resim Formatı:
              </label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as any)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '12px',
                  outline: 'none',
                }}
              >
                <option value="image/png">PNG (Kayıpsız & Net)</option>
                <option value="image/jpeg">JPEG (Küçük Boyut)</option>
              </select>
            </div>

            {/* Scale */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Çözünürlük Kalitesi:
              </label>
              <select
                value={scale}
                onChange={(e) => setScale(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '12px',
                  outline: 'none',
                }}
              >
                <option value={1.0}>1x Standart (72 DPI)</option>
                <option value={2.0}>2x Yüksek Kalite (150 DPI - Önerilen)</option>
                <option value={3.0}>3x Ultra Net (300 DPI - Baskı)</option>
              </select>
            </div>
          </div>

          {/* Progress Bar when exporting all */}
          {isExporting && scope === 'all' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ height: '6px', width: '100%', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: 'var(--accent-gradient)', transition: 'width 0.2s ease' }} />
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Sayfalar indiriliyor... (%{progress})</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-tertiary)',
        }}>
          <button onClick={onClose} className="btn-ghost" style={{ fontSize: '13px' }}>
            İptal
          </button>

          <button
            onClick={handleExport}
            disabled={isExporting}
            className="btn-primary"
            style={{ fontSize: '13px' }}
          >
            {isExporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            <span>{isExporting ? 'Dışa Aktarılıyor...' : 'Resim Olarak İndir'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
