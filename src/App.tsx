import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import type { 
  PDFDocumentState, 
  ActiveToolConfig, 
  Annotation, 
  PageState, 
  StampAnnotation,
  TextAnnotation,
  SearchMatch,
  ReaderFilter
} from './types/pdf';
import { getSharedPdfDoc, clearPdfCache } from './utils/pdfInit';
import { createSamplePdf } from './utils/samplePdf';
import { exportModifiedPdf, createBlankPdf } from './utils/pdfExport';

import { Header } from './components/Header';
import { Toolbar } from './components/Toolbar';
import { PropertyInspector } from './components/PropertyInspector';
import { ThumbnailSidebar } from './components/ThumbnailSidebar';
import { PDFViewer } from './components/PDFViewer';
import { WelcomeScreen } from './components/WelcomeScreen';
import { SearchBar } from './components/SearchBar';

import { CheckCircle2, AlertCircle, Info, ChevronLeft, ChevronRight, Minimize2 } from 'lucide-react';

// Lazy-loaded modals & components to optimize initial bundle size & load on demand
const SignatureModal = lazy(() => import('./components/SignatureModal').then(m => ({ default: m.SignatureModal })));
const StampModal = lazy(() => import('./components/StampModal').then(m => ({ default: m.StampModal })));
const PageOrganizeModal = lazy(() => import('./components/PageOrganizeModal').then(m => ({ default: m.PageOrganizeModal })));
const MergePdfModal = lazy(() => import('./components/MergePdfModal').then(m => ({ default: m.MergePdfModal })));
const OcrModal = lazy(() => import('./components/OcrModal').then(m => ({ default: m.OcrModal })));
const AboutModal = lazy(() => import('./components/AboutModal').then(m => ({ default: m.AboutModal })));
const WatermarkModal = lazy(() => import('./components/WatermarkModal').then(m => ({ default: m.WatermarkModal })));
const ExportImageModal = lazy(() => import('./components/ExportImageModal').then(m => ({ default: m.ExportImageModal })));
const ExportOfficeModal = lazy(() => import('./components/ExportOfficeModal').then(m => ({ default: m.ExportOfficeModal })));
const SecurityModal = lazy(() => import('./components/SecurityModal').then(m => ({ default: m.SecurityModal })));
const CompressModal = lazy(() => import('./components/CompressModal').then(m => ({ default: m.CompressModal })));
const SplitPdfModal = lazy(() => import('./components/SplitPdfModal').then(m => ({ default: m.SplitPdfModal })));
const PageNumberingModal = lazy(() => import('./components/PageNumberingModal').then(m => ({ default: m.PageNumberingModal })));
const ComparePdfModal = lazy(() => import('./components/ComparePdfModal').then(m => ({ default: m.ComparePdfModal })));
const SettingsModal = lazy(() => import('./components/SettingsModal').then(m => ({ default: m.SettingsModal })));
const DocPropertiesModal = lazy(() => import('./components/DocPropertiesModal').then(m => ({ default: m.DocPropertiesModal })));
const CommandPalette = lazy(() => import('./components/CommandPalette').then(m => ({ default: m.CommandPalette })));
const StatusBar = lazy(() => import('./components/StatusBar').then(m => ({ default: m.StatusBar })));

import { loadSettings, saveSettings } from './types/settings';
import type { AppSettings } from './types/settings';

export function App() {
  // User Settings state
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());

  // Theme state
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const s = loadSettings();
    return s.theme || 'dark';
  });
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const s = loadSettings();
    return s.sidebarDefaultOpen !== undefined ? s.sidebarDefaultOpen : true;
  });
  const [readerFilter, setReaderFilter] = useState<ReaderFilter>(() => {
    const s = loadSettings();
    return s.readerFilter || 'normal';
  });

  // Zoom state
  const [zoom, setZoom] = useState<number>(() => {
    const s = loadSettings();
    return s.defaultZoom || 1.0;
  });

  // Document State
  const [docState, setDocState] = useState<PDFDocumentState>({
    filename: '',
    fileSize: 0,
    data: null,
    numPages: 0,
    pages: [],
    pageOrder: [],
    annotations: {},
  });

  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);

  // Undo / Redo History
  const [history, setHistory] = useState<PDFDocumentState[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Search State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchMatches, setSearchMatches] = useState<SearchMatch[]>([]);
  const [activeMatchIndex, setActiveMatchIndex] = useState<number>(-1);

  // Active Tool Configuration
  const [activeConfig, setActiveConfig] = useState<ActiveToolConfig>({
    tool: 'select',
    color: '#0f172a',
    fillColor: 'transparent',
    strokeWidth: 3,
    opacity: 1.0,
    fontSize: 16,
    fontFamily: 'Inter, sans-serif',
    fontWeight: 'normal',
    fontStyle: 'normal',
    textAlign: 'left',
    stampType: 'APPROVED',
    customStampText: 'ONAYLANDI',
    measureUnit: 'cm',
  });

  // Selected Annotation
  const [selectedAnnotation, setSelectedAnnotation] = useState<Annotation | null>(null);

  // Modals state
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [pendingSignatureData, setPendingSignatureData] = useState<string | null>(null);

  const [isStampModalOpen, setIsStampModalOpen] = useState(false);
  const [pendingStampData, setPendingStampData] = useState<Partial<StampAnnotation> | null>(null);

  const [pendingImageData, setPendingImageData] = useState<string | null>(null);
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3200);
  };

  const [isOrganizeModalOpen, setIsOrganizeModalOpen] = useState(false);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isWatermarkModalOpen, setIsWatermarkModalOpen] = useState(false);
  const [isExportImageModalOpen, setIsExportImageModalOpen] = useState(false);
  const [isExportOfficeModalOpen, setIsExportOfficeModalOpen] = useState(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [isCompressModalOpen, setIsCompressModalOpen] = useState(false);
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [isPageNumberingModalOpen, setIsPageNumberingModalOpen] = useState(false);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [isDocPropertiesOpen, setIsDocPropertiesOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const handleFitPage = () => setZoom(0.85);
  const handleFitWidth = () => setZoom(1.25);

  const handleSaveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
    if (newSettings.theme !== theme) setTheme(newSettings.theme);
    if (newSettings.readerFilter !== readerFilter) setReaderFilter(newSettings.readerFilter);
    if (newSettings.sidebarDefaultOpen !== sidebarOpen) setSidebarOpen(newSettings.sidebarDefaultOpen);
    setActiveConfig(prev => ({
      ...prev,
      color: newSettings.defaultPenColor,
      strokeWidth: newSettings.defaultPenWidth,
      fontSize: newSettings.defaultFontSize,
      fontFamily: newSettings.defaultFontFamily,
    }));
  };

  const handleClearRecentFiles = () => {
    try {
      localStorage.removeItem('pdfstudio_recent_files');
      showToast('Son açılan dosyalar geçmişi temizlendi.', 'info');
    } catch {
      // Ignore storage errors
    }
  };

  const addToRecentFiles = (name: string, path: string) => {
    try {
      const stored = localStorage.getItem('pdfstudio_recent_files');
      let recents: Array<{ name: string; path: string; lastOpened: number }> = stored ? JSON.parse(stored) : [];
      recents = recents.filter(f => f.path !== path);
      recents.unshift({ name, path, lastOpened: Date.now() });
      if (recents.length > 6) recents = recents.slice(0, 6);
      localStorage.setItem('pdfstudio_recent_files', JSON.stringify(recents));
    } catch {
      // Ignore storage errors
    }
  };

  // Helper to parse PDF ArrayBuffer and build page states instantaneously
  const parseAndSetPdf = async (arrayBuffer: ArrayBuffer, filename: string, fileSize: number) => {
    try {
      clearPdfCache();
      const pdf = await getSharedPdfDoc(arrayBuffer);
      if (!pdf) throw new Error('PDF yüklenemedi');

      const numPages = pdf.numPages;
      const pages: PageState[] = [];
      const pageOrder: number[] = [];

      for (let pageIdx = 0; pageIdx < numPages; pageIdx++) {
        const p = await pdf.getPage(pageIdx + 1);
        const vp = p.getViewport({ scale: 1.0 });
        const defaultW = vp.width;
        const defaultH = vp.height;

        pages.push({
          pageIndex: pageIdx,
          originalPageNumber: pageIdx + 1,
          displayPageNumber: pageIdx + 1,
          rotation: 0,
          width: defaultW,
          height: defaultH,
          aspectRatio: defaultW / defaultH,
        });
        pageOrder.push(pageIdx);
      }

      const initialDoc: PDFDocumentState = {
        filename,
        fileSize,
        data: arrayBuffer,
        numPages,
        pages,
        pageOrder,
        annotations: {},
      };

      setDocState(initialDoc);
      setHistory([initialDoc]);
      setHistoryIndex(0);
      setCurrentPageIndex(0);
      setSelectedAnnotation(null);
      setSearchMatches([]);
      setActiveMatchIndex(-1);
      setIsDirty(false);
    } catch (err) {
      console.error('PDF parsing error:', err);
      showToast('PDF dosyası açılırken bir hata oluştu.', 'error');
    }
  };

  const loadSampleDocument = async () => {
    try {
      const sampleBytes = await createSamplePdf();
      const buffer = sampleBytes.buffer.slice(sampleBytes.byteOffset, sampleBytes.byteOffset + sampleBytes.byteLength);
      setCurrentFilePath(null);
      await parseAndSetPdf(buffer as ArrayBuffer, 'Ornek_Sozlesme_Sablonu.pdf', sampleBytes.byteLength);
    } catch (e) {
      console.error('Failed to create sample PDF:', e);
    }
  };

  const handleOpenPdfFile = async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    const filePath = (file as any).path || null;
    setCurrentFilePath(filePath);
    if (filePath) {
      addToRecentFiles(file.name, filePath);
    }
    await parseAndSetPdf(arrayBuffer, file.name, file.size);
    showToast(`Açıldı: ${file.name}`, 'info');
  };

  const loadStartupFileOrSample = async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const startupPath = await invoke<string | null>('get_startup_file');
      if (startupPath) {
        const fileBytes = await invoke<number[]>('read_pdf_file', { path: startupPath });
        const buffer = new Uint8Array(fileBytes).buffer;
        const filename = startupPath.split(/[\\/]/).pop() || 'Belge.pdf';
        setCurrentFilePath(startupPath);
        addToRecentFiles(filename, startupPath);
        await parseAndSetPdf(buffer, filename, fileBytes.length);
        return;
      }
    } catch {
      // In browser or standalone mode without CLI args
    }

    // Check if this is the first launch ever
    const hasLaunchedBefore = localStorage.getItem('pdfstudio_has_launched');
    if (!hasLaunchedBefore) {
      localStorage.setItem('pdfstudio_has_launched', 'true');
      loadSampleDocument();
    }
  };

  // Sync theme attribute to HTML tag
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Load startup file passed via CLI / "Open With" or fallback to sample PDF
  useEffect(() => {
    const timer = setTimeout(() => {
      void loadStartupFileOrSample();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Native window Drag & Drop listener for PDFs
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        const file = e.dataTransfer.files[0];
        if (file.name.toLowerCase().endsWith('.pdf')) {
          handleOpenPdfFile(file);
        }
      }
    };

    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);
    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, []);

  // Helper to commit state into Undo/Redo stack
  const updateDocWithHistory = useCallback((updater: (prev: PDFDocumentState) => PDFDocumentState) => {
    setDocState((prev) => {
      const nextState = updater(prev);
      setHistory((prevHist) => {
        const sliced = prevHist.slice(0, historyIndex + 1);
        return [...sliced, nextState];
      });
      setHistoryIndex((prevIdx) => prevIdx + 1);
      setIsDirty(true);
      return nextState;
    });
  }, [historyIndex]);

  const handleCreateBlankPdf = async () => {
    try {
      const blankBytes = await createBlankPdf();
      const buffer = blankBytes.buffer.slice(blankBytes.byteOffset, blankBytes.byteOffset + blankBytes.byteLength);
      setCurrentFilePath(null);
      await parseAndSetPdf(buffer as ArrayBuffer, 'Yeni_Belge.pdf', blankBytes.byteLength);
      showToast('✓ Yeni boş belge oluşturuldu', 'info');
    } catch (err) {
      console.error('Blank PDF error:', err);
    }
  };

  const handleOpenRecentFile = async (path: string) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const fileBytes = await invoke<number[]>('read_pdf_file', { path });
      const buffer = new Uint8Array(fileBytes).buffer;
      const filename = path.split(/[\\/]/).pop() || 'Belge.pdf';
      setCurrentFilePath(path);
      addToRecentFiles(filename, path);
      await parseAndSetPdf(buffer, filename, fileBytes.length);
      showToast(`Açıldı: ${filename}`, 'info');
    } catch (err) {
      console.error('Failed to open recent file:', err);
      showToast('Dosya açılamadı veya taşınmış olabilir: ' + path, 'error');
    }
  };

  const handleCloseDocument = () => {
    setDocState({
      filename: '',
      fileSize: 0,
      data: null,
      numPages: 0,
      pages: [],
      pageOrder: [],
      annotations: {},
    });
    setCurrentFilePath(null);
    setSelectedAnnotation(null);
    setHistory([]);
    setHistoryIndex(-1);
    setSearchMatches([]);
    setActiveMatchIndex(-1);
  };

  const handleOpenNativePdf = async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const chosenPath = await invoke<string | null>('open_pdf_dialog');
      if (chosenPath) {
        const fileBytes = await invoke<number[]>('read_pdf_file', { path: chosenPath });
        const buffer = new Uint8Array(fileBytes).buffer;
        const filename = chosenPath.split(/[\\/]/).pop() || 'Belge.pdf';
        setCurrentFilePath(chosenPath);
        addToRecentFiles(filename, chosenPath);
        await parseAndSetPdf(buffer, filename, fileBytes.length);
        showToast(`Açıldı: ${filename}`, 'info');
      }
    } catch (err) {
      console.warn('Native open dialog fallback:', err);
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/pdf';
      input.onchange = (e: any) => {
        if (e.target.files && e.target.files[0]) {
          handleOpenPdfFile(e.target.files[0]);
        }
      };
      input.click();
    }
  };

  // Undo / Redo Handlers
  const handleUndo = () => {
    if (historyIndex > 0) {
      const targetIndex = historyIndex - 1;
      setDocState(history[targetIndex]);
      setHistoryIndex(targetIndex);
      setSelectedAnnotation(null);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const targetIndex = historyIndex + 1;
      setDocState(history[targetIndex]);
      setHistoryIndex(targetIndex);
      setSelectedAnnotation(null);
    }
  };

  // Direct Save Handler (Ctrl+S) - Overwrites opened file seamlessly or prompts Save As
  const handleSavePdf = async () => {
    if (!docState.data) return;

    if (currentFilePath) {
      try {
        const exportedBytes = await exportModifiedPdf(docState);
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('write_pdf_file', {
          path: currentFilePath,
          contents: Array.from(exportedBytes),
        });
        setIsDirty(false);
        showToast(`✓ Kaydedildi: ${docState.filename}`, 'success');
        return;
      } catch (err) {
        console.error('Direct save error, falling back to Save As:', err);
      }
    }

    // If no existing file path, prompt Save As
    await handleSaveAsPdf();
  };

  // Save As Handler (Ctrl+Shift+S) - Native Save Dialog to pick location and name
  const handleSaveAsPdf = async () => {
    if (!docState.data) return;

    try {
      const exportedBytes = await exportModifiedPdf(docState);
      const defaultName = docState.filename || 'Belge.pdf';

      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const chosenPath = await invoke<string | null>('pick_save_pdf_path', { defaultName });
        if (chosenPath) {
          await invoke('write_pdf_file', {
            path: chosenPath,
            contents: Array.from(exportedBytes),
          });
          const newFilename = chosenPath.split(/[\\/]/).pop() || defaultName;
          setCurrentFilePath(chosenPath);
          setDocState(prev => ({ ...prev, filename: newFilename }));
          setIsDirty(false);
          showToast(`✓ Farklı kaydedildi: ${newFilename}`, 'success');
          return;
        } else {
          return; // Cancelled
        }
      } catch {
        // Fallback for browser download mode
        const blob = new Blob([exportedBytes as any], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const baseName = docState.filename ? docState.filename.replace('.pdf', '') : 'Belge';
        a.download = `${baseName}_Duzenlenmis.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setIsDirty(false);
        showToast('✓ PDF İndirildi', 'success');
      }
    } catch (err) {
      console.error('Save As error:', err);
      showToast('PDF kaydedilirken bir hata oluştu: ' + (err as Error).message, 'error');
    }
  };

  // Print PDF Handler
  const handlePrint = async () => {
    if (!docState.data) return;
    try {
      const exportedBytes = await exportModifiedPdf(docState);
      const blob = new Blob([exportedBytes as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = url;
      document.body.appendChild(iframe);
      iframe.onload = () => {
        iframe.contentWindow?.print();
      };
    } catch (err) {
      console.error('Print error:', err);
    }
  };

  // Page Operations
  const handleRotatePage = (pageIndex: number) => {
    updateDocWithHistory((prev) => ({
      ...prev,
      pages: prev.pages.map((p) =>
        p.pageIndex === pageIndex ? { ...p, rotation: ((p.rotation || 0) + 90) % 360 } : p
      ),
    }));
  };

  const handleRotateAllPages = () => {
    updateDocWithHistory((prev) => ({
      ...prev,
      pages: prev.pages.map((p) => ({ ...p, rotation: ((p.rotation || 0) + 90) % 360 })),
    }));
  };

  const handleDuplicatePage = (pageIndex: number) => {
    const pageToDup = docState.pages.find((p) => p.pageIndex === pageIndex);
    if (!pageToDup) return;

    const newPageIndex = Math.max(...docState.pages.map((p) => p.pageIndex)) + 1;
    const newPage: PageState = {
      ...pageToDup,
      pageIndex: newPageIndex,
    };

    updateDocWithHistory((prev) => {
      const currentOrderIdx = prev.pageOrder.indexOf(pageIndex);
      const newOrder = [...prev.pageOrder];
      newOrder.splice(currentOrderIdx + 1, 0, newPageIndex);

      return {
        ...prev,
        pages: [...prev.pages, newPage],
        pageOrder: newOrder,
        annotations: {
          ...prev.annotations,
          [newPageIndex]: prev.annotations[pageIndex] ? [...prev.annotations[pageIndex]] : [],
        },
      };
    });
  };

  const handleDeletePage = (pageIndex: number) => {
    updateDocWithHistory((prev) => ({
      ...prev,
      pages: prev.pages.map((p) => (p.pageIndex === pageIndex ? { ...p, isDeleted: true } : p)),
    }));
  };

  const handleMovePage = (fromOrderIndex: number, toOrderIndex: number) => {
    updateDocWithHistory((prev) => {
      const newOrder = [...prev.pageOrder];
      const [moved] = newOrder.splice(fromOrderIndex, 1);
      newOrder.splice(toOrderIndex, 0, moved);
      return {
        ...prev,
        pageOrder: newOrder,
      };
    });
  };

  const handleAddBlankPage = () => {
    const newPageIndex = docState.pages.length > 0 ? Math.max(...docState.pages.map((p) => p.pageIndex)) + 1 : 0;
    const newPage: PageState = {
      pageIndex: newPageIndex,
      originalPageNumber: 0,
      displayPageNumber: docState.pageOrder.length + 1,
      rotation: 0,
      width: 595.28,
      height: 841.89,
      aspectRatio: 595.28 / 841.89,
      isBlank: true,
    };

    updateDocWithHistory((prev) => ({
      ...prev,
      pages: [...prev.pages, newPage],
      pageOrder: [...prev.pageOrder, newPageIndex],
    }));
  };

  // Direct Page Number Navigation (1-based)
  const handlePageNumberJump = (targetPageNumber: number) => {
    const activePages = docState.pageOrder
      .map(idx => docState.pages.find(p => p.pageIndex === idx))
      .filter((p): p is PageState => p !== undefined && !p.isDeleted);

    const targetPage = activePages[targetPageNumber - 1];
    if (targetPage) {
      setCurrentPageIndex(targetPage.pageIndex);
    }
  };

  // Annotations Operations
  const handleAddAnnotation = (pageIndex: number, ann: Annotation) => {
    updateDocWithHistory((prev) => {
      const existing = prev.annotations[pageIndex] || [];
      return {
        ...prev,
        annotations: {
          ...prev.annotations,
          [pageIndex]: [...existing, ann],
        },
      };
    });
  };

  const handleUpdateAnnotation = (pageIndex: number, ann: Annotation) => {
    setDocState((prev) => {
      const existing = prev.annotations[pageIndex] || [];
      return {
        ...prev,
        annotations: {
          ...prev.annotations,
          [pageIndex]: existing.map((item) => (item.id === ann.id ? ann : item)),
        },
      };
    });
    setSelectedAnnotation(ann);
  };

  const handleDeleteAnnotationById = (pageIndex: number, annId: string) => {
    updateDocWithHistory((prev) => {
      const existing = prev.annotations[pageIndex] || [];
      return {
        ...prev,
        annotations: {
          ...prev.annotations,
          [pageIndex]: existing.filter((item) => item.id !== annId),
        },
      };
    });
    if (selectedAnnotation?.id === annId) {
      setSelectedAnnotation(null);
    }
  };

  const handleDeleteSelectedAnnotation = () => {
    if (!selectedAnnotation) return;
    handleDeleteAnnotationById(selectedAnnotation.pageIndex, selectedAnnotation.id);
  };

  const handleDuplicateSelectedAnnotation = () => {
    if (!selectedAnnotation) return;
    const pageIndex = selectedAnnotation.pageIndex;
    const duplicated: Annotation = {
      ...selectedAnnotation,
      id: Math.random().toString(36).substring(2, 9),
      x: selectedAnnotation.x + 20,
      y: selectedAnnotation.y + 20,
    };

    handleAddAnnotation(pageIndex, duplicated);
    setSelectedAnnotation(duplicated);
  };

  const handleBringForward = () => {
    if (!selectedAnnotation) return;
    const pageIndex = selectedAnnotation.pageIndex;

    setDocState((prev) => {
      const list = prev.annotations[pageIndex] || [];
      const idx = list.findIndex((a) => a.id === selectedAnnotation.id);
      if (idx < 0 || idx >= list.length - 1) return prev;
      const nextList = [...list];
      const [item] = nextList.splice(idx, 1);
      nextList.splice(idx + 1, 0, item);
      return {
        ...prev,
        annotations: { ...prev.annotations, [pageIndex]: nextList },
      };
    });
  };

  const handleSendBackward = () => {
    if (!selectedAnnotation) return;
    const pageIndex = selectedAnnotation.pageIndex;

    setDocState((prev) => {
      const list = prev.annotations[pageIndex] || [];
      const idx = list.findIndex((a) => a.id === selectedAnnotation.id);
      if (idx <= 0) return prev;
      const nextList = [...list];
      const [item] = nextList.splice(idx, 1);
      nextList.splice(idx - 1, 0, item);
      return {
        ...prev,
        annotations: { ...prev.annotations, [pageIndex]: nextList },
      };
    });
  };

  // OCR Apply Handler
  const handleApplyOcrAnnotations = (pageIndex: number, ocrLines: TextAnnotation[]) => {
    updateDocWithHistory((prev) => {
      const existing = prev.annotations[pageIndex] || [];
      return {
        ...prev,
        annotations: {
          ...prev.annotations,
          [pageIndex]: [...existing, ...ocrLines],
        },
      };
    });
  };

  // Watermark Apply Handler
  const handleApplyWatermark = (watermarkMap: Record<number, TextAnnotation[]>) => {
    updateDocWithHistory((prev) => {
      const nextAnnotations = { ...prev.annotations };
      Object.keys(watermarkMap).forEach((pIdxStr) => {
        const pIdx = Number(pIdxStr);
        const existing = nextAnnotations[pIdx] || [];
        nextAnnotations[pIdx] = [...existing, ...watermarkMap[pIdx]];
      });
      return {
        ...prev,
        annotations: nextAnnotations,
      };
    });
  };

  // Page Numbering Apply Handler
  const handleApplyPageNumbers = (numMap: Record<number, TextAnnotation[]>) => {
    updateDocWithHistory((prev) => {
      const nextAnnotations = { ...prev.annotations };
      Object.keys(numMap).forEach((pIdxStr) => {
        const pIdx = Number(pIdxStr);
        const existing = nextAnnotations[pIdx] || [];
        nextAnnotations[pIdx] = [...existing, ...numMap[pIdx]];
      });
      return {
        ...prev,
        annotations: nextAnnotations,
      };
    });
  };

  // Insert Image Handler
  const handleInsertImage = async (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPendingImageData(dataUrl);
      setActiveConfig((prev) => ({ ...prev, tool: 'image' }));
    };
    reader.readAsDataURL(file);
  };

  // Search Match Selection Handler
  const handleActiveMatchChange = (index: number) => {
    setActiveMatchIndex(index);
    if (searchMatches[index]) {
      setCurrentPageIndex(searchMatches[index].pageIndex);
    }
  };

  // Keep actions ref updated for window keyboard listener without rebinding
  const actionsRef = useRef({
    undo: handleUndo,
    redo: handleRedo,
    save: handleSavePdf,
    saveAs: handleSaveAsPdf,
    openNative: handleOpenNativePdf,
    deleteAnnotation: handleDeleteSelectedAnnotation,
    selectedAnn: selectedAnnotation,
    hasDocData: !!docState.data,
    fullscreen: isFullscreen,
  });

  useEffect(() => {
    actionsRef.current = {
      undo: handleUndo,
      redo: handleRedo,
      save: handleSavePdf,
      saveAs: handleSaveAsPdf,
      openNative: handleOpenNativePdf,
      deleteAnnotation: handleDeleteSelectedAnnotation,
      selectedAnn: selectedAnnotation,
      hasDocData: !!docState.data,
      fullscreen: isFullscreen,
    };
  });

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const act = actionsRef.current;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        if (act.hasDocData) {
          e.preventDefault();
          setIsDocPropertiesOpen(true);
        }
        return;
      }
      if (e.key === 'F11') {
        e.preventDefault();
        setIsFullscreen((prev) => !prev);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        setZoom(0.85);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '1') {
        e.preventDefault();
        setZoom(1.0);
        return;
      }
      if (e.key === 'Escape') {
        if (act.fullscreen) {
          e.preventDefault();
          setIsFullscreen(false);
          return;
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        act.undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault();
        act.redo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (e.shiftKey) {
          act.saveAs();
        } else {
          act.save();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        act.openNative();
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && act.selectedAnn && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        act.deleteAnnotation();
      }
      if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        if (e.key.toLowerCase() === 'v') setActiveConfig((prev) => ({ ...prev, tool: 'select' }));
        if (e.key.toLowerCase() === 'h') setActiveConfig((prev) => ({ ...prev, tool: 'pan' }));
        if (e.key.toLowerCase() === 'p') setActiveConfig((prev) => ({ ...prev, tool: 'pen' }));
        if (e.key.toLowerCase() === 't') setActiveConfig((prev) => ({ ...prev, tool: 'text' }));
        if (e.key.toLowerCase() === 'e') setActiveConfig((prev) => ({ ...prev, tool: 'edit-text' }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Guarantee that window / documentElement can never scroll out of view
  useEffect(() => {
    const lockWindowScroll = () => {
      if (window.scrollY !== 0 || window.scrollX !== 0) {
        window.scrollTo(0, 0);
      }
    };
    window.addEventListener('scroll', lockWindowScroll, { passive: true });
    return () => window.removeEventListener('scroll', lockWindowScroll);
  }, []);

  const activePages = docState.pageOrder
    .map(idx => docState.pages.find(p => p.pageIndex === idx))
    .filter((p): p is PageState => p !== undefined && !p.isDeleted);
  
  const currentActualPageOrderIndex = activePages.findIndex(p => p.pageIndex === currentPageIndex);
  const currentDisplayPageNumber = currentActualPageOrderIndex !== -1 ? currentActualPageOrderIndex + 1 : 1;
  const currentActualPage = activePages.find(p => p.pageIndex === currentPageIndex) || activePages[0];

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Floating Action Toast Notification */}
      {toast && (
        <div
          className="animate-fade-in"
          style={{
            position: 'fixed',
            top: '56px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: toast.type === 'success' 
              ? 'linear-gradient(135deg, rgba(5, 150, 105, 0.95), rgba(16, 185, 129, 0.95))' 
              : toast.type === 'error' 
              ? 'linear-gradient(135deg, rgba(220, 38, 38, 0.95), rgba(239, 68, 68, 0.95))' 
              : 'linear-gradient(135deg, rgba(37, 99, 235, 0.95), rgba(59, 130, 246, 0.95))',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: '#ffffff',
            padding: '8px 20px',
            borderRadius: 'var(--radius-full)',
            fontSize: '12.5px',
            fontWeight: 600,
            boxShadow: '0 12px 30px -4px rgba(0, 0, 0, 0.5), 0 0 15px rgba(56, 189, 248, 0.2)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            pointerEvents: 'none',
          }}
        >
          {toast.type === 'success' && <CheckCircle2 size={16} />}
          {toast.type === 'error' && <AlertCircle size={16} />}
          {toast.type === 'info' && <Info size={16} />}
          <span>{toast.text}</span>
        </div>
      )}

      {/* 1. Top Header (Hidden in Fullscreen Presentation Mode) */}
      {!isFullscreen && (
        <Header
          docState={docState}
          currentPageNumber={currentDisplayPageNumber}
          totalPages={activePages.length}
          onPageNumberChange={handlePageNumberJump}
          onOpenPdf={handleOpenPdfFile}
          onOpenNativePdf={handleOpenNativePdf}
          onCloseDocument={handleCloseDocument}
          onLoadSample={loadSampleDocument}
          onSavePdf={handleSavePdf}
          onSaveAsPdf={handleSaveAsPdf}
          onPrint={handlePrint}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={historyIndex > 0}
          canRedo={historyIndex < history.length - 1}
          zoom={zoom}
          onZoomChange={setZoom}
          onFitWidth={handleFitWidth}
          onFitPage={handleFitPage}
          theme={theme}
          onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          onOpenOrganizeModal={() => setIsOrganizeModalOpen(true)}
          onOpenMergeModal={() => setIsMergeModalOpen(true)}
          onOpenSplitModal={() => setIsSplitModalOpen(true)}
          onOpenPageNumberingModal={() => setIsPageNumberingModalOpen(true)}
          onOpenCompareModal={() => setIsCompareModalOpen(true)}
          onOpenAboutModal={() => setIsAboutModalOpen(true)}
          onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
          onOpenWatermarkModal={() => setIsWatermarkModalOpen(true)}
          onOpenExportImageModal={() => setIsExportImageModalOpen(true)}
          onOpenExportOfficeModal={() => setIsExportOfficeModalOpen(true)}
          onOpenSecurityModal={() => setIsSecurityModalOpen(true)}
          onOpenCompressModal={() => setIsCompressModalOpen(true)}
          readerFilter={readerFilter}
          onReaderFilterChange={setReaderFilter}
          isSearchOpen={isSearchOpen}
          onToggleSearch={() => setIsSearchOpen(!isSearchOpen)}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onOpenProperties={() => setIsDocPropertiesOpen(true)}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => setIsFullscreen((prev) => !prev)}
        />
      )}

      {/* 2. When No PDF is Loaded: Gorgeous Welcome Dashboard */}
      {!docState.data ? (
        <WelcomeScreen
          onOpenPdfFile={handleOpenPdfFile}
          onOpenNativePdf={handleOpenNativePdf}
          onOpenRecentFile={handleOpenRecentFile}
          onCreateBlankPdf={handleCreateBlankPdf}
          onLoadSample={loadSampleDocument}
          onOpenMergeModal={() => setIsMergeModalOpen(true)}
          onOpenSplitModal={() => setIsSplitModalOpen(true)}
        />
      ) : (
        <>
          {/* Main Tool Palette (Hidden in Fullscreen Presentation Mode) */}
          {!isFullscreen && (
            <Toolbar
              activeConfig={activeConfig}
              onSelectTool={(tool) => {
                setActiveConfig((prev) => ({ ...prev, tool }));
                if (tool !== 'select') setSelectedAnnotation(null);
              }}
              onOpenSignatureModal={() => setIsSignatureModalOpen(true)}
              onOpenStampModal={() => setIsStampModalOpen(true)}
              onOpenOcrModal={() => setIsOcrModalOpen(true)}
              onInsertImage={handleInsertImage}
            />
          )}

          {/* Dynamic Property Inspector (Hidden in Fullscreen Presentation Mode) */}
          {!isFullscreen && (
            <PropertyInspector
              activeConfig={activeConfig}
              selectedAnnotation={selectedAnnotation}
              onUpdateConfig={(partial) => setActiveConfig((prev) => ({ ...prev, ...partial }))}
              onUpdateSelectedAnnotation={(partial) => {
                if (selectedAnnotation) {
                  handleUpdateAnnotation(selectedAnnotation.pageIndex, {
                    ...selectedAnnotation,
                    ...partial,
                  } as Annotation);
                }
              }}
              onDeleteSelectedAnnotation={handleDeleteSelectedAnnotation}
              onDuplicateSelectedAnnotation={handleDuplicateSelectedAnnotation}
              onBringForward={handleBringForward}
              onSendBackward={handleSendBackward}
            />
          )}

          {/* Search Bar Overlay */}
          {!isFullscreen && (
            <SearchBar
              isOpen={isSearchOpen}
              onClose={() => setIsSearchOpen(false)}
              docState={docState}
              onMatchesFound={(matches, initialActive) => {
                setSearchMatches(matches);
                setActiveMatchIndex(initialActive);
                if (matches.length > 0 && matches[0]) {
                  setCurrentPageIndex(matches[0].pageIndex);
                }
              }}
              onActiveMatchChange={handleActiveMatchChange}
              activeMatchIndex={activeMatchIndex}
            />
          )}

          {/* Central Workspace Area (Sidebar + Canvas Viewer) */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
            {sidebarOpen && !isFullscreen && (
              <ThumbnailSidebar
                docState={docState}
                currentPageIndex={currentPageIndex}
                onSelectPage={setCurrentPageIndex}
                onRotatePage={handleRotatePage}
                onDuplicatePage={handleDuplicatePage}
                onDeletePage={handleDeletePage}
                onMovePage={handleMovePage}
                onAddBlankPage={handleAddBlankPage}
              />
            )}

            <PDFViewer
              docState={docState}
              currentPageIndex={currentPageIndex}
              onPageChange={setCurrentPageIndex}
              activeConfig={activeConfig}
              selectedAnnotation={selectedAnnotation}
              onSelectAnnotation={setSelectedAnnotation}
              onAddAnnotation={handleAddAnnotation}
              onUpdateAnnotation={handleUpdateAnnotation}
              onDeleteAnnotation={handleDeleteAnnotationById}
              zoom={zoom}
              pendingSignatureData={pendingSignatureData}
              pendingStampData={pendingStampData}
              pendingImageData={pendingImageData}
              onConsumePendingSignature={() => {
                setPendingSignatureData(null);
                setActiveConfig((prev) => ({ ...prev, tool: 'select' }));
              }}
              onConsumePendingStamp={() => {
                setPendingStampData(null);
                setActiveConfig((prev) => ({ ...prev, tool: 'select' }));
              }}
              onConsumePendingImage={() => {
                setPendingImageData(null);
                setActiveConfig((prev) => ({ ...prev, tool: 'select' }));
              }}
              readerFilter={readerFilter}
              searchMatches={searchMatches}
              activeMatchIndex={activeMatchIndex}
              onZoomChange={setZoom}
            />

            {/* Floating Presentation Pill in Fullscreen Mode */}
            {isFullscreen && (
              <div
                className="animate-fade-in"
                style={{
                  position: 'fixed',
                  bottom: '24px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'rgba(15, 23, 42, 0.88)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: 'var(--radius-full)',
                  padding: '6px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  boxShadow: '0 16px 36px -6px rgba(0, 0, 0, 0.6)',
                  zIndex: 2000,
                }}
              >
                <button
                  onClick={() => handlePageNumberJump(Math.max(1, currentDisplayPageNumber - 1))}
                  disabled={currentDisplayPageNumber <= 1}
                  className="btn-icon"
                  style={{ width: '28px', height: '28px', color: '#ffffff' }}
                  data-tooltip="Önceki Sayfa"
                >
                  <ChevronLeft size={16} />
                </button>

                <span style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc', fontFamily: 'JetBrains Mono, monospace' }}>
                  {currentDisplayPageNumber} / {activePages.length}
                </span>

                <button
                  onClick={() => handlePageNumberJump(Math.min(activePages.length, currentDisplayPageNumber + 1))}
                  disabled={currentDisplayPageNumber >= activePages.length}
                  className="btn-icon"
                  style={{ width: '28px', height: '28px', color: '#ffffff' }}
                  data-tooltip="Sonraki Sayfa"
                >
                  <ChevronRight size={16} />
                </button>

                <div style={{ height: '14px', width: '1px', background: 'rgba(255, 255, 255, 0.2)' }} />

                <button
                  onClick={() => setIsFullscreen(false)}
                  className="btn-ghost"
                  style={{ fontSize: '11px', padding: '3px 10px', color: '#f8fafc', gap: '5px' }}
                >
                  <Minimize2 size={13} />
                  <span>Çıkış (Esc)</span>
                </button>
              </div>
            )}
          </div>

          {/* Desktop Status Bar */}
          {!isFullscreen && (
            <Suspense fallback={null}>
              <StatusBar
                currentPage={currentDisplayPageNumber}
                totalPages={activePages.length}
                pageWidth={currentActualPage?.width}
                pageHeight={currentActualPage?.height}
                activeTool={activeConfig.tool}
                isDirty={isDirty}
                zoom={zoom}
                onZoomChange={setZoom}
                onFitPage={handleFitPage}
                onFitWidth={handleFitWidth}
                onOpenProperties={() => setIsDocPropertiesOpen(true)}
                onToggleFullscreen={() => setIsFullscreen((prev) => !prev)}
                isFullscreen={isFullscreen}
              />
            </Suspense>
          )}
        </>
      )}

      {/* 6. Modals (Lazy Loaded on Demand) */}
      <Suspense fallback={null}>
        {isSignatureModalOpen && (
          <SignatureModal
            isOpen={isSignatureModalOpen}
            onClose={() => setIsSignatureModalOpen(false)}
            onApplySignature={(dataUrl) => {
              setPendingSignatureData(dataUrl);
              setActiveConfig((prev) => ({ ...prev, tool: 'signature' }));
            }}
          />
        )}

        {isStampModalOpen && (
          <StampModal
            isOpen={isStampModalOpen}
            onClose={() => setIsStampModalOpen(false)}
            onApplyStamp={(stamp) => {
              setPendingStampData(stamp);
              setActiveConfig((prev) => ({ ...prev, tool: 'stamp' }));
            }}
          />
        )}

        {isOrganizeModalOpen && (
          <PageOrganizeModal
            isOpen={isOrganizeModalOpen}
            onClose={() => setIsOrganizeModalOpen(false)}
            docState={docState}
            onRotatePage={handleRotatePage}
            onRotateAllPages={handleRotateAllPages}
            onDuplicatePage={handleDuplicatePage}
            onDeletePage={handleDeletePage}
            onMovePage={handleMovePage}
          />
        )}

        {isMergeModalOpen && (
          <MergePdfModal
            isOpen={isMergeModalOpen}
            onClose={() => setIsMergeModalOpen(false)}
            onApplyMerged={async (mergedBytes, filename) => {
              const buffer = mergedBytes.buffer.slice(mergedBytes.byteOffset, mergedBytes.byteOffset + mergedBytes.byteLength);
              await parseAndSetPdf(buffer as ArrayBuffer, filename, mergedBytes.byteLength);
            }}
            onShowToast={showToast}
          />
        )}

        {isSplitModalOpen && (
          <SplitPdfModal
            isOpen={isSplitModalOpen}
            onClose={() => setIsSplitModalOpen(false)}
            docState={docState}
            onShowToast={showToast}
          />
        )}

        {isPageNumberingModalOpen && (
          <PageNumberingModal
            isOpen={isPageNumberingModalOpen}
            onClose={() => setIsPageNumberingModalOpen(false)}
            totalPages={activePages.length}
            onApplyPageNumbers={handleApplyPageNumbers}
            pageWidth={currentActualPage?.width}
            pageHeight={currentActualPage?.height}
          />
        )}

        {isCompareModalOpen && (
          <ComparePdfModal
            isOpen={isCompareModalOpen}
            onClose={() => setIsCompareModalOpen(false)}
            primaryDocState={docState}
          />
        )}

        {isOcrModalOpen && (
          <OcrModal
            isOpen={isOcrModalOpen}
            onClose={() => setIsOcrModalOpen(false)}
            docData={docState.data}
            pageNumber={currentActualPage?.originalPageNumber || 1}
            pageIndex={currentActualPage?.pageIndex ?? 0}
            onApplyOcrAnnotations={handleApplyOcrAnnotations}
            onShowToast={showToast}
          />
        )}

        {isWatermarkModalOpen && (
          <WatermarkModal
            isOpen={isWatermarkModalOpen}
            onClose={() => setIsWatermarkModalOpen(false)}
            totalPages={activePages.length}
            currentPageIndex={currentPageIndex}
            onApplyWatermark={handleApplyWatermark}
            pageWidth={currentActualPage?.width}
            pageHeight={currentActualPage?.height}
          />
        )}

        {isExportImageModalOpen && (
          <ExportImageModal
            isOpen={isExportImageModalOpen}
            onClose={() => setIsExportImageModalOpen(false)}
            docState={docState}
            currentPageNumber={currentDisplayPageNumber}
            onShowToast={showToast}
          />
        )}

        {isExportOfficeModalOpen && (
          <ExportOfficeModal
            isOpen={isExportOfficeModalOpen}
            onClose={() => setIsExportOfficeModalOpen(false)}
            docState={docState}
            onShowToast={showToast}
          />
        )}

        {isSecurityModalOpen && (
          <SecurityModal
            isOpen={isSecurityModalOpen}
            onClose={() => setIsSecurityModalOpen(false)}
            docState={docState}
            onShowToast={showToast}
          />
        )}

        {isCompressModalOpen && (
          <CompressModal
            isOpen={isCompressModalOpen}
            onClose={() => setIsCompressModalOpen(false)}
            docState={docState}
            onShowToast={showToast}
          />
        )}

        {isAboutModalOpen && (
          <AboutModal
            isOpen={isAboutModalOpen}
            onClose={() => setIsAboutModalOpen(false)}
          />
        )}

        {isSettingsModalOpen && (
          <SettingsModal
            isOpen={isSettingsModalOpen}
            onClose={() => setIsSettingsModalOpen(false)}
            settings={settings}
            onSaveSettings={handleSaveSettings}
            onClearRecentFiles={handleClearRecentFiles}
          />
        )}

        {isDocPropertiesOpen && (
          <DocPropertiesModal
            isOpen={isDocPropertiesOpen}
            onClose={() => setIsDocPropertiesOpen(false)}
            docState={docState}
            onUpdatePdfData={async (newData) => {
              const buffer = newData.buffer.slice(newData.byteOffset, newData.byteOffset + newData.byteLength);
              await parseAndSetPdf(buffer as ArrayBuffer, docState.filename || 'Belge.pdf', newData.byteLength);
              setIsDirty(true);
            }}
            onShowToast={showToast}
          />
        )}

        {isCommandPaletteOpen && (
          <CommandPalette
            isOpen={isCommandPaletteOpen}
            onClose={() => setIsCommandPaletteOpen(false)}
            onOpenNativePdf={handleOpenNativePdf}
            onSavePdf={handleSavePdf}
            onSaveAsPdf={handleSaveAsPdf}
            onPrint={handlePrint}
            onOpenProperties={() => {
              if (docState.data) setIsDocPropertiesOpen(true);
              else showToast('Önce bir PDF belgesi açmalısınız.', 'info');
            }}
            onSelectTool={(tool) => {
              setActiveConfig((prev) => ({ ...prev, tool }));
              if (tool !== 'select') setSelectedAnnotation(null);
            }}
            onOpenSignatureModal={() => setIsSignatureModalOpen(true)}
            onOpenStampModal={() => setIsStampModalOpen(true)}
            onOpenOcrModal={() => setIsOcrModalOpen(true)}
            onOpenMergeModal={() => setIsMergeModalOpen(true)}
            onOpenSplitModal={() => setIsSplitModalOpen(true)}
            onOpenCompareModal={() => setIsCompareModalOpen(true)}
            onOpenWatermarkModal={() => setIsWatermarkModalOpen(true)}
            onOpenPageNumberingModal={() => setIsPageNumberingModalOpen(true)}
            onOpenExportOfficeModal={() => setIsExportOfficeModalOpen(true)}
            onOpenExportImageModal={() => setIsExportImageModalOpen(true)}
            onOpenCompressModal={() => setIsCompressModalOpen(true)}
            onOpenSecurityModal={() => setIsSecurityModalOpen(true)}
            onOpenOrganizeModal={() => setIsOrganizeModalOpen(true)}
            onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
            onAddBlankPage={handleAddBlankPage}
            onToggleFullscreen={() => setIsFullscreen((prev) => !prev)}
            onFitPage={handleFitPage}
            onFitWidth={handleFitWidth}
            onToggleSearch={() => setIsSearchOpen((prev) => !prev)}
            onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
            onReaderFilterChange={setReaderFilter}
          />
        )}
      </Suspense>
    </div>
  );
}

export default App;
