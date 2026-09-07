import React, { useRef, useState } from 'react';
import { 
  FolderOpen, 
  FilePlus, 
  Sparkles, 
  Layers, 
  Scissors, 
  Clock, 
  ShieldCheck, 
  Zap, 
  FileText, 
  Trash2,
  UploadCloud,
  ChevronRight
} from 'lucide-react';
import { APP_VERSION } from '../version';

export interface RecentFile {
  name: string;
  path: string;
  lastOpened: number;
}

interface WelcomeScreenProps {
  onOpenPdfFile: (file: File) => void;
  onOpenNativePdf?: () => void;
  onOpenRecentFile?: (path: string) => void;
  onCreateBlankPdf: () => void;
  onLoadSample: () => void;
  onOpenMergeModal: () => void;
  onOpenSplitModal: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onOpenPdfFile,
  onOpenNativePdf,
  onOpenRecentFile,
  onCreateBlankPdf,
  onLoadSample,
  onOpenMergeModal,
  onOpenSplitModal,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>(() => {
    try {
      const stored = localStorage.getItem('pdfstudio_recent_files');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const handleClearRecent = (e: React.MouseEvent) => {
    e.stopPropagation();
    localStorage.removeItem('pdfstudio_recent_files');
    setRecentFiles([]);
  };

  const handleRemoveRecentItem = (e: React.MouseEvent, pathToRemove: string) => {
    e.stopPropagation();
    const updated = recentFiles.filter(f => f.path !== pathToRemove);
    setRecentFiles(updated);
    localStorage.setItem('pdfstudio_recent_files', JSON.stringify(updated));
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onOpenPdfFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.toLowerCase().endsWith('.pdf')) {
        onOpenPdfFile(file);
      }
    }
  };

  return (
    <div 
      className="animate-fade-in"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 20px',
        overflowY: 'auto',
        background: 'radial-gradient(circle at 50% 20%, rgba(56, 189, 248, 0.06), transparent 70%), var(--bg-primary)',
      }}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileInput} 
        accept="application/pdf" 
        style={{ display: 'none' }} 
      />

      <div style={{ maxWidth: '820px', width: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* HERO TITLE & BRANDING */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #e11d48, #be123c)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 12px 30px -6px rgba(225, 29, 72, 0.45)',
            position: 'relative',
          }}>
            <FileText size={34} color="#ffffff" />
            <div style={{
              position: 'absolute',
              bottom: '-4px',
              right: '-4px',
              background: '#f59e0b',
              color: '#ffffff',
              fontSize: '10px',
              fontWeight: 800,
              padding: '2px 5px',
              borderRadius: '6px',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3)',
            }}>
              PRO
            </div>
          </div>

          <div>
            <h1 style={{ 
              fontSize: '26px', 
              fontWeight: 800, 
              color: 'var(--text-primary)', 
              letterSpacing: '-0.5px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}>
              <span>PDF Studio Pro</span>
              <span style={{ fontSize: '11px', background: 'rgba(56, 189, 248, 0.15)', color: 'var(--accent-primary)', padding: '2px 7px', borderRadius: '6px', fontWeight: 600 }}>v{APP_VERSION}</span>
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Hızlı, Güvenli ve %100 Çevrimdışı Modern Masaüstü PDF Düzenleyici
            </p>
          </div>
        </div>

        {/* DRAG & DROP CENTRAL AREA */}
        <div 
          onClick={onOpenNativePdf || (() => fileInputRef.current?.click())}
          style={{
            background: isDragOver ? 'rgba(56, 189, 248, 0.12)' : 'var(--bg-secondary)',
            border: isDragOver ? '2px dashed var(--accent-primary)' : '2px dashed var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            padding: '36px 24px',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: 'var(--shadow-md)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
          }}
          className="welcome-dropzone"
        >
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            background: 'var(--bg-tertiary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-primary)',
          }}>
            <UploadCloud size={28} />
          </div>

          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
              PDF Dosyası Açmak İçin Tıklayın
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>
              veya dosyayı doğrudan bu alana sürükleyip bırakın (Drag & Drop)
            </div>
          </div>

          <button 
            className="btn-primary"
            style={{ fontSize: '13px', padding: '7px 20px', marginTop: '4px', gap: '7px', fontWeight: 600 }}
            onClick={(e) => {
              e.stopPropagation();
              if (onOpenNativePdf) onOpenNativePdf();
              else fileInputRef.current?.click();
            }}
          >
            <FolderOpen size={16} />
            <span>Dosya Seç</span>
          </button>
        </div>

        {/* QUICK ACTIONS GRID (4 Cards) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          
          {/* Card 1: New Blank Document */}
          <div 
            onClick={onCreateBlankPdf}
            className="welcome-card glass-panel"
            style={{
              padding: '14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FilePlus size={16} />
              </div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Yeni Boş Belge
              </div>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Temiz bir A4 sayfası oluşturup hemen çizmeye & yazmaya başlayın.
            </div>
          </div>

          {/* Card 2: Sample Template */}
          <div 
            onClick={onLoadSample}
            className="welcome-card glass-panel"
            style={{
              padding: '14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={16} />
              </div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Örnek Şablon
              </div>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              İnteraktif sözleşme şablonuyla tüm özellikleri anında deneyin.
            </div>
          </div>

          {/* Card 3: Merge PDFs */}
          <div 
            onClick={onOpenMergeModal}
            className="welcome-card glass-panel"
            style={{
              padding: '14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Layers size={16} />
              </div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                PDF Birleştir
              </div>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Birden fazla PDF belgesini tek bir dosyada birleştirin.
            </div>
          </div>

          {/* Card 4: Split PDF */}
          <div 
            onClick={onOpenSplitModal}
            className="welcome-card glass-panel"
            style={{
              padding: '14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Scissors size={16} />
              </div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                PDF Ayır
              </div>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Sayfaları ayrı dosyalara veya aralıklara bölün.
            </div>
          </div>

        </div>

        {/* RECENT FILES LIST */}
        {recentFiles.length > 0 && (
          <div style={{
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 16px',
            border: '1px solid var(--border-color)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                <Clock size={15} color="var(--accent-primary)" />
                <span>Son Açılan Belgeler</span>
              </div>
              <button 
                onClick={handleClearRecent}
                className="btn-ghost" 
                style={{ fontSize: '11px', padding: '3px 8px', color: 'var(--text-muted)' }}
              >
                Temizle
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {recentFiles.map((file, idx) => (
                <div 
                  key={idx}
                  onClick={() => onOpenRecentFile && onOpenRecentFile(file.path)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-tertiary)',
                    cursor: onOpenRecentFile ? 'pointer' : 'default',
                    transition: 'background 0.15s ease',
                  }}
                  className="recent-file-item"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    <FileText size={15} color="#e11d48" style={{ flexShrink: 0 }} />
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {file.name}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {file.path}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      onClick={(e) => handleRemoveRecentItem(e, file.path)}
                      className="btn-icon"
                      data-tooltip="Listeden Kaldır"
                      style={{ width: '22px', height: '22px' }}
                    >
                      <Trash2 size={12} />
                    </button>
                    {onOpenRecentFile && <ChevronRight size={14} color="var(--text-muted)" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FOOTER PRIVACY & PERFORMANCE HIGHLIGHTS */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '20px',
          fontSize: '11px',
          color: 'var(--text-muted)',
          paddingTop: '6px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Zap size={13} color="#f59e0b" />
            <span>Rust & WebAssembly Motoru</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <ShieldCheck size={13} color="#10b981" />
            <span>%100 Çevrimdışı & Yerel Gizlilik</span>
          </div>
        </div>

      </div>
    </div>
  );
};
