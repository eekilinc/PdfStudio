import React, { useState } from 'react';
import { X, ScanText, Copy, Check, Sparkles, Loader2, ArrowRight } from 'lucide-react';
import { createWorker } from 'tesseract.js';
import { getSharedPdfDoc } from '../utils/pdfInit';
import type { TextAnnotation } from '../types/pdf';

interface OcrModalProps {
  isOpen: boolean;
  onClose: () => void;
  docData: ArrayBuffer | null;
  pageNumber: number;
  pageIndex: number;
  onApplyOcrAnnotations: (pageIndex: number, annotations: TextAnnotation[]) => void;
  onShowToast?: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export const OcrModal: React.FC<OcrModalProps> = ({
  isOpen,
  onClose,
  docData,
  pageNumber,
  pageIndex,
  onApplyOcrAnnotations,
  onShowToast,
}) => {
  const [lang, setLang] = useState<'tur' | 'eng' | 'tur+eng'>('tur+eng');
  const [isProcessing, setIsProcessing] = useState(false);

  const notify = (text: string, type: 'success' | 'error' | 'info' = 'error') => {
    if (onShowToast) onShowToast(text, type);
    else alert(text);
  };
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [recognizedText, setRecognizedText] = useState<string>('');
  const [extractedLines, setExtractedLines] = useState<TextAnnotation[]>([]);
  const [isCopied, setIsCopied] = useState(false);

  if (!isOpen) return null;

  const handleStartOcr = async () => {
    if (!docData) return;
    setIsProcessing(true);
    setProgress(5);
    setStatusText('Sayfa taranıyor ve optimize ediliyor...');

    try {
      const pdf = await getSharedPdfDoc(docData);
      if (!pdf) throw new Error('PDF yüklenemedi');

      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 2.0 }); // 2x high-resolution snapshot for sharp OCR
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context oluşturulamadı');

      await page.render({
        canvasContext: ctx,
        viewport: viewport,
        canvas: canvas,
      } as any).promise;

      setProgress(25);
      setStatusText('OCR Motoru (Tesseract) başlatılıyor...');

      const worker = await createWorker(lang as any);
      
      setProgress(50);
      setStatusText('Karakterler tanınıyor ve analiz ediliyor...');

      const ret = await worker.recognize(canvas);
      await worker.terminate();

      setProgress(100);
      setStatusText('Tamamlandı!');

      setRecognizedText(ret.data.text);

      // Convert detected lines to TextAnnotations
      const lines: TextAnnotation[] = [];
      const scale = 2.0; // matched to snapshot scale

      const rawLines = (ret.data as any).lines || [];
      if (Array.isArray(rawLines)) {
        rawLines.forEach((line: any) => {
          const cleanText = (line.text || '').trim();
          if (!cleanText) return;

          const bbox = line.bbox || { x0: 50, y0: 50, x1: 200, y1: 70 };
          const x = bbox.x0 / scale;
          const y = bbox.y0 / scale;
          const w = (bbox.x1 - bbox.x0) / scale;
          const h = (bbox.y1 - bbox.y0) / scale;
          const fontSize = Math.max(10, Math.round(h * 0.85));

          lines.push({
            id: Math.random().toString(36).substring(2, 9),
            pageIndex: pageIndex,
            type: 'text',
            x: Math.round(x),
            y: Math.round(y),
            width: Math.max(80, Math.round(w)),
            height: Math.max(20, Math.round(h)),
            text: cleanText,
            fontSize: fontSize,
            fontFamily: 'Inter, sans-serif',
            color: '#0f172a',
            backgroundColor: '#ffffff', // Covers the scanned image text so user can edit cleanly
          });
        });
      }

      setExtractedLines(lines);
      notify('OCR metin tanıma tamamlandı.', 'success');
    } catch (err) {
      console.error('OCR Error:', err);
      notify('OCR işlemi sırasında bir hata oluştu: ' + (err as Error).message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = () => {
    if (!recognizedText) return;
    navigator.clipboard.writeText(recognizedText);
    setIsCopied(true);
    notify('Tanınan metin panoya kopyalandı.', 'info');
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleApplyToPdf = () => {
    if (extractedLines.length === 0) return;
    onApplyOcrAnnotations(pageIndex, extractedLines);
    notify('OCR metin katmanı PDF sayfasına uygulandı.', 'success');
    onClose();
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card animate-fade-in" style={{ width: '640px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        {/* Modal Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ fontWeight: 600, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ScanText size={18} color="var(--accent-primary)" />
            <span>OCR Metin Tanıma & Düzenleme (Sayfa {pageNumber})</span>
          </div>
          <button onClick={onClose} className="btn-icon" style={{ width: '28px', height: '28px' }}>
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Taranmış (görsel) veya resim tabanlı PDF sayfalarındaki metinleri tanıyarak **düzenlenebilir metin kutularına** dönüştürün.
          </div>

          {/* Controls */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-tertiary)',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 500 }}>Tanıma Dili:</span>
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value as any)}
                disabled={isProcessing}
                style={{
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '4px 8px',
                  fontSize: '12px',
                  outline: 'none',
                }}
              >
                <option value="tur+eng">Türkçe + İngilizce</option>
                <option value="tur">Sadece Türkçe</option>
                <option value="eng">Sadece İngilizce</option>
              </select>
            </div>

            <button
              onClick={handleStartOcr}
              disabled={isProcessing}
              className="btn-primary"
              style={{ fontSize: '12px', padding: '6px 14px' }}
            >
              {isProcessing ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Taranıyor (%{progress})</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  <span>OCR Taramasını Başlat</span>
                </>
              )}
            </button>
          </div>

          {/* Progress Indicator */}
          {isProcessing && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{
                height: '6px',
                width: '100%',
                background: 'var(--bg-tertiary)',
                borderRadius: '3px',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${progress}%`,
                  background: 'var(--accent-gradient)',
                  transition: 'width 0.3s ease',
                }} />
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{statusText}</div>
            </div>
          )}

          {/* Output TextArea */}
          {recognizedText && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Tanınan Metin ({extractedLines.length} Satır Tespit Edildi):
                </span>

                <button onClick={handleCopy} className="btn-ghost" style={{ fontSize: '11px', padding: '3px 8px' }}>
                  {isCopied ? <Check size={13} color="var(--success)" /> : <Copy size={13} />}
                  <span>{isCopied ? 'Kopyalandı!' : 'Metni Kopyala'}</span>
                </button>
              </div>

              <textarea
                value={recognizedText}
                onChange={(e) => setRecognizedText(e.target.value)}
                rows={8}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '12px',
                  resize: 'vertical',
                  outline: 'none',
                  lineHeight: '1.5',
                }}
              />
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-tertiary)',
        }}>
          <button onClick={onClose} className="btn-ghost" style={{ fontSize: '13px' }}>
            Kapat
          </button>

          {extractedLines.length > 0 && (
            <button
              onClick={handleApplyToPdf}
              className="btn-primary"
              style={{ fontSize: '13px' }}
            >
              <ArrowRight size={15} /> Metinleri PDF'e Düzenlenebilir Olarak Aktar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
