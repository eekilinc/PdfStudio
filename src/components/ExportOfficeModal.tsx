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
  FolderOpen
} from 'lucide-react';
import type { PDFDocumentState } from '../types/pdf';
import { getSharedPdfDoc } from '../utils/pdfInit';

interface ExportOfficeModalProps {
  isOpen: boolean;
  onClose: () => void;
  docState: PDFDocumentState;
  onShowToast?: (text: string, type?: 'success' | 'error' | 'info') => void;
}

type ExportFormat = 'docx' | 'xlsx' | 'pptx' | 'txt' | 'md' | 'html';
type SaveLocationMode = 'ask' | 'downloads';

export const ExportOfficeModal: React.FC<ExportOfficeModalProps> = ({
  isOpen,
  onClose,
  docState,
  onShowToast,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('docx');
  const [includePageNumbers, setIncludePageNumbers] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportedSuccess, setExportedSuccess] = useState<string | null>(null);

  const notify = (text: string, type: 'success' | 'error' | 'info' = 'error') => {
    if (onShowToast) onShowToast(text, type);
    else alert(text);
  };
  const [pageRangeMode, setPageRangeMode] = useState<'all' | 'custom'>('all');
  const [customPages, setCustomPages] = useState('1');
  const [saveLocationMode, setSaveLocationMode] = useState<SaveLocationMode>('ask');

  if (!isOpen) return null;

  const formats: Array<{
    id: ExportFormat;
    title: string;
    ext: string;
    filterDesc: string;
    filterExt: string;
    desc: string;
    icon: React.ElementType;
    color: string;
    bg: string;
  }> = [
    {
      id: 'docx',
      title: 'Microsoft Word',
      ext: '.doc / .docx',
      filterDesc: 'Word Belgesi',
      filterExt: 'doc',
      desc: 'Başlıklar, paragraflar ve sayfa düzenini koruyarak düzenlenebilir Word belgesine dönüştürür.',
      icon: FileText,
      color: '#2563eb',
      bg: 'rgba(37, 99, 235, 0.15)',
    },
    {
      id: 'xlsx',
      title: 'Microsoft Excel / CSV',
      ext: '.csv / .xlsx',
      filterDesc: 'Excel / CSV Tablosu',
      filterExt: 'csv',
      desc: 'Belgedeki tablo, sayısal ve liste verilerini satır/sütun tablosu halinde dışa aktarır.',
      icon: FileSpreadsheet,
      color: '#16a34a',
      bg: 'rgba(22, 163, 74, 0.15)',
    },
    {
      id: 'pptx',
      title: 'PowerPoint Sunumu',
      ext: '.html / .pptx',
      filterDesc: 'Sunum Dosyası',
      filterExt: 'html',
      desc: 'Her PDF sayfasını bağımsız bir sunum slaytına ve görsel sunum formatına dönüştürür.',
      icon: Presentation,
      color: '#ea580c',
      bg: 'rgba(234, 88, 12, 0.15)',
    },
    {
      id: 'txt',
      title: 'Düz Metin (UTF-8)',
      ext: '.txt',
      filterDesc: 'Metin Dosyası',
      filterExt: 'txt',
      desc: 'Tüm metin içeriğini temiz, formatlardan arındırılmış saf metin dosyası olarak kaydeder.',
      icon: FileCheck2,
      color: '#64748b',
      bg: 'rgba(100, 116, 139, 0.15)',
    },
    {
      id: 'md',
      title: 'Markdown Belgesi',
      ext: '.md',
      filterDesc: 'Markdown Belgesi',
      filterExt: 'md',
      desc: 'Yazılım ve dokümantasyon için başlık ve listeleri Markdown formatında hazırlar.',
      icon: FileCode,
      color: '#8b5cf6',
      bg: 'rgba(139, 92, 246, 0.15)',
    },
    {
      id: 'html',
      title: 'HTML Web Sayfası',
      ext: '.html',
      filterDesc: 'HTML Web Sayfası',
      filterExt: 'html',
      desc: 'Tarayıcıda anında görüntülenebilir şık, modern bir web sayfası oluşturur.',
      icon: Layers,
      color: '#06b6d4',
      bg: 'rgba(6, 182, 212, 0.15)',
    },
  ];

  const handleExport = async () => {
    if (!docState.data) return;
    setIsExporting(true);
    setExportedSuccess(null);

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

      // Extract text content from pages
      const extractedPages: Array<{ pageNum: number; lines: string[] }> = [];

      for (const pageNum of targetPageIndices) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const items = textContent.items as Array<{ str: string; transform: number[] }>;

        const sorted = [...items]
          .filter(it => it.str && it.str.trim().length > 0)
          .sort((a, b) => {
            const yDiff = b.transform[5] - a.transform[5];
            if (Math.abs(yDiff) > 6) return yDiff;
            return a.transform[4] - b.transform[4];
          });

        const lines: string[] = [];
        let curLine: string[] = [];
        let lastY: number | null = null;

        sorted.forEach(it => {
          const y = it.transform[5];
          if (lastY === null || Math.abs(lastY - y) <= 6) {
            curLine.push(it.str);
          } else {
            if (curLine.length > 0) lines.push(curLine.join(' '));
            curLine = [it.str];
          }
          lastY = y;
        });
        if (curLine.length > 0) lines.push(curLine.join(' '));

        extractedPages.push({ pageNum, lines });
      }

      const baseName = docState.filename.replace(/\.pdf$/i, '') || 'Belge';
      const currentFmt = formats.find(f => f.id === selectedFormat)!;
      let outputContent = '';
      let defaultFileName = '';
      let mimeType = 'text/plain;charset=utf-8';

      // 1. WORD (.doc / .docx)
      if (selectedFormat === 'docx') {
        defaultFileName = `${baseName}.doc`;
        mimeType = 'application/msword;charset=utf-8';
        let bodyHtml = '';
        extractedPages.forEach((p, idx) => {
          if (includePageNumbers) {
            bodyHtml += `<div class="page-header">PDF Studio Pro &bull; Sayfa ${p.pageNum} / ${totalPages}</div>`;
          }
          p.lines.forEach((line) => {
            if (line.length < 50 && (line.toUpperCase() === line || /^\d+\./.test(line))) {
              bodyHtml += `<h2>${escapeHtml(line)}</h2>`;
            } else {
              bodyHtml += `<p>${escapeHtml(line)}</p>`;
            }
          });
          if (idx < extractedPages.length - 1) {
            bodyHtml += `<div class="page-break"></div><br/>`;
          }
        });

        outputContent = `\uFEFF
          <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
          <head>
            <meta charset='utf-8'>
            <title>${escapeHtml(baseName)}</title>
            <style>
              body { font-family: 'Calibri', 'Arial', sans-serif; font-size: 11pt; line-height: 1.5; color: #0f172a; margin: 30pt; }
              h1 { font-size: 18pt; color: #1e3a8a; margin-top: 16pt; margin-bottom: 6pt; font-weight: bold; }
              h2 { font-size: 13pt; color: #1e40af; margin-top: 12pt; margin-bottom: 4pt; font-weight: bold; }
              p { margin-top: 0; margin-bottom: 6pt; text-align: justify; }
              .page-break { page-break-after: always; }
              .page-header { font-size: 9pt; color: #64748b; border-bottom: 1px solid #cbd5e1; padding-bottom: 4pt; margin-bottom: 12pt; }
            </style>
          </head>
          <body>
            <h1>${escapeHtml(baseName)}</h1>
            <hr style="border: 0; height: 1px; background: #e2e8f0; margin-bottom: 14pt;" />
            ${bodyHtml}
          </body>
          </html>
        `;
      }

      // 2. EXCEL (.csv with UTF-8 BOM)
      else if (selectedFormat === 'xlsx') {
        defaultFileName = `${baseName}_Tablo.csv`;
        mimeType = 'text/csv;charset=utf-8;';
        let csv = '\uFEFFSayfa;Satır No;İçerik;Metin Parçaları\n';
        extractedPages.forEach((p) => {
          p.lines.forEach((line, lineIdx) => {
            const sanitized = line.replace(/"/g, '""');
            csv += `"${p.pageNum}";"${lineIdx + 1}";"${sanitized}";"${sanitized.split(' ').slice(0, 3).join(' ')}"\n`;
          });
        });
        outputContent = csv;
      }

      // 3. POWERPOINT (.html presentation slides)
      else if (selectedFormat === 'pptx') {
        defaultFileName = `${baseName}_Sunum.html`;
        mimeType = 'text/html;charset=utf-8';
        let slidesHtml = '';
        extractedPages.forEach((p) => {
          const title = p.lines[0] || `Slayt ${p.pageNum}`;
          const bodyBullets = p.lines.slice(1).map(l => `<li>${escapeHtml(l)}</li>`).join('');

          slidesHtml += `
            <div class="slide">
              <div class="slide-header">
                <h2>${escapeHtml(title)}</h2>
                <span class="slide-number">#${p.pageNum}</span>
              </div>
              <ul class="slide-body">
                ${bodyBullets || '<li>İçerik bulunamadı</li>'}
              </ul>
              <div class="slide-footer">PDF Studio Pro Sunum Dışa Aktarımı</div>
            </div>
          `;
        });

        outputContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>${escapeHtml(baseName)} - Sunum</title>
            <style>
              body { font-family: 'Inter', -apple-system, sans-serif; background: #0f172a; color: #f8fafc; padding: 40px 20px; display: flex; flex-direction: column; align-items: center; gap: 30px; }
              .slide { width: 800px; min-height: 450px; background: #1e293b; border-radius: 12px; padding: 40px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); border: 1px solid #334155; position: relative; display: flex; flex-direction: column; }
              .slide-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #38bdf8; padding-bottom: 12px; margin-bottom: 20px; }
              .slide-header h2 { margin: 0; font-size: 22px; color: #38bdf8; font-weight: 700; }
              .slide-number { font-size: 12px; background: #38bdf8; color: #0f172a; padding: 2px 8px; border-radius: 6px; font-weight: bold; }
              .slide-body { font-size: 15px; line-height: 1.7; color: #e2e8f0; flex: 1; padding-left: 20px; }
              .slide-body li { margin-bottom: 10px; }
              .slide-footer { font-size: 11px; color: #64748b; border-top: 1px solid #334155; padding-top: 10px; margin-top: 20px; }
              @media print { body { background: none; } .slide { page-break-after: always; box-shadow: none; border: 1px solid #ccc; color: #000; background: #fff; } }
            </style>
          </head>
          <body>
            ${slidesHtml}
          </body>
          </html>
        `;
      }

      // 4. PLAIN TEXT (.txt)
      else if (selectedFormat === 'txt') {
        defaultFileName = `${baseName}.txt`;
        mimeType = 'text/plain;charset=utf-8';
        let txt = `============================================================\n`;
        txt += `PDF STUDIO PRO - METİN DIŞA AKTARIMI\n`;
        txt += `Belge: ${baseName}.pdf | Toplam Sayfa: ${totalPages}\n`;
        txt += `Tarih: ${new Date().toLocaleString('tr-TR')}\n`;
        txt += `============================================================\n\n`;

        extractedPages.forEach((p) => {
          if (includePageNumbers) {
            txt += `\n--- SAYFA ${p.pageNum} ---\n\n`;
          }
          txt += p.lines.join('\n') + '\n';
        });
        outputContent = '\uFEFF' + txt;
      }

      // 5. MARKDOWN (.md)
      else if (selectedFormat === 'md') {
        defaultFileName = `${baseName}.md`;
        mimeType = 'text/markdown;charset=utf-8';
        let md = `# ${baseName}\n\n`;
        extractedPages.forEach((p) => {
          if (includePageNumbers) {
            md += `\n## Sayfa ${p.pageNum}\n\n`;
          }
          p.lines.forEach((l) => {
            if (l.length < 40 && (l.toUpperCase() === l || /^\d+\./.test(l))) {
              md += `### ${l}\n\n`;
            } else {
              md += `${l}\n\n`;
            }
          });
          md += `---\n`;
        });
        outputContent = md;
      }

      // 6. HTML WEB PAGE (.html)
      else if (selectedFormat === 'html') {
        defaultFileName = `${baseName}.html`;
        mimeType = 'text/html;charset=utf-8';
        let htmlBody = '';
        extractedPages.forEach((p) => {
          htmlBody += `<section class="page-card"><div class="page-badge">Sayfa ${p.pageNum}</div>`;
          p.lines.forEach((l) => {
            htmlBody += `<p>${escapeHtml(l)}</p>`;
          });
          htmlBody += `</section>`;
        });

        outputContent = `
          <!DOCTYPE html>
          <html lang="tr">
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${escapeHtml(baseName)}</title>
            <style>
              body { font-family: 'Inter', system-ui, sans-serif; background: #f8fafc; color: #1e293b; max-width: 860px; margin: 0 auto; padding: 40px 20px; line-height: 1.6; }
              h1 { font-size: 26px; color: #0f172a; margin-bottom: 24px; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; }
              .page-card { background: #ffffff; border-radius: 12px; padding: 30px; margin-bottom: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; position: relative; }
              .page-badge { position: absolute; top: 16px; right: 16px; background: #e0f2fe; color: #0284c7; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px; }
              p { margin: 0 0 10px 0; }
            </style>
          </head>
          <body>
            <h1>${escapeHtml(baseName)}</h1>
            ${htmlBody}
          </body>
          </html>
        `;
      }

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
            await invoke('write_text_file', {
              path: targetPath,
              contents: outputContent,
            });
            savedPath = targetPath;
          } else {
            // User cancelled save dialog
            setIsExporting(false);
            return;
          }
        } catch {
          // Tauri not available or error, fallback to browser download
          const blob = new Blob([outputContent], { type: mimeType });
          triggerDownload(blob, defaultFileName);
          savedPath = defaultFileName;
        }
        setExportedSuccess(savedPath ? `Dosya başarıyla kaydedildi: ${savedPath}` : 'Dışa aktarıldı!');
      } else {
        // Direct Download (Downloads Folder)
        const blob = new Blob([outputContent], { type: mimeType });
        triggerDownload(blob, defaultFileName);
        setExportedSuccess(`İndirilenler klasörüne kaydedildi: ${defaultFileName}`);
      }

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

  const escapeHtml = (str: string) => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
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
          width: '700px',
          maxWidth: '95vw',
          maxHeight: '90vh',
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
                width: '36px',
                height: '36px',
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
                PDF belgenizi Word, Excel, PowerPoint ve diğer formatlara dönüştürün
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
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
                        <div style={{ width: '26px', height: '26px', borderRadius: '6px', background: fmt.color, color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <IconComponent size={14} />
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {fmt.title}
                        </span>
                      </div>
                      {isSelected && <Check size={16} color={fmt.color} />}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.35 }}>
                      {fmt.desc}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

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
              Dönüştürme Seçenekleri
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
