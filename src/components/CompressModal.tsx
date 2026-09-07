import React, { useState } from 'react';
import { X, Minimize2, Loader2, FileDown } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { getSharedPdfDoc } from '../utils/pdfInit';
import type { PDFDocumentState } from '../types/pdf';

interface CompressModalProps {
  isOpen: boolean;
  onClose: () => void;
  docState: PDFDocumentState;
  onShowToast?: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export const CompressModal: React.FC<CompressModalProps> = ({ isOpen, onClose, docState, onShowToast }) => {
  const [level, setLevel] = useState<'low' | 'medium' | 'high'>('medium');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const notify = (text: string, type: 'success' | 'error' | 'info' = 'error') => {
    if (onShowToast) onShowToast(text, type);
    else alert(text);
  };

  if (!isOpen) return null;

  const currentSizeMb = (docState.fileSize / (1024 * 1024)).toFixed(2);

  const handleCompress = async () => {
    if (!docState.data) return;
    setIsProcessing(true);
    setProgress(10);

    try {
      const pdf = await getSharedPdfDoc(docState.data);
      if (!pdf) throw new Error('PDF yüklenemedi');

      const newPdfDoc = await PDFDocument.create();

      // Quality scale & JPEG compression quality by level
      let scale = 1.5;
      let quality = 0.75;

      if (level === 'low') {
        scale = 1.8;
        quality = 0.85;
      } else if (level === 'high') {
        scale = 1.0;
        quality = 0.55;
      }

      const activePages = docState.pageOrder
        .map((idx) => docState.pages.find((p) => p.pageIndex === idx))
        .filter((p) => p !== undefined && !p.isDeleted);

      for (let i = 0; i < activePages.length; i++) {
        const pageState = activePages[i];
        if (!pageState) continue;

        const pdfPage = await pdf.getPage(pageState.originalPageNumber);
        const viewport = pdfPage.getViewport({ scale, rotation: pageState.rotation || 0 });

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;

        await pdfPage.render({ canvasContext: ctx, viewport, canvas } as any).promise;

        const jpegDataUrl = canvas.toDataURL('image/jpeg', quality);
        const jpegBytes = await fetch(jpegDataUrl).then((res) => res.arrayBuffer());
        const embeddedImage = await newPdfDoc.embedJpg(jpegBytes);

        const newPage = newPdfDoc.addPage([pageState.width || 595.28, pageState.height || 841.89]);
        newPage.drawImage(embeddedImage, {
          x: 0,
          y: 0,
          width: pageState.width || 595.28,
          height: pageState.height || 841.89,
        });

        setProgress(Math.round(10 + ((i + 1) / activePages.length) * 85));
      }

      const compressedBytes = await newPdfDoc.save();
      const blob = new Blob([compressedBytes as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      const baseName = docState.filename ? docState.filename.replace('.pdf', '') : 'Belge';
      a.download = `${baseName}_Sikistirilmis_Optimize.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      notify('PDF başarıyla optimize edildi ve indirildi.', 'success');
      onClose();
    } catch (err) {
      console.error('Compress error:', err);
      notify('Sıkıştırma sırasında bir hata oluştu: ' + (err as Error).message, 'error');
    } finally {
      setIsProcessing(false);
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
            <Minimize2 size={18} color="var(--accent-primary)" />
            <span>PDF Boyutu Küçültme & Optimizasyon</span>
          </div>
          <button onClick={onClose} className="btn-icon" style={{ width: '28px', height: '28px' }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            background: 'var(--bg-tertiary)',
            padding: '12px 14px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12px',
          }}>
            <span style={{ color: 'var(--text-secondary)' }}>Mevcut Dosya Boyutu:</span>
            <span style={{ fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-primary)' }}>
              {currentSizeMb} MB
            </span>
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
              Sıkıştırma Seviyesi:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              <button
                onClick={() => setLevel('low')}
                className={`btn-ghost ${level === 'low' ? 'active' : ''}`}
                style={{ flexDirection: 'column', padding: '10px 6px', gap: '2px' }}
              >
                <span style={{ fontWeight: 600, fontSize: '12px' }}>Düşük</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Maksimum Kalite</span>
              </button>

              <button
                onClick={() => setLevel('medium')}
                className={`btn-ghost ${level === 'medium' ? 'active' : ''}`}
                style={{ flexDirection: 'column', padding: '10px 6px', gap: '2px' }}
              >
                <span style={{ fontWeight: 600, fontSize: '12px' }}>Dengeli</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Önerilen Seviye</span>
              </button>

              <button
                onClick={() => setLevel('high')}
                className={`btn-ghost ${level === 'high' ? 'active' : ''}`}
                style={{ flexDirection: 'column', padding: '10px 6px', gap: '2px' }}
              >
                <span style={{ fontWeight: 600, fontSize: '12px' }}>Güçlü</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>En Küçük Boyut</span>
              </button>
            </div>
          </div>

          {isProcessing && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ height: '6px', width: '100%', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: 'var(--accent-gradient)', transition: 'width 0.2s ease' }} />
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Optimizasyon yapılıyor... (%{progress})</div>
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
            onClick={handleCompress}
            disabled={isProcessing}
            className="btn-primary"
            style={{ fontSize: '13px' }}
          >
            {isProcessing ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />}
            <span>{isProcessing ? 'Sıkıştırılıyor...' : 'Sıkıştır & İndir'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
