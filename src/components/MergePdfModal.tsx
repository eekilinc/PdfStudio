import React, { useState } from 'react';
import { X, Upload, FileText, Trash2, ArrowUp, ArrowDown, Check, Layers } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';

interface MergePdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyMerged: (mergedBytes: Uint8Array, filename: string) => void;
  onShowToast?: (text: string, type?: 'success' | 'error' | 'info') => void;
}

interface MergeItem {
  id: string;
  file: File;
  name: string;
  size: string;
}

export const MergePdfModal: React.FC<MergePdfModalProps> = ({
  isOpen,
  onClose,
  onApplyMerged,
  onShowToast,
}) => {
  const [items, setItems] = useState<MergeItem[]>([]);
  const [isMerging, setIsMerging] = useState(false);

  const notify = (text: string, type: 'success' | 'error' | 'info' = 'error') => {
    if (onShowToast) onShowToast(text, type);
    else alert(text);
  };

  if (!isOpen) return null;

  const handleAddFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newItems: MergeItem[] = Array.from(e.target.files).map((f) => ({
        id: Math.random().toString(36).substring(2, 9),
        file: f,
        name: f.name,
        size: (f.size / 1024 / 1024).toFixed(2) + ' MB',
      }));
      setItems((prev) => [...prev, ...newItems]);
      e.target.value = '';
    }
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const newItems = [...items];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newItems.length) return;
    const temp = newItems[index];
    newItems[index] = newItems[targetIndex];
    newItems[targetIndex] = temp;
    setItems(newItems);
  };

  const handleRemove = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleMerge = async () => {
    if (items.length < 2) return;
    setIsMerging(true);

    try {
      const mergedPdf = await PDFDocument.create();

      for (const item of items) {
        const fileBuffer = await item.file.arrayBuffer();
        const pdf = await PDFDocument.load(fileBuffer);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      }

      const mergedBytes = await mergedPdf.save();
      onApplyMerged(mergedBytes, `Birlestirilmis_Belge_${Date.now()}.pdf`);
      notify(`${items.length} PDF belgesi başarıyla birleştirildi.`, 'success');
      onClose();
    } catch (err) {
      console.error('Merge PDF Error:', err);
      notify('PDF birleştirme işlemi sırasında hata oluştu.', 'error');
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card animate-fade-in" style={{ width: '560px' }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ fontWeight: 600, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} color="var(--accent-primary)" />
            <span>PDF Dosyalarını Birleştir</span>
          </div>
          <button onClick={onClose} className="btn-icon" style={{ width: '28px', height: '28px' }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <label
            style={{
              border: '2px dashed var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              background: 'var(--bg-tertiary)',
              gap: '6px',
            }}
          >
            <input type="file" multiple accept="application/pdf" onChange={handleAddFiles} style={{ display: 'none' }} />
            <Upload size={24} color="var(--accent-primary)" />
            <span style={{ fontSize: '13px', fontWeight: 600 }}>PDF Dosyaları Ekleyin</span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Birden fazla PDF seçebilirsiniz</span>
          </label>

          {/* Files List */}
          <div style={{
            maxHeight: '220px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}>
            {items.map((item, index) => (
              <div
                key={item.id}
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', minWidth: '18px' }}>
                    {index + 1}.
                  </span>
                  <FileText size={16} color="var(--accent-primary)" />
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '12px' }}>
                    {item.name}
                  </div>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>({item.size})</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {index > 0 && (
                    <button onClick={() => handleMove(index, 'up')} className="btn-icon" style={{ width: '22px', height: '22px' }}>
                      <ArrowUp size={12} />
                    </button>
                  )}
                  {index < items.length - 1 && (
                    <button onClick={() => handleMove(index, 'down')} className="btn-icon" style={{ width: '22px', height: '22px' }}>
                      <ArrowDown size={12} />
                    </button>
                  )}
                  <button onClick={() => handleRemove(item.id)} className="btn-icon" style={{ width: '22px', height: '22px', color: 'var(--danger)' }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '10px',
          background: 'var(--bg-tertiary)',
        }}>
          <button onClick={onClose} className="btn-ghost" style={{ fontSize: '13px' }}>
            İptal
          </button>
          <button
            onClick={handleMerge}
            disabled={items.length < 2 || isMerging}
            className="btn-primary"
            style={{ fontSize: '13px', opacity: items.length < 2 ? 0.5 : 1 }}
          >
            <Check size={16} /> {isMerging ? 'Birleştiriliyor...' : `${items.length} Belgeyi Birleştir`}
          </button>
        </div>
      </div>
    </div>
  );
};
