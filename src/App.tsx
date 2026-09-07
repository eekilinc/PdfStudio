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

// Lazy-loaded modals to optimize initial bundle size & load on demand
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
    } catch (err) {
      console.error('PDF parsing error:', err);
      alert('PDF dosyası açılırken bir hata oluştu.');
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
      alert('Dosya açılamadı veya taşınmış olabilir: ' + path);
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
        showToast('✓ PDF İndirildi', 'success');
      }
    } catch (err) {
      console.error('Save As error:', err);
      alert('PDF kaydedilirken bir hata oluştu: ' + (err as Error).message);
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
    handleUndo,
    handleRedo,
    handleSavePdf,
    handleSaveAsPdf,
    handleOpenNativePdf,
    handleDeleteSelectedAnnotation,
    selectedAnnotation,
  });

  useEffect(() => {
    actionsRef.current = {
      handleUndo,
      handleRedo,
      handleSavePdf,
      handleSaveAsPdf,
      handleOpenNativePdf,
      handleDeleteSelectedAnnotation,
      selectedAnnotation,
    };
  });

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const act = actionsRef.current;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        act.handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault();
        act.handleRedo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (e.shiftKey) {
          act.handleSaveAsPdf();
        } else {
          act.handleSavePdf();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        act.handleOpenNativePdf();
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && act.selectedAnnotation && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        act.handleDeleteSelectedAnnotation();
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

  const activePages = docState.pageOrder
    .map(idx => docState.pages.find(p => p.pageIndex === idx))
    .filter((p): p is PageState => p !== undefined && !p.isDeleted);
  
  const currentActualPageOrderIndex = activePages.findIndex(p => p.pageIndex === currentPageIndex);
  const currentDisplayPageNumber = currentActualPageOrderIndex !== -1 ? currentActualPageOrderIndex + 1 : 1;
  const currentActualPage = activePages.find(p => p.pageIndex === currentPageIndex) || activePages[0];

  return (
    <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      {/* Floating Action Toast Notification */}
      {toast && (
        <div
          className="animate-fade-in"
          style={{
            position: 'fixed',
            top: '56px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: toast.type === 'success' ? '#059669' : toast.type === 'error' ? '#ef4444' : '#2563eb',
            color: '#ffffff',
            padding: '7px 18px',
            borderRadius: 'var(--radius-full)',
            fontSize: '12px',
            fontWeight: 600,
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            pointerEvents: 'none',
          }}
        >
          <span>{toast.text}</span>
        </div>
      )}

      {/* 1. Top Header */}
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
        onFitWidth={() => setZoom(1.25)}
        onFitPage={() => setZoom(0.85)}
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
      />

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
          {/* Main Tool Palette */}
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

          {/* Dynamic Property Inspector */}
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

          {/* Search Bar Overlay */}
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

          {/* Central Workspace Area (Sidebar + Canvas Viewer) */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
            {sidebarOpen && (
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
          </div>
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
          />
        )}

        {isSplitModalOpen && (
          <SplitPdfModal
            isOpen={isSplitModalOpen}
            onClose={() => setIsSplitModalOpen(false)}
            docState={docState}
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
          />
        )}

        {isExportOfficeModalOpen && (
          <ExportOfficeModal
            isOpen={isExportOfficeModalOpen}
            onClose={() => setIsExportOfficeModalOpen(false)}
            docState={docState}
          />
        )}

        {isSecurityModalOpen && (
          <SecurityModal
            isOpen={isSecurityModalOpen}
            onClose={() => setIsSecurityModalOpen(false)}
            docState={docState}
          />
        )}

        {isCompressModalOpen && (
          <CompressModal
            isOpen={isCompressModalOpen}
            onClose={() => setIsCompressModalOpen(false)}
            docState={docState}
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
      </Suspense>
    </div>
  );
}

export default App;
