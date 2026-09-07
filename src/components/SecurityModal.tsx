import React, { useState } from 'react';
import { X, Lock, Shield, Eye, EyeOff, Check, Loader2, KeyRound, Sliders } from 'lucide-react';
import { encryptPDF } from '@pdfsmaller/pdf-encrypt';
import { exportModifiedPdf } from '../utils/pdfExport';
import type { PDFDocumentState } from '../types/pdf';

interface SecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
  docState: PDFDocumentState;
  onShowToast?: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export const SecurityModal: React.FC<SecurityModalProps> = ({ isOpen, onClose, docState, onShowToast }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [algorithm, setAlgorithm] = useState<'AES-256' | 'RC4'>('AES-256');
  const [allowPrinting, setAllowPrinting] = useState(true);
  const [allowCopying, setAllowCopying] = useState(false);
  const [allowModifying, setAllowModifying] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const notify = (text: string, type: 'success' | 'error' | 'info' = 'error') => {
    if (onShowToast) onShowToast(text, type);
    else alert(text);
  };

  if (!isOpen) return null;

  const handleApplySecurity = async () => {
    if (!password.trim()) {
      notify('Lütfen bir açılış parolası girin.', 'error');
      return;
    }
    if (password !== confirmPassword) {
      notify('Girdiğiniz açılış parolaları birbiriyle eşleşmiyor.', 'error');
      return;
    }

    setIsProcessing(true);

    try {
      if (!docState.data) throw new Error('PDF verisi bulunamadı');

      // 1. Export clean modified PDF bytes with pdf-lib
      const exportedBytes = await exportModifiedPdf(docState);

      // 2. Encrypt PDF using Web Crypto AES-256 or RC4 standard
      const encryptedBytes = await encryptPDF(exportedBytes, password, {
        ownerPassword: ownerPassword.trim() || undefined,
        algorithm,
        allowPrinting,
        allowCopying,
        allowModifying,
        allowHighQualityPrint: allowPrinting,
        allowAnnotating: allowModifying,
      });

      const defaultName = (docState.filename ? docState.filename.replace(/\.pdf$/i, '') : 'Belge') + '_Sifreli.pdf';

      // 3. Save file using Tauri native dialog if available, else download as blob
      let savedViaTauri = false;
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const chosenPath = await invoke<string | null>('pick_save_pdf_path', { defaultName });
        if (chosenPath) {
          await invoke('write_pdf_file', {
            path: chosenPath,
            contents: Array.from(encryptedBytes),
          });
          savedViaTauri = true;
          onClose();
        } else {
          // User cancelled save dialog
          setIsProcessing(false);
          return;
        }
      } catch {
        // Fallback for browser download mode
      }

      if (!savedViaTauri) {
        const blob = new Blob([encryptedBytes as unknown as BlobPart], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = defaultName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        notify('Şifrelenmiş PDF başarıyla indirildi.', 'success');
        onClose();
      }
    } catch (err: unknown) {
      console.error('Security export error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      notify('Şifreleme sırasında hata oluştu: ' + msg, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card animate-fade-in" style={{ width: '500px' }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ fontWeight: 600, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Lock size={18} color="var(--accent-primary)" />
            <span>PDF Parola Koruması & AES-256 Şifreleme</span>
          </div>
          <button onClick={onClose} className="btn-icon" style={{ width: '28px', height: '28px' }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            background: 'var(--bg-tertiary)',
            padding: '12px 14px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            lineHeight: '1.5',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}>
            <Shield size={24} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
            <span>
              Bu belge <strong>{algorithm}</strong> standardı ile doğrudan istemcide şifrelenir. 
              Parolayı bilmeyen hiç kimse PDF içeriğini açamaz veya görüntüleyemez.
            </span>
          </div>

          {/* User Password */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              Açılış Parolası (Zorunlu):
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Belgeyi açmak için gereken parola..."
                style={{
                  width: '100%',
                  padding: '8px 36px 8px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="btn-icon"
                style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', width: '24px', height: '24px' }}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              Parolayı Tekrar Girin:
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Parolayı teyit edin..."
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                outline: 'none',
              }}
            />
          </div>

          {/* Advanced Options Toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-primary)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: 0,
              }}
            >
              <Sliders size={14} />
              <span>{showAdvanced ? 'Gelişmiş İzinleri Gizle' : 'Gelişmiş İzinler & Şifreleme Ayarları'}</span>
            </button>
          </div>

          {showAdvanced && (
            <div style={{
              background: 'var(--bg-secondary)',
              padding: '14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              fontSize: '12px',
            }}>
              {/* Algorithm */}
              <div>
                <label style={{ fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Şifreleme Algoritması:
                </label>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="sec-algo"
                      checked={algorithm === 'AES-256'}
                      onChange={() => setAlgorithm('AES-256')}
                    />
                    <span>AES-256 (Önerilen, Maksimum Güvenlik)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="sec-algo"
                      checked={algorithm === 'RC4'}
                      onChange={() => setAlgorithm('RC4')}
                    />
                    <span>RC4 128-bit (Eski Okuyucular)</span>
                  </label>
                </div>
              </div>

              {/* Owner Password */}
              <div>
                <label style={{ fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Yönetici (Master) Parolası (İsteğe Bağlı):
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="password"
                    value={ownerPassword}
                    onChange={(e) => setOwnerPassword(e.target.value)}
                    placeholder="İzinleri kaldırmak için yönetici parolası..."
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-workspace)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      outline: 'none',
                    }}
                  />
                  <KeyRound size={13} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
                </div>
              </div>

              {/* Granular Permissions */}
              <div>
                <label style={{ fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Kullanıcı İzinleri:
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={allowPrinting}
                      onChange={(e) => setAllowPrinting(e.target.checked)}
                    />
                    <span>Yazdırmaya (Print) izin ver</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={allowCopying}
                      onChange={(e) => setAllowCopying(e.target.checked)}
                    />
                    <span>Metin ve görsellerin kopyalanmasına izin ver</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={allowModifying}
                      onChange={(e) => setAllowModifying(e.target.checked)}
                    />
                    <span>Belge içeriğinin değiştirilmesine izin ver</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-tertiary)',
        }}>
          <button onClick={onClose} className="btn-ghost" style={{ fontSize: '13px' }}>
            İptal
          </button>

          <button
            onClick={handleApplySecurity}
            disabled={isProcessing}
            className="btn-primary"
            style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            {isProcessing ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Şifreleniyor...</span>
              </>
            ) : (
              <>
                <Check size={16} />
                <span>Şifrele ve Kaydet</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
