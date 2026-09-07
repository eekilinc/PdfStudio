import React, { useState } from 'react';
import { X, Scissors, Download, FileDown, Layers, Check, Loader2 } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import type { PDFDocumentState, PageState } from '../types/pdf';

interface SplitPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  docState: PDFDocumentState;
  onShowToast?: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export const SplitPdfModal: React.FC<SplitPdfModalProps> = ({ isOpen, onClose, docState, onShowToast }) => {
  const [splitMode, setSplitMode] = useState<'range' | 'single' | 'even_odd' | 'chunk'>('range');
  const [rangeInput, setRangeInput] = useState('1-3');
  const [chunkSize, setChunkSize] = useState(2);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const notify = (text: string, type: 'success' | 'error' | 'info' = 'error') => {
    if (onShowToast) onShowToast(text, type);
    else alert(text);
  };

  if (!isOpen) return null;

  const activePages = docState.pageOrder
    .map((idx) => docState.pages.find((p) => p.pageIndex === idx))
    .filter((p): p is PageState => p !== undefined && !p.isDeleted);

  const totalPages = activePages.length;

  // Parse page ranges e.g. "1-3, 5, 8-10"
  const parsePageRange = (input: string, max: number): number[] => {
    const pages = new Set<number>();
    const parts = input.split(/[,;\s]+/).filter(Boolean);

    parts.forEach((part) => {
      if (part.includes('-')) {
        const [startStr, endStr] = part.split('-');
        const start = Math.max(1, parseInt(startStr, 10));
        const end = Math.min(max, parseInt(endStr, 10));
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = start; i <= end; i++) pages.add(i);
        }
      } else {
        const num = parseInt(part, 10);
        if (!isNaN(num) && num >= 1 && num <= max) pages.add(num);
      }
    });

    return Array.from(pages).sort((a, b) => a - b);
  };

  const handleSplit = async () => {
    if (!docState.data) return;
    setIsProcessing(true);
    setProgress(10);

    try {
      const srcDoc = await PDFDocument.load(docState.data);
      const baseFilename = (docState.filename || 'Belge').replace(/\.pdf$/i, '');

      if (splitMode === 'range') {
        const targetPageNumbers = parsePageRange(rangeInput, totalPages);
        if (targetPageNumbers.length === 0) {
          notify('Geçerli bir sayfa aralığı girin (Örn: 1-5 veya 2, 4, 7-9).', 'error');
          setIsProcessing(false);
          return;
        }

        const outDoc = await PDFDocument.create();
        const pageIndicesToCopy = targetPageNumbers.map((num) => activePages[num - 1].originalPageNumber - 1);
        const copied = await outDoc.copyPages(srcDoc, pageIndicesToCopy);
        copied.forEach((p) => outDoc.addPage(p));

        const bytes = await outDoc.save();
        downloadPdfBytes(bytes, `${baseFilename}_Sayfalar_${rangeInput.replace(/\s+/g, '_')}.pdf`);
      } else if (splitMode === 'single') {
        // Download each page individually
        for (let i = 0; i < totalPages; i++) {
          const outDoc = await PDFDocument.create();
          const [copied] = await outDoc.copyPages(srcDoc, [activePages[i].originalPageNumber - 1]);
          outDoc.addPage(copied);

          const bytes = await outDoc.save();
          downloadPdfBytes(bytes, `${baseFilename}_Sayfa_${i + 1}.pdf`);
          setProgress(Math.round(((i + 1) / totalPages) * 100));
          await new Promise((r) => setTimeout(r, 150));
        }
      } else if (splitMode === 'even_odd') {
        // Odd pages (1, 3, 5...)
        const oddIndices = activePages.filter((_, idx) => (idx + 1) % 2 !== 0).map((p) => p.originalPageNumber - 1);
        if (oddIndices.length > 0) {
          const oddDoc = await PDFDocument.create();
          const copiedOdd = await oddDoc.copyPages(srcDoc, oddIndices);
          copiedOdd.forEach((p) => oddDoc.addPage(p));
          const oddBytes = await oddDoc.save();
          downloadPdfBytes(oddBytes, `${baseFilename}_Tek_Sayfalar.pdf`);
        }

        await new Promise((r) => setTimeout(r, 200));

        // Even pages (2, 4, 6...)
        const evenIndices = activePages.filter((_, idx) => (idx + 1) % 2 === 0).map((p) => p.originalPageNumber - 1);
        if (evenIndices.length > 0) {
          const evenDoc = await PDFDocument.create();
          const copiedEven = await evenDoc.copyPages(srcDoc, evenIndices);
          copiedEven.forEach((p) => evenDoc.addPage(p));
          const evenBytes = await evenDoc.save();
          downloadPdfBytes(evenBytes, `${baseFilename}_Cift_Sayfalar.pdf`);
        }
      } else if (splitMode === 'chunk') {
        // Split by chunks of N pages
        const chunkCount = Math.ceil(totalPages / chunkSize);
        for (let c = 0; c < chunkCount; c++) {
          const chunkPages = activePages.slice(c * chunkSize, (c + 1) * chunkSize);
          const chunkIndices = chunkPages.map((p) => p.originalPageNumber - 1);

          const outDoc = await PDFDocument.create();
          const copied = await outDoc.copyPages(srcDoc, chunkIndices);
          copied.forEach((p) => outDoc.addPage(p));

          const bytes = await outDoc.save();
          downloadPdfBytes(bytes, `${baseFilename}_Bolum_${c + 1}.pdf`);
          setProgress(Math.round(((c + 1) / chunkCount) * 100));
          await new Promise((r) => setTimeout(r, 150));
        }
      }

      notify('PDF sayfaları başarıyla ayrıştırıldı ve indirildi.', 'success');
      onClose();
    } catch (err) {
      console.error('Split error:', err);
      notify('Bölme işlemi sırasında hata oluştu: ' + (err as Error).message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadPdfBytes = (bytes: Uint8Array, filename: string) => {
    const blob = new Blob([bytes as any], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card animate-fade-in" style={{ width: '520px' }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ fontWeight: 600, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Scissors size={18} color="var(--accent-primary)" />
            <span>PDF Sayfalarını Böl & Ayıkla (Split PDF)</span>
          </div>
          <button onClick={onClose} className="btn-icon" style={{ width: '28px', height: '28px' }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Mode Selection Grid */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
              Bölme Yöntemi:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                onClick={() => setSplitMode('range')}
                className={`btn-ghost ${splitMode === 'range' ? 'active' : ''}`}
                style={{ padding: '10px 12px', fontSize: '12px', justifyContent: 'flex-start', gap: '8px' }}
              >
                <Scissors size={14} color="var(--accent-primary)" />
                <span>Sayfa Aralığı Çıkar</span>
              </button>

              <button
                onClick={() => setSplitMode('single')}
                className={`btn-ghost ${splitMode === 'single' ? 'active' : ''}`}
                style={{ padding: '10px 12px', fontSize: '12px', justifyContent: 'flex-start', gap: '8px' }}
              >
                <Layers size={14} color="#38bdf8" />
                <span>Her Sayfayı Ayrı PDF Yap</span>
              </button>

              <button
                onClick={() => setSplitMode('even_odd')}
                className={`btn-ghost ${splitMode === 'even_odd' ? 'active' : ''}`}
                style={{ padding: '10px 12px', fontSize: '12px', justifyContent: 'flex-start', gap: '8px' }}
              >
                <FileDown size={14} color="#10b981" />
                <span>Tek / Çift Sayfaları Ayır</span>
              </button>

              <button
                onClick={() => setSplitMode('chunk')}
                className={`btn-ghost ${splitMode === 'chunk' ? 'active' : ''}`}
                style={{ padding: '10px 12px', fontSize: '12px', justifyContent: 'flex-start', gap: '8px' }}
              >
                <Download size={14} color="#f59e0b" />
                <span>Sayfa Sayısına Göre Böl</span>
              </button>
            </div>
          </div>

          {/* Mode Customization Options */}
          {splitMode === 'range' && (
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Çıkarılacak Sayfalar:
              </label>
              <input
                type="text"
                value={rangeInput}
                onChange={(e) => setRangeInput(e.target.value)}
                placeholder="Örn: 1-5, 8, 11-14"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Toplam {totalPages} sayfa mevcut. Aralıkları virgülle ayırabilirsiniz.
              </div>
            </div>
          )}

          {splitMode === 'chunk' && (
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Her Kaç Sayfada Bir Bölünsün?
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={chunkSize}
                  onChange={(e) => setChunkSize(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  style={{
                    width: '80px',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Sayfa (Toplam {Math.ceil(totalPages / chunkSize)} ayrı PDF oluşturulacak)
                </span>
              </div>
            </div>
          )}

          {splitMode === 'even_odd' && (
            <div style={{
              background: 'var(--bg-tertiary)',
              padding: '12px',
              borderRadius: 'var(--radius-md)',
              fontSize: '12px',
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
            }}>
              Belgeniz <strong>Tek Sayfalar (1, 3, 5...)</strong> ve <strong>Çift Sayfalar (2, 4, 6...)</strong> olmak üzere 2 ayrı PDF dosyası olarak indirilecektir.
            </div>
          )}

          {isProcessing && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ height: '6px', width: '100%', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: 'var(--accent-gradient)', transition: 'width 0.2s ease' }} />
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Sayfalar ayıklanıyor... (%{progress})</div>
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
            onClick={handleSplit}
            disabled={isProcessing}
            className="btn-primary"
            style={{ fontSize: '13px' }}
          >
            {isProcessing ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            <span>{isProcessing ? 'Bölünüyor...' : 'PDF Sayfalarını Böl'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
