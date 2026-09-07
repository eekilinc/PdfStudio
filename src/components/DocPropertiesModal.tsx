import React, { useState, useEffect } from 'react';
import { X, FileText, Calendar, HardDrive, ShieldCheck, Tag, User, Save, Layers } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import type { PDFDocumentState } from '../types/pdf';
import { getSharedPdfDoc } from '../utils/pdfInit';

interface DocPropertiesModalProps {
  isOpen: boolean;
  onClose: () => void;
  docState: PDFDocumentState;
  onUpdatePdfData: (newData: Uint8Array) => void;
  onShowToast?: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export const DocPropertiesModal: React.FC<DocPropertiesModalProps> = ({
  isOpen,
  onClose,
  docState,
  onUpdatePdfData,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'info' | 'edit'>('info');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Technical Metadata
  const [pdfVersion, setPdfVersion] = useState<string>('PDF 1.7');
  const [creationDate, setCreationDate] = useState<string>('-');
  const [modDate, setModDate] = useState<string>('-');
  const [producer, setProducer] = useState<string>('-');
  const [creator, setCreator] = useState<string>('-');

  // Editable Metadata
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [subject, setSubject] = useState('');
  const [keywords, setKeywords] = useState('');

  useEffect(() => {
    if (!isOpen || !docState.data) return;

    let isMounted = true;
    const fetchMetadata = async () => {
      setLoading(true);
      try {
        const pdf = await getSharedPdfDoc(docState.data!);
        if (!pdf) return;

        const meta = await pdf.getMetadata();
        if (!isMounted) return;

        const info = (meta?.info || {}) as Record<string, unknown>;

        setTitle(typeof info.Title === 'string' ? info.Title : '');
        setAuthor(typeof info.Author === 'string' ? info.Author : '');
        setSubject(typeof info.Subject === 'string' ? info.Subject : '');
        setKeywords(typeof info.Keywords === 'string' ? info.Keywords : '');
        setProducer(typeof info.Producer === 'string' ? info.Producer : 'PDF Studio Pro Engine');
        setCreator(typeof info.Creator === 'string' ? info.Creator : '-');
        setPdfVersion(typeof info.PDFFormatVersion === 'string' ? `PDF ${info.PDFFormatVersion}` : 'PDF 1.7');

        if (info.CreationDate) {
          setCreationDate(String(info.CreationDate).replace(/^D:/, '').slice(0, 14));
        }
        if (info.ModDate) {
          setModDate(String(info.ModDate).replace(/^D:/, '').slice(0, 14));
        }
      } catch (err) {
        console.error('Metadata fetch error:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchMetadata();
    return () => {
      isMounted = false;
    };
  }, [isOpen, docState.data]);

  if (!isOpen) return null;

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleSaveMetadata = async () => {
    if (!docState.data) return;
    setSaving(true);
    try {
      const pdfDoc = await PDFDocument.load(docState.data);
      pdfDoc.setTitle(title.trim());
      pdfDoc.setAuthor(author.trim());
      pdfDoc.setSubject(subject.trim());
      if (keywords.trim()) {
        pdfDoc.setKeywords(keywords.split(',').map((k) => k.trim()).filter(Boolean));
      } else {
        pdfDoc.setKeywords([]);
      }
      pdfDoc.setModificationDate(new Date());

      const updatedBytes = await pdfDoc.save();
      onUpdatePdfData(updatedBytes);

      if (onShowToast) {
        onShowToast('Belge meta verileri başarıyla güncellendi.', 'success');
      }
      onClose();
    } catch (err) {
      console.error('Save metadata error:', err);
      if (onShowToast) {
        onShowToast('Meta veriler kaydedilirken hata oluştu.', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const firstPage = docState.pages[0];
  const dimensionsStr = firstPage
    ? `${Math.round(firstPage.width)} × ${Math.round(firstPage.height)} pt`
    : '595 × 842 pt (A4)';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="modal-card animate-fade-in"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '560px' }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              background: 'rgba(56, 189, 248, 0.15)',
              color: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <FileText size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Belge Özellikleri & Meta Veriler
              </h2>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {docState.filename || 'Belgesiz'}
              </p>
            </div>
          </div>

          <button onClick={onClose} className="btn-icon" style={{ width: '28px', height: '28px' }}>
            <X size={16} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          padding: '0 20px',
          borderBottom: '1px solid var(--border-color)',
          gap: '16px',
        }}>
          <button
            onClick={() => setActiveTab('info')}
            style={{
              padding: '10px 0',
              fontSize: '12px',
              fontWeight: 600,
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'info' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: activeTab === 'info' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            Genel Bilgiler & Teknik
          </button>
          <button
            onClick={() => setActiveTab('edit')}
            style={{
              padding: '10px 0',
              fontSize: '12px',
              fontWeight: 600,
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'edit' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: activeTab === 'edit' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            Meta Veri Düzenleyici
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px', minHeight: '260px' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--text-muted)', fontSize: '13px' }}>
              Meta veriler okunuyor...
            </div>
          ) : activeTab === 'info' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="glass-panel" style={{ padding: '12px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '11px', marginBottom: '4px' }}>
                  <HardDrive size={13} />
                  <span>Dosya Boyutu</span>
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {docState.data ? formatFileSize(docState.data.byteLength) : '-'}
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '12px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '11px', marginBottom: '4px' }}>
                  <Layers size={13} />
                  <span>Sayfa Sayısı</span>
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {docState.pageOrder.length} Sayfa
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '12px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '11px', marginBottom: '4px' }}>
                  <FileText size={13} />
                  <span>PDF Sürümü & Formatı</span>
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {pdfVersion}
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '12px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '11px', marginBottom: '4px' }}>
                  <ShieldCheck size={13} />
                  <span>Sayfa Boyutları (1. Sayfa)</span>
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {dimensionsStr}
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '12px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '11px', marginBottom: '4px' }}>
                  <Calendar size={13} />
                  <span>Oluşturulma Tarihi</span>
                </div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {creationDate}
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '12px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '11px', marginBottom: '4px' }}>
                  <Calendar size={13} />
                  <span>Son Değiştirilme</span>
                </div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {modDate}
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '12px', borderRadius: 'var(--radius-md)', gridColumn: 'span 2' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '11px', marginBottom: '4px' }}>
                  <Calendar size={13} />
                  <span>Üretici & Oluşturan Araç</span>
                </div>
                <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                  {producer} {creator && creator !== '-' ? `(${creator})` : ''}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  <FileText size={12} /> Belge Başlığı (Title)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Örn: Proje Şartnamesi v2"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  <User size={12} /> Yazar / Kuruluş (Author)
                </label>
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="Örn: Ekrem Kılınç"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  <Tag size={12} /> Konu / Açıklama (Subject)
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Örn: Yazılım mimarisi ve teknik analiz"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  <Tag size={12} /> Anahtar Kelimeler (Keywords, virgülle ayrılmış)
                </label>
                <input
                  type="text"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="Örn: pdf, rapor, 2026, tauri"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    outline: 'none',
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '12px 20px',
          borderTop: '1px solid var(--border-color)',
          gap: '8px',
        }}>
          <button onClick={onClose} className="btn-secondary" style={{ fontSize: '12px' }}>
            Kapat
          </button>
          {activeTab === 'edit' && (
            <button
              onClick={handleSaveMetadata}
              disabled={saving}
              className="btn-primary"
              style={{ fontSize: '12px', gap: '6px' }}
            >
              <Save size={13} />
              <span>{saving ? 'Kaydediliyor...' : 'Meta Verileri Kaydet'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
