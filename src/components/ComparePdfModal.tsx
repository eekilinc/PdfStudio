import React, { useState, useRef, useEffect } from 'react';
import { X, GitCompare, FolderOpen, ChevronLeft, ChevronRight, SplitSquareHorizontal } from 'lucide-react';
import { getSharedPdfDoc } from '../utils/pdfInit';
import type { PDFDocumentState } from '../types/pdf';

interface ComparePdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  primaryDocState: PDFDocumentState;
}

export const ComparePdfModal: React.FC<ComparePdfModalProps> = ({
  isOpen,
  onClose,
  primaryDocState,
}) => {
  const [docBData, setDocBData] = useState<ArrayBuffer | null>(null);
  const [docBFilename, setDocBFilename] = useState<string>('');
  const [docBNumPages, setDocBNumPages] = useState<number>(0);

  const [pageA, setPageA] = useState(1);
  const [pageB, setPageB] = useState(1);
  const [syncScroll, setSyncScroll] = useState(true);

  const canvasARef = useRef<HTMLCanvasElement>(null);
  const canvasBRef = useRef<HTMLCanvasElement>(null);
  const fileInputBRef = useRef<HTMLInputElement>(null);
  const handleSelectDocB = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const buffer = await file.arrayBuffer();
      const pdf = await getSharedPdfDoc(buffer);
      if (pdf) {
        setDocBData(buffer);
        setDocBFilename(file.name);
        setDocBNumPages(pdf.numPages);
        setPageB(1);
      }
    }
  };

  // Render Page A
  useEffect(() => {
    let isCancelled = false;
    const renderA = async () => {
      if (!isOpen || !primaryDocState.data || !canvasARef.current) return;
      try {
        const pdf = await getSharedPdfDoc(primaryDocState.data);
        if (!pdf || isCancelled) return;
        const page = await pdf.getPage(pageA);
        if (!canvasARef.current || isCancelled) return;

        const viewport = page.getViewport({ scale: 1.0 });
        const canvas = canvasARef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
      } catch (err) {
        console.error('Render A error:', err);
      }
    };
    renderA();
    return () => { isCancelled = true; };
  }, [primaryDocState.data, pageA, isOpen]);

  // Render Page B
  useEffect(() => {
    let isCancelled = false;
    const renderB = async () => {
      if (!isOpen || !docBData || !canvasBRef.current) return;
      try {
        const pdf = await getSharedPdfDoc(docBData);
        if (!pdf || isCancelled) return;
        const page = await pdf.getPage(pageB);
        if (!canvasBRef.current || isCancelled) return;

        const viewport = page.getViewport({ scale: 1.0 });
        const canvas = canvasBRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
      } catch (err) {
        console.error('Render B error:', err);
      }
    };
    renderB();
    return () => { isCancelled = true; };
  }, [docBData, pageB, isOpen]);

  const changePageBoth = (delta: number) => {
    const newA = Math.max(1, Math.min(primaryDocState.pageOrder.length || 1, pageA + delta));
    setPageA(newA);
    if (syncScroll && docBNumPages > 0) {
      const newB = Math.max(1, Math.min(docBNumPages, pageB + delta));
      setPageB(newB);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-card animate-fade-in" style={{ width: '94vw', height: '90vh', display: 'flex', flexDirection: 'column', maxWidth: '1400px' }}>
        {/* Header */}
        <div style={{
          padding: '12px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ fontWeight: 600, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <GitCompare size={18} color="var(--accent-primary)" />
            <span>PDF Karşılaştırma (Side-by-Side Diff)</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={syncScroll}
                onChange={(e) => setSyncScroll(e.target.checked)}
                style={{ accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
              />
              <span>Eşzamanlı Sayfa Geçişi</span>
            </label>

            <button onClick={onClose} className="btn-icon" style={{ width: '28px', height: '28px' }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Dual Panel Comparison View */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'hidden' }}>
          {/* Left Panel: Document A */}
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', borderRight: '1px solid var(--border-color)' }}>
            <div style={{ padding: '8px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-primary)' }}>
                Belge A (Mevcut): {primaryDocState.filename || 'Belge'}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button onClick={() => setPageA(Math.max(1, pageA - 1))} disabled={pageA <= 1} className="btn-icon" style={{ width: '22px', height: '22px' }}>
                  <ChevronLeft size={13} />
                </button>
                <span style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>{pageA} / {primaryDocState.pageOrder.length}</span>
                <button onClick={() => setPageA(Math.min(primaryDocState.pageOrder.length, pageA + 1))} disabled={pageA >= primaryDocState.pageOrder.length} className="btn-icon" style={{ width: '22px', height: '22px' }}>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg-workspace)', padding: '16px', display: 'flex', justifyContent: 'center' }}>
              <canvas ref={canvasARef} style={{ maxWidth: '100%', height: 'auto', background: '#ffffff', borderRadius: '4px', boxShadow: 'var(--shadow-md)' }} />
            </div>
          </div>

          {/* Right Panel: Document B */}
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#10b981' }}>
                {docBFilename ? `Belge B: ${docBFilename}` : 'Karşılaştırılacak İkinci Belge'}
              </span>

              <input type="file" ref={fileInputBRef} onChange={handleSelectDocB} accept="application/pdf" style={{ display: 'none' }} />

              {docBData ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button onClick={() => setPageB(Math.max(1, pageB - 1))} disabled={pageB <= 1} className="btn-icon" style={{ width: '22px', height: '22px' }}>
                    <ChevronLeft size={13} />
                  </button>
                  <span style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>{pageB} / {docBNumPages}</span>
                  <button onClick={() => setPageB(Math.min(docBNumPages, pageB + 1))} disabled={pageB >= docBNumPages} className="btn-icon" style={{ width: '22px', height: '22px' }}>
                    <ChevronRight size={13} />
                  </button>
                  <button onClick={() => fileInputBRef.current?.click()} className="btn-ghost" style={{ fontSize: '11px', padding: '2px 6px', marginLeft: '6px' }}>Değiştir</button>
                </div>
              ) : (
                <button onClick={() => fileInputBRef.current?.click()} className="btn-primary" style={{ fontSize: '11px', padding: '4px 10px' }}>
                  <FolderOpen size={13} /> İkinci PDF'i Seç
                </button>
              )}
            </div>

            <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg-workspace)', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {docBData ? (
                <canvas ref={canvasBRef} style={{ maxWidth: '100%', height: 'auto', background: '#ffffff', borderRadius: '4px', boxShadow: 'var(--shadow-md)' }} />
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <SplitSquareHorizontal size={36} style={{ opacity: 0.4 }} />
                  <span style={{ fontSize: '13px' }}>Farkları görmek için karşılaştırılacak 2. PDF belgesini yükleyin.</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Navigation Bar */}
        <div style={{
          padding: '10px 20px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          background: 'var(--bg-tertiary)',
        }}>
          <button onClick={() => changePageBoth(-1)} className="btn-ghost" style={{ fontSize: '12px' }}>
            <ChevronLeft size={15} /> Önceki Sayfa
          </button>

          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Eşzamanlı Gezinme (Sayfa {pageA})
          </span>

          <button onClick={() => changePageBoth(1)} className="btn-ghost" style={{ fontSize: '12px' }}>
            Sonraki Sayfa <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};
