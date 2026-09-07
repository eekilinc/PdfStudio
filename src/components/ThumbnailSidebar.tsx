import React, { useEffect, useRef, useState } from 'react';
import { 
  RotateCw, 
  Trash2, 
  Copy, 
  ChevronUp, 
  ChevronDown, 
  Plus,
  BookOpen,
  Layers,
  Bookmark
} from 'lucide-react';
import type { PDFDocumentState, PageState, PdfOutlineItem } from '../types/pdf';
import { getSharedPdfDoc } from '../utils/pdfInit';

interface ThumbnailSidebarProps {
  docState: PDFDocumentState;
  currentPageIndex: number;
  onSelectPage: (pageIndex: number) => void;
  onRotatePage: (pageIndex: number) => void;
  onDuplicatePage: (pageIndex: number) => void;
  onDeletePage: (pageIndex: number) => void;
  onMovePage: (fromIndex: number, toIndex: number) => void;
  onAddBlankPage: () => void;
}

export const ThumbnailSidebar: React.FC<ThumbnailSidebarProps> = ({
  docState,
  currentPageIndex,
  onSelectPage,
  onRotatePage,
  onDuplicatePage,
  onDeletePage,
  onMovePage,
  onAddBlankPage,
}) => {
  const [activeTab, setActiveTab] = useState<'thumbnails' | 'outline'>('thumbnails');
  const [outlineItems, setOutlineItems] = useState<PdfOutlineItem[]>([]);

  const activePages = docState.pageOrder
    .map(idx => docState.pages.find(p => p.pageIndex === idx))
    .filter((p): p is PageState => p !== undefined && !p.isDeleted);

  // Extract PDF outline bookmarks
  useEffect(() => {
    let isCancelled = false;

    const loadOutline = async () => {
      if (!docState.data) {
        setOutlineItems([]);
        return;
      }

      try {
        const pdf = await getSharedPdfDoc(docState.data);
        if (!pdf || isCancelled) return;

        const rawOutline = await pdf.getOutline();
        if (!rawOutline || isCancelled) {
          setOutlineItems([]);
          return;
        }

        const parsed: PdfOutlineItem[] = [];

        for (const item of rawOutline) {
          let targetPageNum = 1;
          if (item.dest) {
            if (typeof item.dest === 'string') {
              const destObj = await pdf.getDestination(item.dest);
              if (destObj && destObj[0]) {
                const pageIndex = await pdf.getPageIndex(destObj[0]);
                targetPageNum = pageIndex + 1;
              }
            } else if (Array.isArray(item.dest) && item.dest[0]) {
              const pageIndex = await pdf.getPageIndex(item.dest[0]);
              targetPageNum = pageIndex + 1;
            }
          }

          parsed.push({
            title: item.title,
            pageNumber: targetPageNum,
            pageIndex: targetPageNum - 1,
          });
        }

        if (!isCancelled) {
          setOutlineItems(parsed);
        }
      } catch (err) {
        console.error('Outline parse error:', err);
      }
    };

    loadOutline();
    return () => {
      isCancelled = true;
    };
  }, [docState.data]);

  return (
    <aside className="glass-panel" style={{
      width: '230px',
      minWidth: '230px',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      borderRight: '1px solid var(--border-color)',
      zIndex: 30,
    }}>
      {/* Sidebar Navigation Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)',
      }}>
        <button
          onClick={() => setActiveTab('thumbnails')}
          className={`btn-ghost ${activeTab === 'thumbnails' ? 'active' : ''}`}
          style={{
            flex: 1,
            borderRadius: 0,
            padding: '10px 8px',
            fontSize: '11px',
            fontWeight: 600,
            justifyContent: 'center',
            borderBottom: activeTab === 'thumbnails' ? '2px solid var(--accent-primary)' : 'none',
          }}
        >
          <Layers size={14} />
          <span>Sayfalar ({activePages.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('outline')}
          className={`btn-ghost ${activeTab === 'outline' ? 'active' : ''}`}
          style={{
            flex: 1,
            borderRadius: 0,
            padding: '10px 8px',
            fontSize: '11px',
            fontWeight: 600,
            justifyContent: 'center',
            borderBottom: activeTab === 'outline' ? '2px solid var(--accent-primary)' : 'none',
          }}
        >
          <BookOpen size={14} />
          <span>İçindekiler</span>
        </button>
      </div>

      {/* Tab 1: Thumbnails View */}
      {activeTab === 'thumbnails' && (
        <>
          {/* Quick Header */}
          <div style={{
            padding: '8px 12px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
          }}>
            <button
              onClick={onAddBlankPage}
              className="btn-ghost"
              data-tooltip="Boş Sayfa Ekle"
              style={{ fontSize: '11px', padding: '2px 8px' }}
            >
              <Plus size={13} />
              <span>Boş Sayfa</span>
            </button>
          </div>

          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}>
            {activePages.map((page, orderIndex) => {
              const isSelected = page.pageIndex === currentPageIndex;

              return (
                <div
                  key={page.pageIndex}
                  onClick={() => onSelectPage(page.pageIndex)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      position: 'relative',
                      borderRadius: 'var(--radius-sm)',
                      overflow: 'hidden',
                      border: isSelected ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                      boxShadow: isSelected ? '0 0 0 1px var(--accent-primary), var(--shadow-md)' : 'var(--shadow-sm)',
                      background: '#ffffff',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <ThumbnailCanvas
                      docData={docState.data}
                      pageNumber={page.originalPageNumber}
                      rotation={page.rotation || 0}
                      isBlank={page.isBlank}
                    />

                    {/* Page Actions Overlay on Hover */}
                    <div
                      className="thumbnail-actions"
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        display: 'flex',
                        gap: '2px',
                        background: 'rgba(15, 23, 42, 0.85)',
                        backdropFilter: 'blur(4px)',
                        padding: '2px',
                        borderRadius: '4px',
                      }}
                    >
                      <button
                        onClick={() => onRotatePage(page.pageIndex)}
                        className="btn-icon"
                        style={{ width: '20px', height: '20px', color: '#ffffff' }}
                        data-tooltip="90° Döndür"
                      >
                        <RotateCw size={11} />
                      </button>

                      <button
                        onClick={() => onDuplicatePage(page.pageIndex)}
                        className="btn-icon"
                        style={{ width: '20px', height: '20px', color: '#ffffff' }}
                        data-tooltip="Çoğalt"
                      >
                        <Copy size={11} />
                      </button>

                      {activePages.length > 1 && (
                        <button
                          onClick={() => onDeletePage(page.pageIndex)}
                          className="btn-icon"
                          style={{ width: '20px', height: '20px', color: '#f43f5e' }}
                          data-tooltip="Sil"
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: isSelected ? 700 : 500,
                      color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    }}>
                      Sayfa {orderIndex + 1}
                    </span>

                    {/* Reorder Buttons */}
                    <div style={{ display: 'flex', gap: '1px' }}>
                      <button
                        disabled={orderIndex === 0}
                        onClick={(e) => {
                          e.stopPropagation();
                          onMovePage(orderIndex, orderIndex - 1);
                        }}
                        className="btn-icon"
                        style={{ width: '16px', height: '16px' }}
                        data-tooltip="Yukarı Taşı"
                      >
                        <ChevronUp size={11} />
                      </button>
                      <button
                        disabled={orderIndex === activePages.length - 1}
                        onClick={(e) => {
                          e.stopPropagation();
                          onMovePage(orderIndex, orderIndex + 1);
                        }}
                        className="btn-icon"
                        style={{ width: '16px', height: '16px' }}
                        data-tooltip="Aşağı Taşı"
                      >
                        <ChevronDown size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Tab 2: Table of Contents / Outline */}
      {activeTab === 'outline' && (
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}>
          {outlineItems.length > 0 ? (
            outlineItems.map((item, idx) => (
              <div
                key={idx}
                onClick={() => {
                  const targetPage = activePages.find(p => p.displayPageNumber === item.pageNumber) || activePages[item.pageIndex] || activePages[0];
                  if (targetPage) onSelectPage(targetPage.pageIndex);
                }}
                className="btn-ghost"
                style={{
                  padding: '8px 10px',
                  justifyContent: 'space-between',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px',
                  lineHeight: '1.4',
                  textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                  <Bookmark size={13} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.title}
                  </span>
                </div>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                  s. {item.pageNumber}
                </span>
              </div>
            ))
          ) : (
            <div style={{
              padding: '24px 12px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '12px',
              lineHeight: '1.5',
            }}>
              Bu belgede gömülü içindekiler tablosu (yer imi) bulunamadı.
            </div>
          )}
        </div>
      )}
    </aside>
  );
};

interface ThumbnailCanvasProps {
  docData: ArrayBuffer | null;
  pageNumber: number;
  rotation: number;
  isBlank?: boolean;
}

const ThumbnailCanvas: React.FC<ThumbnailCanvasProps> = ({ docData, pageNumber, rotation, isBlank }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isRendered, setIsRendered] = useState(false);
  const renderTaskRef = useRef<any>(null);

  // Lazy thumbnail observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { rootMargin: '300px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const renderThumbnail = async () => {
      if (!isVisible || !canvasRef.current) return;

      if (isBlank || pageNumber === 0) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          canvas.width = 140;
          canvas.height = 198;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, 140, 198);
        }
        setIsRendered(true);
        return;
      }

      if (!docData) return;

      try {
        const pdf = await getSharedPdfDoc(docData);
        if (!pdf || isCancelled) return;

        const page = await pdf.getPage(pageNumber);
        if (isCancelled || !canvasRef.current) return;

        const viewport = page.getViewport({ scale: 0.25, rotation });
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch {
            // Ignore cancel error
          }
        }

        const task = page.render({
          canvasContext: ctx,
          viewport: viewport,
          canvas: canvas,
        } as any);

        renderTaskRef.current = task;
        await task.promise;

        // If thumbnail canvas is blank (invisible OCR text), draw scaled text onto thumbnail
        try {
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          let nonWhitePixels = 0;
          const step = Math.max(16, Math.floor(imgData.length / 1000));
          for (let i = 0; i < imgData.length; i += step) {
            const r = imgData[i];
            const g = imgData[i + 1];
            const b = imgData[i + 2];
            const a = imgData[i + 3];
            if (a > 30 && (r < 235 || g < 235 || b < 235)) {
              nonWhitePixels++;
              if (nonWhitePixels >= 5) break;
            }
          }

          if (nonWhitePixels < 5) {
            const textContent = await page.getTextContent();
            ctx.fillStyle = '#0f172a';
            textContent.items.forEach((item: any) => {
              if (!item.str || !item.str.trim()) return;
              const tx = item.transform;
              const fontSize = Math.max(3, Math.round(Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1]) * 0.25));
              const [ptX, ptY] = viewport.convertToViewportPoint(tx[4], tx[5]);
              ctx.font = `${fontSize}px Inter, sans-serif`;
              ctx.fillText(item.str, ptX, ptY);
            });
          }
        } catch {
          // Ignore fallback extraction error
        }

        if (!isCancelled) setIsRendered(true);
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.error('Thumbnail render error:', err);
        }
      }
    };

    renderThumbnail();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // Ignore cancel error
        }
      }
    };
  }, [docData, pageNumber, rotation, isVisible, isBlank]);

  return (
    <div ref={containerRef} style={{ width: '140px', minHeight: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '140px',
          height: 'auto',
        }}
      />
      {!isRendered && (
        <div style={{ position: 'absolute', inset: 0, background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
          {isBlank ? 'Boş' : pageNumber}
        </div>
      )}
      {isBlank && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', pointerEvents: 'none' }}>
          Boş Sayfa
        </div>
      )}
    </div>
  );
};
