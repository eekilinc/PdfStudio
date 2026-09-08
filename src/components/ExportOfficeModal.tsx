import React, { useState } from 'react';
import { 
  X, 
  FileText, 
  FileSpreadsheet, 
  Presentation, 
  FileCode, 
  Download, 
  Check, 
  Loader2, 
  Sparkles,
  Layers,
  FileCheck2,
  FolderOpen,
  TableProperties
} from 'lucide-react';
import type { PDFDocumentState } from '../types/pdf';
import { getSharedPdfDoc } from '../utils/pdfInit';
import {
  extractStructuredPage,
  generateDocx,
  generateXlsx,
  generatePptx,
  generateCsv,
  generateMarkdown,
  generateHtml,
  generateTxt,
  type StructuredPage,
} from '../utils/officeExport';

interface ExportOfficeModalProps {
  isOpen: boolean;
  onClose: () => void;
  docState: PDFDocumentState;
  onShowToast?: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export type ExportFormat = 'docx' | 'xlsx' | 'csv' | 'pptx' | 'md' | 'html' | 'txt';
type SaveLocationMode = 'ask' | 'downloads';

export const ExportOfficeModal: React.FC<ExportOfficeModalProps> = ({
  isOpen,
  onClose,
  docState,
  onShowToast,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('docx');
  const [includePageNumbers, setIncludePageNumbers] = useState(true);
  const [multiSheetExcel, setMultiSheetExcel] = useState(false);
  const [csvDelimiter, setCsvDelimiter] = useState<';' | ','>(';');
  const [isExporting, setIsExporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [exportedSuccess, setExportedSuccess] = useState<string | null>(null);
  const [pageRangeMode, setPageRangeMode] = useState<'all' | 'custom'>('all');
  const [customPages, setCustomPages] = useState('1');
  const [saveLocationMode, setSaveLocationMode] = useState<SaveLocationMode>('ask');

  const notify = (text: string, type: 'success' | 'error' | 'info' = 'error') => {
    if (onShowToast) onShowToast(text, type);
    else alert(text);
  };

  if (!isOpen) return null;

  const formats: Array<{
    id: ExportFormat;
    title: string;
    ext: string;
    filterDesc: string;
    filterExt: string;
    badge: string;
    desc: string;
    icon: React.ElementType;
    color: string;
    bg: string;
    isBinary: boolean;
  }> = [
    {
      id: 'docx',
      title: 'Microsoft Word',
      ext: '.docx',
      filterDesc: 'Word Belgesi',
      filterExt: 'docx',
      badge: 'Gerçek OpenXML',
      desc: 'Başlıklar, tablolar, madde listeleri ve sayfa düzenini koruyan gerçek binary .docx belgesi.',
      icon: FileText,
      color: '#2563eb',
      bg: 'rgba(37, 99, 235, 0.15)',
      isBinary: true,
    },
    {
      id: 'xlsx',
      title: 'Microsoft Excel',
      ext: '.xlsx',
      filterDesc: 'Excel Çalışma Kitabı',
      filterExt: 'xlsx',
      badge: 'Çok Sütunlu Tablo',
      desc: 'Akıllı tablo koordinat analizi, sayısal hücre formatı ve sekme desteği içeren gerçek Excel tablosu.',
      icon: FileSpreadsheet,
      color: '#16a34a',
      bg: 'rgba(22, 163, 74, 0.15)',
      isBinary: true,
    },
    {
      id: 'csv',
      title: 'CSV Veri Tablosu',
      ext: '.csv',
      filterDesc: 'CSV Tablosu',
      filterExt: 'csv',
      badge: 'UTF-8 BOM',
      desc: 'Excel, SQL ve veri analitiği yazılımlarıyla %100 uyumlu, sütunlara ayrılmış saf tablo verisi.',
      icon: TableProperties,
      color: '#059669',
      bg: 'rgba(5, 150, 105, 0.15)',
      isBinary: false,
    },
    {
      id: 'pptx',
      title: 'PowerPoint Sunumu',
      ext: '.pptx',
      filterDesc: 'PowerPoint Sunumu',
      filterExt: 'pptx',
      badge: '16:9 Geniş Ekran',
      desc: 'Her PDF sayfasını bağımsız bir sunum slaytına dönüştüren gerçek OpenXML .pptx paketi.',
      icon: Presentation,
      color: '#ea580c',
      bg: 'rgba(234, 88, 12, 0.15)',
      isBinary: true,
    },
    {
      id: 'md',
      title: 'Markdown Dokümanı',
      ext: '.md',
      filterDesc: 'Markdown Belgesi',
      filterExt: 'md',
      badge: 'GitHub / Notion',
      desc: 'Yazılım ve dokümantasyon için başlıklar, listeler ve gerçek Markdown tabloları içeren doküman.',
      icon: FileCode,
      color: '#8b5cf6',
      bg: 'rgba(139, 92, 246, 0.15)',
      isBinary: false,
    },
    {
      id: 'html',
      title: 'HTML Web Sayfası',
      ext: '.html',
      filterDesc: 'HTML Web Sayfası',
      filterExt: 'html',
      badge: 'Responsive Web',
      desc: 'Tarayıcıda anında görüntülenebilir şık, modern, kart tasarımlı ve tablolu bağımsız web dokümanı.',
      icon: Layers,
      color: '#06b6d4',
      bg: 'rgba(6, 182, 212, 0.15)',
      isBinary: false,
    },
    {
      id: 'txt',
      title: 'Düz Metin',
      ext: '.txt',
      filterDesc: 'Metin Dosyası',
      filterExt: 'txt',
      badge: 'Temiz UTF-8',
      desc: 'Tüm metin içeriğini temiz, formatlardan arındırılmış saf metin dosyası olarak kaydeder.',
      icon: FileCheck2,
      color: '#64748b',
      bg: 'rgba(100, 116, 139, 0.15)',
      isBinary: false,
    },
  ];

  const handleExport = async () => {
    if (!docState.data) return;
    setIsExporting(true);
    setExportedSuccess(null);
    setStatusMessage('PDF belgesi yükleniyor...');
    setProgressPercent(10);

    try {
      const pdf = await getSharedPdfDoc(docState.data);
      if (!pdf) throw new Error('PDF yüklenemedi');

      // Determine target pages
      let targetPageIndices: number[] = [];
      const totalPages = pdf.numPages;

      if (pageRangeMode === 'all') {
        targetPageIndices = Array.from({ length: totalPages }, (_, i) => i + 1);
      } else {
        const parts = customPages.split(',').map(s => s.trim());
        const set = new Set<number>();
        for (const p of parts) {
          if (p.includes('-')) {
            const [start, end] = p.split('-').map(Number);
            if (!isNaN(start) && !isNaN(end)) {
              for (let k = Math.max(1, start); k <= Math.min(totalPages, end); k++) {
                set.add(k);
              }
            }
          } else {
            const num = Number(p);
            if (!isNaN(num) && num >= 1 && num <= totalPages) {
              set.add(num);
            }
          }
        }
        targetPageIndices = Array.from(set).sort((a, b) => a - b);
        if (targetPageIndices.length === 0) {
          targetPageIndices = Array.from({ length: totalPages }, (_, i) => i + 1);
        }
      }

      // Extract structured page contents
      const structuredPages: StructuredPage[] = [];

      for (let i = 0; i < targetPageIndices.length; i++) {
        const pageNum = targetPageIndices[i];
        setStatusMessage(`Sayfa ${pageNum} / ${totalPages} taranıyor ve yapı ayrıştırılıyor...`);
        const pct = Math.round(15 + ((i + 1) / targetPageIndices.length) * 55);
        setProgressPercent(pct);

        const page = await pdf.getPage(pageNum);
        const structured = await extractStructuredPage(page, pageNum);
        structuredPages.push(structured);
      }

      setStatusMessage('Belge formatlanıyor ve derleniyor...');
      setProgressPercent(75);

      const baseName = docState.filename.replace(/\.pdf$/i, '') || 'Belge';
      const currentFmt = formats.find(f => f.id === selectedFormat)!;

      let binaryData: Uint8Array | null = null;
      let textData: string | null = null;
      let defaultFileName = '';
      let mimeType = '';

      if (selectedFormat === 'docx') {
        defaultFileName = `${baseName}.docx`;
        mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        binaryData = await generateDocx(structuredPages, {
          docTitle: baseName,
          includePageNumbers,
        });
      } else if (selectedFormat === 'xlsx') {
        defaultFileName = `${baseName}.xlsx`;
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        binaryData = await generateXlsx(structuredPages, {
          docTitle: baseName,
          includePageNumbers,
          multiSheetExcel,
        });
      } else if (selectedFormat === 'csv') {
        defaultFileName = `${baseName}.csv`;
        mimeType = 'text/csv;charset=utf-8;';
        textData = generateCsv(structuredPages, {
          includePageNumbers,
          csvDelimiter,
        });
      } else if (selectedFormat === 'pptx') {
        defaultFileName = `${baseName}.pptx`;
        mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
        binaryData = await generatePptx(structuredPages, {
          docTitle: baseName,
          includePageNumbers,
        });
      } else if (selectedFormat === 'md') {
        defaultFileName = `${baseName}.md`;
        mimeType = 'text/markdown;charset=utf-8;';
        textData = generateMarkdown(structuredPages, {
          docTitle: baseName,
          includePageNumbers,
        });
      } else if (selectedFormat === 'html') {
        defaultFileName = `${baseName}.html`;
        mimeType = 'text/html;charset=utf-8;';
        textData = generateHtml(structuredPages, {
          docTitle: baseName,
        });
      } else if (selectedFormat === 'txt') {
        defaultFileName = `${baseName}.txt`;
        mimeType = 'text/plain;charset=utf-8;';
        textData = generateTxt(structuredPages, {
          docTitle: baseName,
          includePageNumbers,
        });
      }

      setStatusMessage('Dosya kaydediliyor...');
      setProgressPercent(90);

      // Handle Save Location
      if (saveLocationMode === 'ask') {
        let savedPath: string | null = null;
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          const targetPath = await invoke<string | null>('pick_save_custom_file', {
            defaultName: defaultFileName,
            filterDesc: currentFmt.filterDesc,
            filterExt: currentFmt.filterExt,
          });

          if (targetPath) {
            if (binaryData) {
              await invoke('write_pdf_file', {
                path: targetPath,
                contents: Array.from(binaryData),
              });
            } else if (textData) {
              await invoke('write_text_file', {
                path: targetPath,
                contents: textData,
              });
            }
            savedPath = targetPath;
          } else {
            // User cancelled save dialog
            setIsExporting(false);
            return;
          }
        } catch {
          // Tauri not available or fallback to browser download
          if (binaryData) {
            const blob = new Blob([binaryData as unknown as BlobPart], { type: mimeType });
            triggerDownload(blob, defaultFileName);
          } else if (textData) {
            const blob = new Blob([textData], { type: mimeType });
            triggerDownload(blob, defaultFileName);
          }
          savedPath = defaultFileName;
        }
        notify(`Dosya başarıyla aktarıldı: ${savedPath}`, 'success');
        setExportedSuccess(`Başarıyla kaydedildi: ${savedPath}`);
      } else {
        // Direct Download to Downloads Folder
        if (binaryData) {
          const blob = new Blob([binaryData as unknown as BlobPart], { type: mimeType });
          triggerDownload(blob, defaultFileName);
        } else if (textData) {
          const blob = new Blob([textData], { type: mimeType });
          triggerDownload(blob, defaultFileName);
        }
        notify(`İndirilenler klasörüne kaydedildi: ${defaultFileName}`, 'success');
        setExportedSuccess(`İndirilenler klasörüne aktarıldı: ${defaultFileName}`);
      }

      setProgressPercent(100);
      setStatusMessage('Tamamlandı!');

      setTimeout(() => {
        setIsExporting(false);
      }, 500);
    } catch (err) {
      console.error('Export failed:', err);
      notify('Dışa aktarma sırasında bir hata oluştu.', 'error');
      setIsExporting(false);
    }
  };

  const triggerDownload = (blob: Blob, filename: string) => {
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
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel animate-scale-up"
        style={{
          width: '740px',
          maxWidth: '95vw',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-xl)',
          border: '1px solid var(--border-color)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-secondary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
              }}
            >
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Ofis & Format Dışa Aktarma Merkezi
              </h2>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                PDF belgenizi Word (.docx), Excel (.xlsx), PowerPoint (.pptx) ve diğer formatlara tam olarak dönüştürün
              </div>
            </div>
          </div>

          <button onClick={onClose} className="btn-icon" style={{ width: '28px', height: '28px' }}>
            <X size={16} />
          </button>
        </div>

        {/* BODY */}
        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* FORMAT SELECTION GRID */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px', display: 'block' }}>
              Dışa Aktarılacak Formatı Seçin:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '10px' }}>
              {formats.map((fmt) => {
                const isSelected = selectedFormat === fmt.id;
                const IconComponent = fmt.icon;
                return (
                  <div
                    key={fmt.id}
                    onClick={() => setSelectedFormat(fmt.id)}
                    style={{
                      padding: '12px',
                      borderRadius: 'var(--radius-md)',
                      border: isSelected ? `2px solid ${fmt.color}` : '1px solid var(--border-color)',
                      background: isSelected ? fmt.bg : 'var(--bg-tertiary)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      position: 'relative',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: fmt.color, color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <IconComponent size={15} />
                        </div>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {fmt.title}
                          </div>
                          <div style={{ fontSize: '10px', fontWeight: 600, color: fmt.color }}>
                            {fmt.badge}
                          </div>
                        </div>
                      </div>
                      {isSelected && <Check size={16} color={fmt.color} />}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.35, marginTop: '2px' }}>
                      {fmt.desc}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* FORMAT-SPECIFIC ADVANCED OPTIONS */}
          {selectedFormat === 'xlsx' && (
            <div style={{ background: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(22, 163, 74, 0.3)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#16a34a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileSpreadsheet size={15} />
                <span>Excel (.xlsx) Yapılandırması</span>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', color: 'var(--text-primary)' }}>
                <input
                  type="checkbox"
                  checked={multiSheetExcel}
                  onChange={(e) => setMultiSheetExcel(e.target.checked)}
                />
                <span>Her PDF sayfası için ayrı bir Excel sekmesi (Çalışma Sayfası) oluştur</span>
              </label>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {multiSheetExcel
                  ? 'Her sayfa "Sayfa 1", "Sayfa 2" adlarıyla bağımsız sekmelerde saklanır.'
                  : 'Tüm PDF sayfaları tek bir ana Excel tablosunda birleştirilir.'}
              </div>
            </div>
          )}

          {selectedFormat === 'csv' && (
            <div style={{ background: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(5, 150, 105, 0.3)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#059669', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <TableProperties size={15} />
                <span>CSV Ayraç Karakteri</span>
              </div>
              <div style={{ display: 'flex', gap: '16px', fontSize: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: 'var(--text-primary)' }}>
                  <input
                    type="radio"
                    name="csvDelim"
                    checked={csvDelimiter === ';'}
                    onChange={() => setCsvDelimiter(';')}
                  />
                  <span>Noktalı Virgül ( ; ) - Türkçe Excel için Önerilen</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: 'var(--text-primary)' }}>
                  <input
                    type="radio"
                    name="csvDelim"
                    checked={csvDelimiter === ','}
                    onChange={() => setCsvDelimiter(',')}
                  />
                  <span>Virgül ( , ) - Standart Uluslararası</span>
                </label>
              </div>
            </div>
          )}

          {/* SAVE DESTINATION / LOCATION PREFERENCE */}
          <div style={{ background: 'var(--bg-secondary)', padding: '14px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FolderOpen size={15} color="var(--accent-primary)" />
              <span>Kayıt Konumu Tercihi</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: saveLocationMode === 'ask' ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                  background: saveLocationMode === 'ask' ? 'rgba(56, 189, 248, 0.08)' : 'var(--bg-tertiary)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="saveLocationMode"
                  checked={saveLocationMode === 'ask'}
                  onChange={() => setSaveLocationMode('ask')}
                  style={{ marginTop: '2px' }}
                />
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Her Seferinde Konum Sor (Önerilen)
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Farklı Kaydet penceresi açılır, istediğiniz klasörü seçersiniz.
                  </div>
                </div>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: saveLocationMode === 'downloads' ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                  background: saveLocationMode === 'downloads' ? 'rgba(56, 189, 248, 0.08)' : 'var(--bg-tertiary)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="saveLocationMode"
                  checked={saveLocationMode === 'downloads'}
                  onChange={() => setSaveLocationMode('downloads')}
                  style={{ marginTop: '2px' }}
                />
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Doğrudan İndirilenler'e Kaydet
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Soru sormadan standart Downloads klasörüne kaydeder.
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* EXPORT OPTIONS */}
          <div style={{ background: 'var(--bg-secondary)', padding: '14px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Sayfa Aralığı ve Biçimlendirme
            </div>

            {/* Page Range Selection */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', fontSize: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: 'var(--text-primary)' }}>
                  <input
                    type="radio"
                    name="pageRange"
                    checked={pageRangeMode === 'all'}
                    onChange={() => setPageRangeMode('all')}
                  />
                  <span>Tüm Sayfalar ({docState.numPages} Sayfa)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: 'var(--text-primary)' }}>
                  <input
                    type="radio"
                    name="pageRange"
                    checked={pageRangeMode === 'custom'}
                    onChange={() => setPageRangeMode('custom')}
                  />
                  <span>Belirli Sayfalar</span>
                </label>
              </div>

              {pageRangeMode === 'custom' && (
                <input
                  type="text"
                  value={customPages}
                  onChange={(e) => setCustomPages(e.target.value)}
                  placeholder="Örn: 1-3, 5, 8"
                  style={{
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    width: '200px',
                  }}
                />
              )}
            </div>

            {/* Include Page Numbers */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', color: 'var(--text-primary)' }}>
              <input
                type="checkbox"
                checked={includePageNumbers}
                onChange={(e) => setIncludePageNumbers(e.target.checked)}
              />
              <span>Sayfa numaralarını ve başlıklarını belgede göster</span>
            </label>
          </div>

          {/* PROGRESS INDICATOR */}
          {isExporting && (
            <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)', padding: '12px 16px', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-primary)', fontWeight: 600 }}>
                <span>{statusMessage || 'İşleniyor...'}</span>
                <span>%{progressPercent}</span>
              </div>
              <div style={{ width: '100%', height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${progressPercent}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #38bdf8, #2563eb)',
                    transition: 'width 0.2s ease',
                  }}
                />
              </div>
            </div>
          )}

          {/* NOTIFICATION FEEDBACK */}
          {exportedSuccess && (
            <div
              style={{
                padding: '10px 14px',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: 'var(--radius-md)',
                color: '#10b981',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Check size={16} />
              <span>{exportedSuccess}</span>
            </div>
          )}

          {/* PRIVACY BADGE */}
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={13} color="var(--accent-primary)" />
            <span>Tüm dönüştürme ve formatlama işlemleri %100 yerel cihazınızda çevrimdışı olarak gerçekleştirilir.</span>
          </div>

        </div>

        {/* FOOTER */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-secondary)',
          }}
        >
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Seçilen: <strong>{formats.find(f => f.id === selectedFormat)?.title}</strong> ({formats.find(f => f.id === selectedFormat)?.ext})
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button onClick={onClose} className="btn-ghost" style={{ fontSize: '13px' }}>
              Kapat
            </button>

            <button
              onClick={handleExport}
              disabled={isExporting}
              className="btn-primary"
              style={{
                fontSize: '13px',
                padding: '8px 22px',
                gap: '8px',
                fontWeight: 600,
                background: exportedSuccess ? '#059669' : undefined,
              }}
            >
              {isExporting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Dönüştürülüyor...</span>
                </>
              ) : (
                <>
                  <Download size={16} />
                  <span>Dönüştür & Kaydet</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
