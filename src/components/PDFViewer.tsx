import React, { useEffect, useRef, useState } from 'react';
import { Copy, Check, Edit3, Globe, Loader2, Trash2 } from 'lucide-react';
import type { 
  PDFDocumentState, 
  ActiveToolConfig, 
  Annotation, 
  PageState, 
  Point,
  TextAnnotation,
  DrawingAnnotation,
  ShapeAnnotation,
  SignatureAnnotation,
  ImageAnnotation,
  MeasurementAnnotation,
  CheckboxAnnotation,
  StampAnnotation,
  RedactionAnnotation,
  ExtractedPdfTextItem,
  SearchMatch,
  ReaderFilter
} from '../types/pdf';
import { getSharedPdfDoc } from '../utils/pdfInit';

interface PDFViewerProps {
  docState: PDFDocumentState;
  currentPageIndex: number;
  onPageChange: (pageIndex: number) => void;
  activeConfig: ActiveToolConfig;
  selectedAnnotation: Annotation | null;
  onSelectAnnotation: (ann: Annotation | null) => void;
  onAddAnnotation: (pageIndex: number, ann: Annotation) => void;
  onUpdateAnnotation: (pageIndex: number, ann: Annotation) => void;
  onDeleteAnnotation: (pageIndex: number, annotationId: string) => void;
  zoom: number;
  pendingSignatureData: string | null;
  pendingStampData: Partial<StampAnnotation> | null;
  pendingImageData: string | null;
  onConsumePendingSignature: () => void;
  onConsumePendingStamp: () => void;
  onConsumePendingImage: () => void;
  searchMatches?: SearchMatch[];
  activeMatchIndex?: number;
  readerFilter?: ReaderFilter;
  onZoomChange?: (newZoom: number) => void;
}

export const PDFViewer: React.FC<PDFViewerProps> = ({
  docState,
  currentPageIndex,
  onPageChange,
  activeConfig,
  selectedAnnotation,
  onSelectAnnotation,
  onAddAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation,
  zoom,
  pendingSignatureData,
  pendingStampData,
  pendingImageData,
  onConsumePendingSignature,
  onConsumePendingStamp,
  onConsumePendingImage,
  searchMatches = [],
  activeMatchIndex = -1,
  readerFilter = 'normal',
  onZoomChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Pan tool state
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Point>({ x: 0, y: 0 });

  // Active text editing state
  const [editingTextId, setEditingTextId] = useState<string | null>(null);

  // Handle Ctrl + Mouse Wheel Zooming
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.12 : -0.12;
        if (onZoomChange) {
          onZoomChange(Math.min(4.0, Math.max(0.25, Math.round((zoom + delta) * 100) / 100)));
        }
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [zoom, onZoomChange]);

  const activePages = docState.pageOrder
    .map(idx => docState.pages.find(p => p.pageIndex === idx))
    .filter((p): p is PageState => p !== undefined && !p.isDeleted);

  // Smooth scroll to selected page ONLY within containerRef, never scrolling window/navbar
  useEffect(() => {
    if (currentPageIndex !== undefined && currentPageIndex !== null) {
      const container = containerRef.current;
      const pageEl = pageRefs.current.get(currentPageIndex);
      if (container && pageEl) {
        const containerRect = container.getBoundingClientRect();
        const pageRect = pageEl.getBoundingClientRect();

        // Check if page is already comfortably visible inside the viewer container
        const isAlreadyVisible =
          pageRect.top >= containerRect.top &&
          pageRect.bottom <= containerRect.bottom;

        if (!isAlreadyVisible) {
          const targetScrollTop =
            container.scrollTop +
            (pageRect.top - containerRect.top) -
            Math.max(16, (container.clientHeight - pageRect.height) / 2);

          container.scrollTo({
            top: Math.max(0, targetScrollTop),
            behavior: 'smooth',
          });
        }
      }
    }
  }, [currentPageIndex]);

  // Handle Pan Dragging
  const handleMouseDownViewer = (e: React.MouseEvent) => {
    if (activeConfig.tool === 'pan' || e.button === 1) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      e.preventDefault();
    }
  };

  const handleMouseMoveViewer = (e: React.MouseEvent) => {
    if (isPanning && containerRef.current) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      containerRef.current.scrollLeft -= dx;
      containerRef.current.scrollTop -= dy;
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUpViewer = () => {
    setIsPanning(false);
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDownViewer}
      onMouseMove={handleMouseMoveViewer}
      onMouseUp={handleMouseUpViewer}
      style={{
        flex: 1,
        height: '100%',
        overflowY: 'auto',
        overflowX: 'auto',
        background: 'var(--bg-workspace)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '32px 16px',
        gap: '24px',
        position: 'relative',
        cursor: activeConfig.tool === 'pan' ? (isPanning ? 'grabbing' : 'grab') : 'default',
      }}
    >
      {/* Helper Banner for Text Editing Mode */}
      {activeConfig.tool === 'edit-text' && (
        <div
          className="animate-fade-in"
          style={{
            position: 'sticky',
            top: '0px',
            zIndex: 40,
            background: 'var(--accent-gradient)',
            color: '#ffffff',
            padding: '6px 16px',
            borderRadius: '20px',
            boxShadow: 'var(--shadow-md)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12px',
            fontWeight: 600,
          }}
        >
          <Edit3 size={15} />
          <span>Metin Düzenleme Modu: Düzenlemek istediğiniz yazının üzerine tıklayın.</span>
        </div>
      )}

      {activePages.map((page, index) => (
        <PageItem
          key={page.pageIndex}
          refCallback={(el) => {
            if (el) pageRefs.current.set(page.pageIndex, el);
            else pageRefs.current.delete(page.pageIndex);
          }}
          isCurrentPage={page.pageIndex === currentPageIndex}
          pageOrderNumber={index + 1}
          totalPages={activePages.length}
          docData={docState.data}
          page={page}
          zoom={zoom}
          activeConfig={activeConfig}
          annotations={docState.annotations[page.pageIndex] || []}
          selectedAnnotation={selectedAnnotation}
          onSelectAnnotation={onSelectAnnotation}
          onSelectThisPage={() => onPageChange(page.pageIndex)}
          onAddAnnotation={(ann) => onAddAnnotation(page.pageIndex, ann)}
          onUpdateAnnotation={(ann) => onUpdateAnnotation(page.pageIndex, ann)}
          onDeleteAnnotation={(annId) => onDeleteAnnotation(page.pageIndex, annId)}
          pendingSignatureData={pendingSignatureData}
          pendingStampData={pendingStampData}
          pendingImageData={pendingImageData}
          onConsumePendingSignature={onConsumePendingSignature}
          onConsumePendingStamp={onConsumePendingStamp}
          onConsumePendingImage={onConsumePendingImage}
          editingTextId={editingTextId}
          setEditingTextId={setEditingTextId}
          searchMatches={searchMatches}
          activeMatchIndex={activeMatchIndex}
          readerFilter={readerFilter}
        />
      ))}
    </div>
  );
};

interface PageItemProps {
  refCallback: (el: HTMLDivElement | null) => void;
  isCurrentPage: boolean;
  pageOrderNumber: number;
  totalPages: number;
  docData: ArrayBuffer | null;
  page: PageState;
  zoom: number;
  activeConfig: ActiveToolConfig;
  annotations: Annotation[];
  selectedAnnotation: Annotation | null;
  onSelectAnnotation: (ann: Annotation | null) => void;
  onSelectThisPage: () => void;
  onAddAnnotation: (ann: Annotation) => void;
  onUpdateAnnotation: (ann: Annotation) => void;
  onDeleteAnnotation: (annId: string) => void;
  pendingSignatureData: string | null;
  pendingStampData: Partial<StampAnnotation> | null;
  pendingImageData: string | null;
  onConsumePendingSignature: () => void;
  onConsumePendingStamp: () => void;
  onConsumePendingImage: () => void;
  editingTextId: string | null;
  setEditingTextId: (id: string | null) => void;
  searchMatches: SearchMatch[];
  activeMatchIndex: number;
  readerFilter: ReaderFilter;
}

function detectFontProperties(fontName?: string) {
  if (!fontName) {
    return { fontFamily: 'Inter, sans-serif', fontWeight: 'normal' as const, fontStyle: 'normal' as const };
  }
  const lower = fontName.toLowerCase();
  const isBold = lower.includes('bold') || lower.includes('black') || lower.includes('heavy') || lower.includes('b') || lower.includes('cmbx') || lower.includes('cmb');
  const isItalic = lower.includes('italic') || lower.includes('oblique') || lower.includes('i') || lower.includes('cmti') || lower.includes('cmmi');

  let fontFamily = 'Georgia, "Times New Roman", serif';
  if (lower.includes('times') || lower.includes('serif') || lower.includes('cambria') || lower.includes('georgia') || lower.includes('minion') || lower.includes('cmr')) {
    fontFamily = 'Georgia, "Times New Roman", serif';
  } else if (lower.includes('courier') || lower.includes('mono') || lower.includes('consolas') || lower.includes('typewriter') || lower.includes('cmtt')) {
    fontFamily = 'JetBrains Mono, monospace';
  } else if (lower.includes('arial') || lower.includes('helvetica') || lower.includes('cmss') || lower.includes('sans')) {
    fontFamily = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  } else if (lower.includes('roboto')) {
    fontFamily = 'Roboto, sans-serif';
  } else if (lower.includes('garamond')) {
    fontFamily = 'Garamond, serif';
  }

  return {
    fontFamily,
    fontWeight: (isBold ? 'bold' : 'normal') as 'bold' | 'normal',
    fontStyle: (isItalic ? 'italic' : 'normal') as 'italic' | 'normal',
  };
}

const PageItem: React.FC<PageItemProps> = ({
  refCallback,
  isCurrentPage,
  pageOrderNumber,
  totalPages,
  docData,
  page,
  zoom,
  activeConfig,
  annotations,
  selectedAnnotation,
  onSelectAnnotation,
  onSelectThisPage,
  onAddAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation,
  pendingSignatureData,
  pendingStampData,
  pendingImageData,
  onConsumePendingSignature,
  onConsumePendingStamp,
  onConsumePendingImage,
  editingTextId,
  setEditingTextId,
  searchMatches,
  activeMatchIndex,
  readerFilter,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);

  const [isVisible, setIsVisible] = useState(pageOrderNumber <= 5);
  const [isRendered, setIsRendered] = useState(false);

  const [pdfTextItems, setPdfTextItems] = useState<ExtractedPdfTextItem[]>([]);
  const [hasVisibleCanvasContent, setHasVisibleCanvasContent] = useState<boolean>(true);
  const [hoveredTextId, setHoveredTextId] = useState<string | null>(null);

  // Text selection, copy & translation state
  const [selectedText, setSelectedText] = useState('');
  const [selectionPosition, setSelectionPosition] = useState<Point | null>(null);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [copiedFeedback, setCopiedFeedback] = useState(false);
  const [renderTrigger, setRenderTrigger] = useState(0);
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());

  const getPixelColorsAt = (canvas: HTMLCanvasElement | null, pdfX: number, pdfY: number, width: number, height: number): { bg: string; fg: string } => {
    if (!canvas) return { bg: '#ffffff', fg: '#0f172a' };
    try {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return { bg: '#ffffff', fg: '#0f172a' };
      const scaleX = canvas.width / width;
      const scaleY = canvas.height / height;
      const sampleX = Math.max(0, Math.min(canvas.width - 1, Math.floor((pdfX - 2) * scaleX)));
      const sampleY = Math.max(0, Math.min(canvas.height - 1, Math.floor((pdfY - 2) * scaleY)));
      const pixel = ctx.getImageData(sampleX, sampleY, 1, 1).data;
      const r = pixel[0];
      const g = pixel[1];
      const b = pixel[2];
      const bg = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      const fg = lum < 0.5 ? '#ffffff' : '#0f172a';
      return { bg, fg };
    } catch {
      return { bg: '#ffffff', fg: '#0f172a' };
    }
  };

  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState<Point[]>([]);

  const [shapeStart, setShapeStart] = useState<Point | null>(null);
  const [currentShapePreview, setCurrentShapePreview] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const [isDraggingAnn, setIsDraggingAnn] = useState(false);
  const [dragStartOffset, setDragStartOffset] = useState<Point>({ x: 0, y: 0 });
  const [isMouseDownOnOverlay, setIsMouseDownOnOverlay] = useState(false);

  const rawWidth = page.width && page.width > 50 ? page.width : 595.28;
  const rawHeight = page.height && page.height > 50 ? page.height : 841.89;
  const pageWidth = Math.round(rawWidth * zoom);
  const pageHeight = Math.round(rawHeight * zoom);

  useEffect(() => {
    if (containerRef.current) {
      refCallback(containerRef.current);
    }
    return () => refCallback(null);
  }, [refCallback]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { rootMargin: '600px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 1. Render PDF background page or clean blank page
  useEffect(() => {
    let isCancelled = false;
    let activeTask: any = null;

    const renderPdfPage = async () => {
      if (!isVisible || !bgCanvasRef.current) return;

      const dpr = Math.min(window.devicePixelRatio || 2, 2.5);

      // Clean pure blank page
      if (page.isBlank || page.originalPageNumber === 0) {
        const canvas = bgCanvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          canvas.width = pageWidth * dpr;
          canvas.height = pageHeight * dpr;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        setIsRendered(true);
        setPdfTextItems([]);
        return;
      }

      if (!docData) return;

      try {
        const pdf = await getSharedPdfDoc(docData);
        if (!pdf || isCancelled) return;

        const pdfPage = await pdf.getPage(page.originalPageNumber);
        if (isCancelled || !bgCanvasRef.current) return;

        const viewport = pdfPage.getViewport({ scale: zoom * dpr, rotation: page.rotation || 0 });
        const canvas = bgCanvasRef.current;
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

        const task = pdfPage.render({
          canvasContext: ctx,
          viewport: viewport,
          canvas: canvas,
        } as any);

        activeTask = task;
        renderTaskRef.current = task;

        await task.promise;

        let hasDrawnContent = true;
        try {
          const w = canvas.width;
          const h = canvas.height;
          if (w > 0 && h > 0) {
            const imgData = ctx.getImageData(0, 0, w, h).data;
            let nonWhitePixels = 0;
            // Step across the entire canvas (sample ~3000 points evenly)
            const step = Math.max(16, Math.floor(imgData.length / 3000));
            for (let i = 0; i < imgData.length; i += step) {
              const r = imgData[i];
              const g = imgData[i + 1];
              const b = imgData[i + 2];
              const a = imgData[i + 3];
              // Non-white drawing (text, shapes, raster)
              if (a > 30 && (r < 235 || g < 235 || b < 235)) {
                nonWhitePixels++;
                if (nonWhitePixels >= 8) break;
              }
            }
            hasDrawnContent = nonWhitePixels >= 8;
          }
        } catch {
          hasDrawnContent = true;
        }

        if (!isCancelled) {
          setHasVisibleCanvasContent(hasDrawnContent);
          setIsRendered(true);
        }

        const textContent = await pdfPage.getTextContent();
        const unscaledViewport = pdfPage.getViewport({ scale: 1.0, rotation: page.rotation || 0 });
        const extracted: ExtractedPdfTextItem[] = [];

        textContent.items.forEach((item: any) => {
          if (!item.str || !item.str.trim()) return;
          const tx = item.transform;
          const fontSize = Math.max(8, Math.round(Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1])));
          const fontWidth = item.width || (item.str.length * fontSize * 0.55);

          const [ptX, ptY] = unscaledViewport.convertToViewportPoint(tx[4], tx[5]);
          const canvasX = ptX;
          const canvasY = ptY - fontSize;

          const { fontFamily, fontWeight, fontStyle } = detectFontProperties(item.fontName);

          extracted.push({
            id: `text-${page.pageIndex}-${Math.random().toString(36).substring(2, 7)}`,
            str: item.str,
            x: Math.round(canvasX),
            y: Math.round(canvasY),
            width: Math.max(20, Math.round(fontWidth)),
            height: Math.max(12, Math.round(fontSize * 1.2)),
            fontSize: fontSize,
            fontFamily: fontFamily,
            fontWeight: fontWeight,
            fontStyle: fontStyle,
          });
        });

        if (!isCancelled) {
          setPdfTextItems(extracted);
        }
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.error('PDF Page render error:', err);
        }
      }
    };

    renderPdfPage();

    return () => {
      isCancelled = true;
      if (activeTask) {
        try {
          activeTask.cancel();
        } catch {
          // Ignore
        }
      }
    };
  }, [docData, page.originalPageNumber, page.pageIndex, page.rotation, page.isBlank, zoom, isVisible, pageWidth, pageHeight]);

  // 2. Render Annotations & LIVE previews on Overlay Canvas
  useEffect(() => {
    if (!isVisible) return;
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 2, 2.5);
    canvas.width = pageWidth * dpr;
    canvas.height = pageHeight * dpr;
    ctx.scale(dpr * zoom, dpr * zoom);

    ctx.clearRect(0, 0, rawWidth, rawHeight);

    // Draw Search Match Highlights
    const pageSearchMatches = searchMatches.filter((m) => m.pageIndex === page.pageIndex);
    if (pageSearchMatches.length > 0) {
      pageSearchMatches.forEach((m) => {
        const isActive = activeMatchIndex === m.matchIndex;
        ctx.save();
        ctx.fillStyle = isActive ? 'rgba(245, 158, 11, 0.75)' : 'rgba(254, 240, 138, 0.6)';
        ctx.fillRect(m.x - 2, m.y - 1, m.width + 4, m.height + 2);
        if (isActive) {
          ctx.strokeStyle = '#d97706';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(m.x - 2, m.y - 1, m.width + 4, m.height + 2);
        }
        ctx.restore();
      });
    }

    // Draw all committed annotations
    annotations.forEach((ann) => {
      ctx.save();
      const isSelected = selectedAnnotation?.id === ann.id;
      const opacity = ann.opacity !== undefined ? ann.opacity : 1.0;
      ctx.globalAlpha = opacity;

      switch (ann.type) {
        case 'redact': {
          ctx.fillStyle = ann.color || '#000000';
          ctx.fillRect(ann.x, ann.y, ann.width, ann.height);
          break;
        }

        case 'rect': {
          const shape = ann as ShapeAnnotation;
          ctx.strokeStyle = shape.color;
          ctx.lineWidth = shape.strokeWidth || 2;
          if (shape.fillColor && shape.fillColor !== 'transparent') {
            ctx.fillStyle = shape.fillColor;
            ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
          }
          ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
          break;
        }

        case 'circle': {
          const shape = ann as ShapeAnnotation;
          ctx.strokeStyle = shape.color;
          ctx.lineWidth = shape.strokeWidth || 2;
          ctx.beginPath();
          ctx.ellipse(
            shape.x + shape.width / 2,
            shape.y + shape.height / 2,
            Math.abs(shape.width / 2),
            Math.abs(shape.height / 2),
            0,
            0,
            2 * Math.PI
          );
          if (shape.fillColor && shape.fillColor !== 'transparent') {
            ctx.fillStyle = shape.fillColor;
            ctx.fill();
          }
          ctx.stroke();
          break;
        }

        case 'line':
        case 'arrow': {
          const shape = ann as ShapeAnnotation;
          ctx.strokeStyle = shape.color;
          ctx.lineWidth = shape.strokeWidth || 2;
          ctx.lineCap = 'round';
          const endX = shape.endX !== undefined ? shape.endX : shape.x + shape.width;
          const endY = shape.endY !== undefined ? shape.endY : shape.y + shape.height;

          ctx.beginPath();
          ctx.moveTo(shape.x, shape.y);
          ctx.lineTo(endX, endY);
          ctx.stroke();

          if (shape.type === 'arrow') {
            const angle = Math.atan2(endY - shape.y, endX - shape.x);
            const headLen = Math.max(12, (shape.strokeWidth || 2) * 3.5);
            ctx.beginPath();
            ctx.moveTo(endX, endY);
            ctx.lineTo(endX - headLen * Math.cos(angle - Math.PI / 6), endY - headLen * Math.sin(angle - Math.PI / 6));
            ctx.moveTo(endX, endY);
            ctx.lineTo(endX - headLen * Math.cos(angle + Math.PI / 6), endY - headLen * Math.sin(angle + Math.PI / 6));
            ctx.stroke();
          }
          break;
        }

        case 'pen':
        case 'highlighter': {
          const draw = ann as DrawingAnnotation;
          if (draw.points && draw.points.length > 1) {
            ctx.strokeStyle = draw.color;
            ctx.lineWidth = draw.strokeWidth || (draw.type === 'highlighter' ? 18 : 3);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(draw.points[0].x, draw.points[0].y);
            for (let i = 1; i < draw.points.length; i++) {
              ctx.lineTo(draw.points[i].x, draw.points[i].y);
            }
            ctx.stroke();
          }
          break;
        }

        case 'text': {
          const textAnn = ann as TextAnnotation;
          if (editingTextId === textAnn.id) break;

          ctx.save();
          if (textAnn.rotation) {
            ctx.translate(textAnn.x + textAnn.width / 2, textAnn.y + textAnn.height / 2);
            ctx.rotate((textAnn.rotation * Math.PI) / 180);
            ctx.translate(-(textAnn.x + textAnn.width / 2), -(textAnn.y + textAnn.height / 2));
          }

          ctx.fillStyle = textAnn.color || '#000000';
          const fontStyle = textAnn.fontStyle === 'italic' ? 'italic' : '';
          const fontWeight = textAnn.fontWeight === 'bold' ? 'bold' : '';
          ctx.font = `${fontStyle} ${fontWeight} ${textAnn.fontSize || 14}px ${textAnn.fontFamily || 'Inter, sans-serif'}`;
          ctx.textBaseline = 'top';

          if (textAnn.backgroundColor && textAnn.backgroundColor !== 'transparent') {
            ctx.fillStyle = textAnn.backgroundColor;
            ctx.fillRect(textAnn.x - 2, textAnn.y - 2, textAnn.width + 4, textAnn.height + 4);
            ctx.fillStyle = textAnn.color;
          }

          const lines = textAnn.text.split('\n');
          const lineHeight = (textAnn.fontSize || 14) * 1.25;
          lines.forEach((line, i) => {
            ctx.fillText(line, textAnn.x, textAnn.y + i * lineHeight);
          });
          ctx.restore();
          break;
        }

        case 'signature':
        case 'image': {
          const imgAnn = ann as (SignatureAnnotation | ImageAnnotation);
          if (imgAnn.imageData) {
            let img = imageCache.current.get(imgAnn.imageData);
            if (!img) {
              img = new Image();
              img.src = imgAnn.imageData;
              img.onload = () => {
                setRenderTrigger((t) => t + 1);
              };
              imageCache.current.set(imgAnn.imageData, img);
            }
            if (img.complete && img.naturalWidth > 0) {
              ctx.drawImage(img, imgAnn.x, imgAnn.y, imgAnn.width, imgAnn.height);
            }
          }
          break;
        }

        case 'measure': {
          const mAnn = ann as MeasurementAnnotation;
          ctx.strokeStyle = mAnn.color || '#f59e0b';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(mAnn.x, mAnn.y);
          ctx.lineTo(mAnn.endX, mAnn.endY);
          ctx.stroke();

          // End ticks
          const angle = Math.atan2(mAnn.endY - mAnn.y, mAnn.endX - mAnn.x);
          const perp = angle + Math.PI / 2;
          ctx.beginPath();
          ctx.moveTo(mAnn.x - 6 * Math.cos(perp), mAnn.y - 6 * Math.sin(perp));
          ctx.lineTo(mAnn.x + 6 * Math.cos(perp), mAnn.y + 6 * Math.sin(perp));
          ctx.moveTo(mAnn.endX - 6 * Math.cos(perp), mAnn.endY - 6 * Math.sin(perp));
          ctx.lineTo(mAnn.endX + 6 * Math.cos(perp), mAnn.endY + 6 * Math.sin(perp));
          ctx.stroke();

          // Distance Pill
          const midX = (mAnn.x + mAnn.endX) / 2;
          const midY = (mAnn.y + mAnn.endY) / 2;
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(midX - 28, midY - 10, 56, 20);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px JetBrains Mono, monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(mAnn.distanceFormatted, midX, midY);
          break;
        }

        case 'checkbox': {
          const cb = ann as CheckboxAnnotation;
          ctx.strokeStyle = cb.color || '#0f172a';
          ctx.lineWidth = 1.8;
          ctx.strokeRect(cb.x, cb.y, cb.width, cb.height);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(cb.x + 1, cb.y + 1, cb.width - 2, cb.height - 2);

          if (cb.checked) {
            ctx.strokeStyle = 'var(--accent-primary)';
            ctx.lineWidth = 2.5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(cb.x + 3, cb.y + 9);
            ctx.lineTo(cb.x + 7, cb.y + 13);
            ctx.lineTo(cb.x + 14, cb.y + 4);
            ctx.stroke();
          }
          break;
        }

        case 'stamp': {
          const stamp = ann as StampAnnotation;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.fillRect(stamp.x, stamp.y, stamp.width, stamp.height);

          ctx.strokeStyle = stamp.color;
          ctx.lineWidth = 2.5;
          ctx.strokeRect(stamp.x, stamp.y, stamp.width, stamp.height);
          ctx.strokeRect(stamp.x + 3, stamp.y + 3, stamp.width - 6, stamp.height - 6);

          ctx.fillStyle = stamp.color;
          ctx.font = `bold 16px Inter, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(stamp.customText || stamp.stampType, stamp.x + stamp.width / 2, stamp.y + stamp.height / 2 - 6);

          if (stamp.subtitle || stamp.date) {
            ctx.font = `9px Inter, sans-serif`;
            ctx.fillText(stamp.subtitle || stamp.date || '', stamp.x + stamp.width / 2, stamp.y + stamp.height / 2 + 10);
          }
          break;
        }
      }

      // Draw Selection Bounding Box & Handles
      if (isSelected) {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(ann.x - 4, ann.y - 4, ann.width + 8, ann.height + 8);
        ctx.setLineDash([]);

        ctx.fillStyle = '#38bdf8';
        const handles = [
          { x: ann.x - 4, y: ann.y - 4 },
          { x: ann.x + ann.width + 4, y: ann.y - 4 },
          { x: ann.x + ann.width + 4, y: ann.y + ann.height + 4 },
          { x: ann.x - 4, y: ann.y + ann.height + 4 },
        ];
        handles.forEach((h) => {
          ctx.fillRect(h.x - 3, h.y - 3, 6, 6);
        });
      }

      ctx.restore();
    });

    // 3. LIVE Freehand Drawing Stroke Preview
    if (isDrawing && drawingPoints.length > 1) {
      ctx.save();
      ctx.strokeStyle = activeConfig.color;
      ctx.lineWidth = activeConfig.strokeWidth || (activeConfig.tool === 'highlighter' ? 18 : 3);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = activeConfig.tool === 'highlighter' 
        ? (activeConfig.opacity !== undefined && activeConfig.opacity < 1 ? activeConfig.opacity : 0.4) 
        : (activeConfig.opacity !== undefined ? activeConfig.opacity : 1.0);

      ctx.beginPath();
      ctx.moveTo(drawingPoints[0].x, drawingPoints[0].y);
      for (let i = 1; i < drawingPoints.length; i++) {
        ctx.lineTo(drawingPoints[i].x, drawingPoints[i].y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 4. LIVE Shape / Measurement Creation Previews
    if (currentShapePreview) {
      ctx.save();
      ctx.strokeStyle = activeConfig.color;
      ctx.lineWidth = activeConfig.strokeWidth;
      if (activeConfig.tool === 'rect' || activeConfig.tool === 'redact') {
        if (activeConfig.tool === 'redact') {
          ctx.fillStyle = '#000000';
          ctx.fillRect(currentShapePreview.x, currentShapePreview.y, currentShapePreview.w, currentShapePreview.h);
        } else {
          ctx.strokeRect(currentShapePreview.x, currentShapePreview.y, currentShapePreview.w, currentShapePreview.h);
        }
      } else if (activeConfig.tool === 'circle') {
        ctx.beginPath();
        ctx.ellipse(
          currentShapePreview.x + currentShapePreview.w / 2,
          currentShapePreview.y + currentShapePreview.h / 2,
          Math.abs(currentShapePreview.w / 2),
          Math.abs(currentShapePreview.h / 2),
          0,
          0,
          2 * Math.PI
        );
        ctx.stroke();
      } else if (activeConfig.tool === 'line' || activeConfig.tool === 'arrow') {
        ctx.beginPath();
        ctx.moveTo(currentShapePreview.x, currentShapePreview.y);
        ctx.lineTo(currentShapePreview.x + currentShapePreview.w, currentShapePreview.y + currentShapePreview.h);
        ctx.stroke();
      } else if (activeConfig.tool === 'measure' && shapeStart) {
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(shapeStart.x, shapeStart.y);
        ctx.lineTo(shapeStart.x + currentShapePreview.w, shapeStart.y + currentShapePreview.h);
        ctx.stroke();

        const distPt = Math.hypot(currentShapePreview.w, currentShapePreview.h);
        const distCm = (distPt * 0.0352778).toFixed(2);
        const midX = shapeStart.x + currentShapePreview.w / 2;
        const midY = shapeStart.y + currentShapePreview.h / 2;

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(midX - 26, midY - 10, 52, 20);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${distCm} cm`, midX, midY);
      }
      ctx.restore();
    }
  }, [annotations, selectedAnnotation, currentShapePreview, isDrawing, drawingPoints, zoom, editingTextId, activeConfig, pageWidth, pageHeight, rawWidth, rawHeight, searchMatches, activeMatchIndex, renderTrigger, shapeStart, isVisible, page.pageIndex]);

  const getPdfCoords = (e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const rect = overlayCanvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (e.clientX - rect.left) / zoom,
      y: (e.clientY - rect.top) / zoom,
    };
  };

  const findHitAnnotation = (pt: Point) => {
    return [...annotations].reverse().find((ann) => {
      if (ann.type === 'pen' || ann.type === 'highlighter') {
        const draw = ann as DrawingAnnotation;
        if (draw.points && draw.points.length > 0) {
          const hitRadius = Math.max((draw.strokeWidth || 4) + 10, 20);
          return draw.points.some((p) => Math.hypot(p.x - pt.x, p.y - pt.y) <= hitRadius);
        }
      }
      if (ann.type === 'line' || ann.type === 'arrow') {
        const shape = ann as ShapeAnnotation;
        const x1 = shape.x;
        const y1 = shape.y;
        const x2 = shape.endX !== undefined ? shape.endX : shape.x + shape.width;
        const y2 = shape.endY !== undefined ? shape.endY : shape.y + shape.height;
        const lineLen = Math.hypot(x2 - x1, y2 - y1);
        if (lineLen > 0) {
          const dist = Math.abs((y2 - y1) * pt.x - (x2 - x1) * pt.y + x2 * y1 - y2 * x1) / lineLen;
          const minX = Math.min(x1, x2) - 12;
          const maxX = Math.max(x1, x2) + 12;
          const minY = Math.min(y1, y2) - 12;
          const maxY = Math.max(y1, y2) + 12;
          if (dist < 16 && pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY) {
            return true;
          }
        }
      }
      return (
        pt.x >= ann.x - 10 &&
        pt.x <= ann.x + ann.width + 10 &&
        pt.y >= ann.y - 10 &&
        pt.y <= ann.y + ann.height + 10
      );
    });
  };

  // Text selection handler for copying & translation
  const updateSelectionBox = () => {
    const selection = window.getSelection();
    const text = selection ? selection.toString().trim() : '';
    if (text && text.length > 0) {
      setSelectedText(text);
      setTranslatedText(null);
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const containerRect = containerRef.current?.getBoundingClientRect();
        if (rect && containerRect) {
          setSelectionPosition({
            x: rect.left - containerRect.left + rect.width / 2,
            y: Math.max(10, rect.top - containerRect.top - 40),
          });
        }
      }
    } else {
      setSelectedText('');
      setSelectionPosition(null);
      setTranslatedText(null);
    }
  };

  useEffect(() => {
    const handleSelectionChange = () => {
      updateSelectionBox();
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  const handleCopySelectedText = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedText) {
      navigator.clipboard.writeText(selectedText);
      setCopiedFeedback(true);
      setTimeout(() => {
        setCopiedFeedback(false);
      }, 1400);
    }
  };

  // Instant Translate
  const handleTranslateSelectedText = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedText) return;
    setIsTranslating(true);

    try {
      const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(selectedText.slice(0, 400))}&langpair=autodetect|tr`);
      const json = await res.json();
      if (json?.responseData?.translatedText) {
        setTranslatedText(json.responseData.translatedText);
      } else {
        setTranslatedText(selectedText);
      }
    } catch {
      setTranslatedText('Çeviri servisine ulaşılamadı.');
    } finally {
      setIsTranslating(false);
    }
  };

  // Direct Text Edit click handler
  const handleEditOriginalTextItem = (item: ExtractedPdfTextItem) => {
    const colors = getPixelColorsAt(bgCanvasRef.current, item.x, item.y, pageWidth, pageHeight);
    const newId = `edit-${item.id}`;
    const newTextAnn: TextAnnotation = {
      id: newId,
      pageIndex: page.pageIndex,
      type: 'text',
      x: item.x,
      y: item.y,
      width: Math.max(item.width + 12, 70),
      height: Math.max(item.height + 4, 22),
      text: item.str,
      fontSize: item.fontSize,
      fontFamily: item.fontFamily || 'Inter, sans-serif',
      color: colors.fg,
      backgroundColor: colors.bg,
    };

    onAddAnnotation(newTextAnn);
    onSelectAnnotation(newTextAnn);
    setEditingTextId(newId);
  };

  const handleDeleteOriginalTextItem = (item: ExtractedPdfTextItem) => {
    const colors = getPixelColorsAt(bgCanvasRef.current, item.x, item.y, pageWidth, pageHeight);
    const newId = Math.random().toString(36).substring(2, 9);
    const maskAnn: TextAnnotation = {
      id: newId,
      pageIndex: page.pageIndex,
      type: 'text',
      x: item.x - 2,
      y: item.y - 2,
      width: item.width + 4,
      height: item.height + 4,
      text: '',
      fontSize: item.fontSize,
      fontFamily: 'Inter, sans-serif',
      color: 'transparent',
      backgroundColor: colors.bg,
    };

    onAddAnnotation(maskAnn);
    onSelectAnnotation(null);
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pt = getPdfCoords(e);
    const hit = findHitAnnotation(pt);
    if (hit && hit.type === 'text') {
      onSelectAnnotation(hit);
      setEditingTextId(hit.id);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    onSelectThisPage();
    setIsMouseDownOnOverlay(true);
    if (activeConfig.tool === 'pan' || activeConfig.tool === 'edit-text') return;
    const pt = getPdfCoords(e);

    if (activeConfig.tool === 'eraser') {
      const hit = findHitAnnotation(pt);
      if (hit) onDeleteAnnotation(hit.id);
      return;
    }

    if (pendingSignatureData) {
      onAddAnnotation({
        id: Math.random().toString(36).substring(2, 9),
        pageIndex: page.pageIndex,
        type: 'signature',
        x: pt.x - 75,
        y: pt.y - 35,
        width: 150,
        height: 70,
        color: '#0f172a',
        imageData: pendingSignatureData,
      } as SignatureAnnotation);
      onConsumePendingSignature();
      return;
    }

    if (pendingImageData) {
      const img = new Image();
      img.onload = () => {
        const aspect = (img.naturalWidth || 1) / (img.naturalHeight || 1);
        const targetW = Math.min(220, Math.max(80, img.naturalWidth || 160));
        const targetH = targetW / aspect;
        const newImgAnn: ImageAnnotation = {
          id: Math.random().toString(36).substring(2, 9),
          pageIndex: page.pageIndex,
          type: 'image',
          x: pt.x - targetW / 2,
          y: pt.y - targetH / 2,
          width: targetW,
          height: targetH,
          color: 'transparent',
          imageData: pendingImageData,
        };
        onAddAnnotation(newImgAnn);
        onSelectAnnotation(newImgAnn);
      };
      img.src = pendingImageData;
      onConsumePendingImage();
      return;
    }

    if (pendingStampData) {
      onAddAnnotation({
        id: Math.random().toString(36).substring(2, 9),
        pageIndex: page.pageIndex,
        type: 'stamp',
        x: pt.x - 85,
        y: pt.y - 32,
        width: 170,
        height: 65,
        color: pendingStampData.color || '#e11d48',
        ...pendingStampData,
      } as StampAnnotation);
      onConsumePendingStamp();
      return;
    }

    if (activeConfig.tool === 'checkbox') {
      onAddAnnotation({
        id: Math.random().toString(36).substring(2, 9),
        pageIndex: page.pageIndex,
        type: 'checkbox',
        x: pt.x - 9,
        y: pt.y - 9,
        width: 18,
        height: 18,
        color: activeConfig.color || '#0f172a',
        checked: false,
      } as CheckboxAnnotation);
      return;
    }

    if (activeConfig.tool === 'select') {
      const clickedAnn = findHitAnnotation(pt);

      if (clickedAnn) {
        if (clickedAnn.type === 'checkbox') {
          const cb = clickedAnn as CheckboxAnnotation;
          onUpdateAnnotation({ ...cb, checked: !cb.checked });
          return;
        }
        onSelectAnnotation(clickedAnn);
        setIsDraggingAnn(true);
        setDragStartOffset({ x: pt.x - clickedAnn.x, y: pt.y - clickedAnn.y });
      } else {
        onSelectAnnotation(null);
        setEditingTextId(null);
      }
      return;
    }

    if (activeConfig.tool === 'pen' || activeConfig.tool === 'highlighter') {
      setIsDrawing(true);
      setDrawingPoints([pt]);
      return;
    }

    if (activeConfig.tool === 'text') {
      const colors = getPixelColorsAt(bgCanvasRef.current, pt.x, pt.y, pageWidth, pageHeight);
      const newId = Math.random().toString(36).substring(2, 9);
      const newTextAnn: TextAnnotation = {
        id: newId,
        pageIndex: page.pageIndex,
        type: 'text',
        x: pt.x,
        y: pt.y,
        width: 140,
        height: 30,
        text: 'Metin buraya...',
        fontSize: activeConfig.fontSize || 16,
        fontFamily: activeConfig.fontFamily || 'Inter, sans-serif',
        fontWeight: activeConfig.fontWeight,
        fontStyle: activeConfig.fontStyle,
        color: activeConfig.color && activeConfig.color !== '#0f172a' ? activeConfig.color : colors.fg,
      };
      onAddAnnotation(newTextAnn);
      onSelectAnnotation(newTextAnn);
      setEditingTextId(newId);
      return;
    }

    if (['rect', 'circle', 'line', 'arrow', 'redact', 'measure'].includes(activeConfig.tool)) {
      setShapeStart(pt);
      setCurrentShapePreview({ x: pt.x, y: pt.y, w: 0, h: 0 });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pt = getPdfCoords(e);

    if (activeConfig.tool === 'eraser' && isMouseDownOnOverlay) {
      const hit = findHitAnnotation(pt);
      if (hit) onDeleteAnnotation(hit.id);
      return;
    }

    if (isDraggingAnn && selectedAnnotation) {
      const newX = Math.max(0, pt.x - dragStartOffset.x);
      const newY = Math.max(0, pt.y - dragStartOffset.y);
      onUpdateAnnotation({
        ...selectedAnnotation,
        x: newX,
        y: newY,
      });
      return;
    }

    if (isDrawing) {
      setDrawingPoints((prev) => [...prev, pt]);
      return;
    }

    if (shapeStart) {
      const w = pt.x - shapeStart.x;
      const h = pt.y - shapeStart.y;
      setCurrentShapePreview({
        x: w < 0 ? pt.x : shapeStart.x,
        y: h < 0 ? pt.y : shapeStart.y,
        w: activeConfig.tool === 'measure' ? w : Math.abs(w),
        h: activeConfig.tool === 'measure' ? h : Math.abs(h),
      });
    }
  };

  const handleMouseUp = () => {
    setIsMouseDownOnOverlay(false);
    if (isDraggingAnn) {
      setIsDraggingAnn(false);
    }

    if (isDrawing && drawingPoints.length > 1) {
      setIsDrawing(false);
      const minX = Math.min(...drawingPoints.map((p) => p.x));
      const maxX = Math.max(...drawingPoints.map((p) => p.x));
      const minY = Math.min(...drawingPoints.map((p) => p.y));
      const maxY = Math.max(...drawingPoints.map((p) => p.y));

      onAddAnnotation({
        id: Math.random().toString(36).substring(2, 9),
        pageIndex: page.pageIndex,
        type: activeConfig.tool === 'highlighter' ? 'highlighter' : 'pen',
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        color: activeConfig.color,
        strokeWidth: activeConfig.strokeWidth,
        opacity: activeConfig.tool === 'highlighter' 
          ? (activeConfig.opacity !== undefined && activeConfig.opacity < 1 ? activeConfig.opacity : 0.4) 
          : (activeConfig.opacity !== undefined ? activeConfig.opacity : 1.0),
        points: drawingPoints,
      } as DrawingAnnotation);
      setDrawingPoints([]);
      return;
    }

    if (shapeStart && currentShapePreview) {
      if (activeConfig.tool === 'measure') {
        const endX = shapeStart.x + currentShapePreview.w;
        const endY = shapeStart.y + currentShapePreview.h;
        const distPt = Math.hypot(currentShapePreview.w, currentShapePreview.h);
        const distCm = (distPt * 0.0352778).toFixed(2);

        onAddAnnotation({
          id: Math.random().toString(36).substring(2, 9),
          pageIndex: page.pageIndex,
          type: 'measure',
          x: shapeStart.x,
          y: shapeStart.y,
          width: Math.abs(currentShapePreview.w),
          height: Math.abs(currentShapePreview.h),
          endX: endX,
          endY: endY,
          distancePt: distPt,
          distanceFormatted: `${distCm} cm`,
          unit: 'cm',
          color: '#f59e0b',
        } as MeasurementAnnotation);
      } else {
        const w = Math.max(10, currentShapePreview.w);
        const h = Math.max(10, currentShapePreview.h);

        if (activeConfig.tool === 'redact') {
          onAddAnnotation({
            id: Math.random().toString(36).substring(2, 9),
            pageIndex: page.pageIndex,
            type: 'redact',
            x: currentShapePreview.x,
            y: currentShapePreview.y,
            width: w,
            height: h,
            color: '#000000',
          } as RedactionAnnotation);
        } else {
          onAddAnnotation({
            id: Math.random().toString(36).substring(2, 9),
            pageIndex: page.pageIndex,
            type: activeConfig.tool as any,
            x: currentShapePreview.x,
            y: currentShapePreview.y,
            width: w,
            height: h,
            color: activeConfig.color,
            strokeWidth: activeConfig.strokeWidth,
            opacity: activeConfig.opacity,
          } as ShapeAnnotation);
        }
      }

      setShapeStart(null);
      setCurrentShapePreview(null);
    }
  };

  const getFilterCss = (filter: ReaderFilter) => {
    switch (filter) {
      case 'sepia': return 'sepia(0.4) contrast(0.95) brightness(0.95)';
      case 'dark': return 'invert(0.9) hue-rotate(180deg) contrast(1.1)';
      case 'contrast': return 'contrast(1.6) brightness(0.92) saturate(1.2)';
      default: return 'contrast(1.08) brightness(0.98)';
    }
  };

  const getPageBg = (filter: ReaderFilter) => {
    switch (filter) {
      case 'sepia': return '#fcf5e5';
      case 'dark': return '#1e2022';
      default: return '#ffffff';
    }
  };

  return (
    <div
      ref={containerRef}
      onClick={() => {
        if (!isCurrentPage) {
          onSelectThisPage();
        }
      }}
      style={{
        position: 'relative',
        width: `${pageWidth}px`,
        height: `${pageHeight}px`,
        minWidth: `${pageWidth}px`,
        minHeight: `${pageHeight}px`,
        flexShrink: 0,
        background: getPageBg(readerFilter),
        boxShadow: isCurrentPage ? '0 0 0 3px var(--accent-primary), var(--shadow-lg)' : 'var(--shadow-md)',
        borderRadius: '3px',
        overflow: 'hidden',
        transition: 'box-shadow 0.15s ease, background 0.2s ease',
      }}
    >
      {/* Top Page Label Badge */}
      <div style={{
        position: 'absolute',
        top: 8,
        left: 8,
        background: isCurrentPage ? 'var(--accent-primary)' : 'rgba(15, 23, 42, 0.75)',
        color: '#ffffff',
        padding: '3px 8px',
        borderRadius: '4px',
        fontSize: '11px',
        fontWeight: 600,
        zIndex: 20,
        pointerEvents: 'none',
        backdropFilter: 'blur(4px)',
      }}>
        {page.isBlank ? `Sayfa ${pageOrderNumber} (Boş Sayfa)` : `Sayfa ${pageOrderNumber} / ${totalPages}`}
      </div>

      {/* Background PDF Canvas with Eye-Friendly Filters */}
      <canvas
        ref={bgCanvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          display: 'block',
          filter: getFilterCss(readerFilter),
          transition: 'filter 0.2s ease',
        }}
      />

      {!isRendered && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(241, 245, 249, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            fontSize: '13px',
            fontWeight: 500,
            pointerEvents: 'none',
          }}
        >
          Sayfa {pageOrderNumber} Yükleniyor...
        </div>
      )}

      {/* Selectable & Dynamic Native Text Layer */}
      {pdfTextItems.length > 0 && (
        <div
          className={`pdf-text-layer ${hasVisibleCanvasContent ? 'text-invisible' : 'text-visible'} ${readerFilter === 'dark' ? 'page-dark-filter' : ''}`}
          onMouseUp={updateSelectionBox}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 15,
            userSelect: activeConfig.tool === 'select' ? 'text' : 'none',
            cursor: activeConfig.tool === 'select' ? 'text' : 'default',
            lineHeight: 1,
            pointerEvents: activeConfig.tool === 'select' ? 'auto' : 'none',
          }}
        >
          {pdfTextItems.map((item) => (
            <span
              key={item.id}
              style={{
                position: 'absolute',
                left: `${item.x * zoom}px`,
                top: `${item.y * zoom}px`,
                fontSize: `${item.fontSize * zoom}px`,
                fontFamily: item.fontFamily,
                fontWeight: item.fontWeight === 'bold' ? 700 : 500,
                fontStyle: item.fontStyle || 'normal',
                color: hasVisibleCanvasContent ? 'transparent' : (readerFilter === 'dark' ? '#f1f5f9' : '#0f172a'),
                lineHeight: 1,
                whiteSpace: 'pre',
                transformOrigin: 'top left',
                display: 'inline-block',
              }}
            >
              {item.str}
            </span>
          ))}
        </div>
      )}

      {/* Floating Selection Tooltip (Copy & Instant Translate) */}
      {selectionPosition && selectedText && (
        <div
          style={{
            position: 'absolute',
            left: `${selectionPosition.x}px`,
            top: `${selectionPosition.y}px`,
            transform: 'translateX(-50%)',
            zIndex: 60,
            background: 'rgba(15, 23, 42, 0.96)',
            backdropFilter: 'blur(10px)',
            color: '#ffffff',
            padding: '4px 8px',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            border: '1px solid rgba(255,255,255,0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            pointerEvents: 'auto',
            animation: 'fadeIn 0.15s ease',
            maxWidth: '280px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              onClick={handleCopySelectedText}
              className="btn-ghost"
              style={{
                color: '#ffffff',
                padding: '2px 6px',
                fontSize: '11px',
                fontWeight: 600,
                gap: '4px',
                background: 'transparent',
              }}
            >
              {copiedFeedback ? (
                <>
                  <Check size={13} color="#10b981" />
                  <span style={{ color: '#10b981' }}>Kopyalandı!</span>
                </>
              ) : (
                <>
                  <Copy size={13} color="var(--accent-primary)" />
                  <span>Kopyala</span>
                </>
              )}
            </button>

            <button
              onClick={handleTranslateSelectedText}
              disabled={isTranslating}
              className="btn-ghost"
              style={{
                color: '#38bdf8',
                padding: '2px 6px',
                fontSize: '11px',
                fontWeight: 600,
                gap: '4px',
                background: 'transparent',
              }}
            >
              {isTranslating ? <Loader2 size={13} className="animate-spin" /> : <Globe size={13} />}
              <span>Çevir (TR)</span>
            </button>
          </div>

          {translatedText && (
            <div style={{
              background: 'rgba(30, 41, 59, 0.9)',
              padding: '6px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              color: '#38bdf8',
              lineHeight: 1.4,
              borderTop: '1px solid rgba(255,255,255,0.1)',
            }}>
              {translatedText}
            </div>
          )}
        </div>
      )}

      {/* Direct Text Edit Layer (Z-Index 35 to guarantee clickability) */}
      {activeConfig.tool === 'edit-text' && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 35, pointerEvents: 'auto' }}>
          {pdfTextItems.map((item) => (
            <div
              key={item.id}
              onClick={(e) => {
                e.stopPropagation();
                handleEditOriginalTextItem(item);
              }}
              onMouseEnter={() => setHoveredTextId(item.id)}
              onMouseLeave={() => setHoveredTextId(null)}
              style={{
                position: 'absolute',
                left: `${item.x * zoom}px`,
                top: `${item.y * zoom}px`,
                width: `${item.width * zoom}px`,
                height: `${item.height * zoom}px`,
                border: hoveredTextId === item.id ? '2px solid var(--accent-primary)' : '1px dashed rgba(56, 189, 248, 0.6)',
                background: hoveredTextId === item.id ? 'rgba(56, 189, 248, 0.25)' : 'rgba(56, 189, 248, 0.08)',
                borderRadius: '3px',
                cursor: 'pointer',
                transition: 'all 0.1s ease',
                boxShadow: hoveredTextId === item.id ? '0 0 10px rgba(56, 189, 248, 0.4)' : 'none',
              }}
            >
              {hoveredTextId === item.id && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: 0,
                    marginBottom: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'rgba(15, 23, 42, 0.95)',
                    backdropFilter: 'blur(8px)',
                    padding: '3px 6px',
                    borderRadius: '6px',
                    boxShadow: '0 6px 16px rgba(0,0,0,0.5)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    zIndex: 60,
                    whiteSpace: 'nowrap',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => handleEditOriginalTextItem(item)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: 'rgba(56, 189, 248, 0.25)',
                      color: '#38bdf8',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '2px 7px',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <Edit3 size={11} /> Düzenle
                  </button>
                  <button
                    onClick={() => handleDeleteOriginalTextItem(item)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: 'rgba(239, 68, 68, 0.25)',
                      color: '#f87171',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '2px 7px',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={11} /> Metni Sil
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Interactive Overlay Canvas for Drawing/Shapes/Measurement */}
      <canvas
        ref={overlayCanvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          cursor: activeConfig.tool === 'eraser' 
            ? 'crosshair' 
            : (activeConfig.tool === 'select' 
                ? (isDraggingAnn ? 'grabbing' : 'default') 
                : 'crosshair'),
          display: 'block',
          zIndex: activeConfig.tool === 'edit-text' ? 10 : 25,
          pointerEvents: activeConfig.tool === 'edit-text' ? 'none' : 'auto',
        }}
      />

      {/* Inline Text Inputs for Active Editing */}
      {annotations.map((ann) => {
        if (ann.type !== 'text' || editingTextId !== ann.id) return null;
        const textAnn = ann as TextAnnotation;

        return (
          <textarea
            key={ann.id}
            autoFocus
            placeholder="Metin yazın..."
            value={textAnn.text}
            onFocus={(e) => {
              if (textAnn.text) e.target.select();
            }}
            onChange={(e) => {
              const val = e.target.value;
              const lineCount = val.split('\n').length;
              const maxLineLen = Math.max(...val.split('\n').map(l => l.length), 5);
              const approxW = Math.max(120, Math.min(600, maxLineLen * (textAnn.fontSize || 14) * 0.65 + 24));
              const approxH = Math.max(28, lineCount * (textAnn.fontSize || 14) * 1.35 + 8);
              onUpdateAnnotation({
                ...textAnn,
                text: val,
                width: approxW,
                height: approxH,
              });
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
                e.preventDefault();
                setEditingTextId(null);
              }
            }}
            onBlur={() => {
              if (!textAnn.text.trim() && !textAnn.backgroundColor) {
                onDeleteAnnotation(textAnn.id);
              }
              setEditingTextId(null);
            }}
            style={{
              position: 'absolute',
              left: `${textAnn.x * zoom}px`,
              top: `${textAnn.y * zoom}px`,
              fontSize: `${(textAnn.fontSize || 14) * zoom}px`,
              fontFamily: textAnn.fontFamily || 'Inter, sans-serif',
              fontWeight: textAnn.fontWeight === 'bold' ? 700 : 400,
              fontStyle: textAnn.fontStyle || 'normal',
              color: textAnn.color || '#0f172a',
              background: textAnn.backgroundColor && textAnn.backgroundColor !== 'transparent' 
                ? textAnn.backgroundColor 
                : 'rgba(255, 255, 255, 0.98)',
              border: '2px solid var(--accent-primary)',
              borderRadius: '4px',
              padding: '4px 6px',
              resize: 'both',
              outline: 'none',
              zIndex: 50,
              minWidth: '120px',
              minHeight: '30px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
              lineHeight: 1.25,
            }}
          />
        );
      })}
    </div>
  );
};
