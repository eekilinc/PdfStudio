import React, { useState } from 'react';
import { 
  X, 
  Settings as SettingsIcon, 
  Sun, 
  Moon, 
  PenTool, 
  FolderOpen, 
  Sparkles, 
  RotateCcw, 
  Check, 
  Trash2, 
  Languages
} from 'lucide-react';
import { DEFAULT_SETTINGS } from '../types/settings';
import type { AppSettings } from '../types/settings';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (newSettings: AppSettings) => void;
  onClearRecentFiles: () => void;
}

type TabType = 'appearance' | 'tools' | 'files' | 'ocr';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  onClearRecentFiles,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('appearance');
  const [current, setCurrent] = useState<AppSettings>(settings);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [clearedRecentSuccess, setClearedRecentSuccess] = useState(false);

  const [prevSettings, setPrevSettings] = useState(settings);
  if (settings !== prevSettings) {
    setPrevSettings(settings);
    setCurrent(settings);
  }

  if (!isOpen) return null;

  const handleChange = <K extends keyof AppSettings>(key: K, val: AppSettings[K]) => {
    const updated = { ...current, [key]: val };
    setCurrent(updated);
    // Live update
    onSaveSettings(updated);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 1200);
  };

  const handleResetDefaults = () => {
    if (window.confirm('Tüm ayarları varsayılan fabrika değerlerine sıfırlamak istediğinizden emin misiniz?')) {
      setCurrent(DEFAULT_SETTINGS);
      onSaveSettings(DEFAULT_SETTINGS);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 1500);
    }
  };

  const handleClearHistory = () => {
    onClearRecentFiles();
    setClearedRecentSuccess(true);
    setTimeout(() => setClearedRecentSuccess(false), 2000);
  };

  const penColors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#0f172a', '#ffffff'];
  const highlighterColors = ['#fde047', '#86efac', '#93c5fd', '#fca5a5', '#d8b4fe', '#fdba74'];
  const fontFamilies = [
    { label: 'Inter (Varsayılan)', value: 'Inter, sans-serif' },
    { label: 'Roboto', value: 'Roboto, sans-serif' },
    { label: 'Arial', value: 'Arial, sans-serif' },
    { label: 'Times New Roman', value: 'Times New Roman, serif' },
    { label: 'JetBrains Mono', value: 'JetBrains Mono, monospace' },
    { label: 'Courier New', value: 'Courier New, monospace' },
  ];

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
                background: 'linear-gradient(135deg, #6366f1, #4338ca)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
              }}
            >
              <SettingsIcon size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Uygulama Ayarları & Tercihler
                </h2>
                {savedSuccess && (
                  <span style={{ fontSize: '11px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                    <Check size={13} /> Kaydedildi
                  </span>
                )}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                PDF Studio Pro'yu kendi çalışma tarzınıza göre özelleştirin
              </div>
            </div>
          </div>

          <button onClick={onClose} className="btn-icon" style={{ width: '28px', height: '28px' }}>
            <X size={16} />
          </button>
        </div>

        {/* TAB NAVIGATION BAR */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-color)',
            background: 'var(--bg-tertiary)',
            padding: '0 16px',
            gap: '6px',
          }}
        >
          <button
            onClick={() => setActiveTab('appearance')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 14px',
              fontSize: '12.5px',
              fontWeight: 600,
              color: activeTab === 'appearance' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'appearance' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              background: 'transparent',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Sun size={14} />
            <span>Görünüm & Tema</span>
          </button>

          <button
            onClick={() => setActiveTab('tools')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 14px',
              fontSize: '12.5px',
              fontWeight: 600,
              color: activeTab === 'tools' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'tools' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              background: 'transparent',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <PenTool size={14} />
            <span>Araçlar & Çizim</span>
          </button>

          <button
            onClick={() => setActiveTab('files')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 14px',
              fontSize: '12.5px',
              fontWeight: 600,
              color: activeTab === 'files' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'files' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              background: 'transparent',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <FolderOpen size={14} />
            <span>Dosya & Kaydetme</span>
          </button>

          <button
            onClick={() => setActiveTab('ocr')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 14px',
              fontSize: '12.5px',
              fontWeight: 600,
              color: activeTab === 'ocr' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'ocr' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              background: 'transparent',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Languages size={14} />
            <span>OCR & Dil</span>
          </button>
        </div>

        {/* BODY TAB CONTENT */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* TAB 1: APPEARANCE & THEME */}
          {activeTab === 'appearance' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} className="animate-fade-in">
              
              {/* Theme Selection */}
              <div style={{ background: 'var(--bg-secondary)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', display: 'block' }}>
                  Arayüz Teması
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    onClick={() => handleChange('theme', 'dark')}
                    style={{
                      padding: '12px',
                      borderRadius: 'var(--radius-md)',
                      border: current.theme === 'dark' ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                      background: current.theme === 'dark' ? 'rgba(56, 189, 248, 0.12)' : 'var(--bg-tertiary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      cursor: 'pointer',
                      color: 'var(--text-primary)',
                      fontWeight: 600,
                    }}
                  >
                    <Moon size={18} color="#38bdf8" />
                    <div style={{ textAlign: 'left' }}>
                      <div>Koyu Tema (Dark Mode)</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>Göz yormayan koyu gri tonlar</div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleChange('theme', 'light')}
                    style={{
                      padding: '12px',
                      borderRadius: 'var(--radius-md)',
                      border: current.theme === 'light' ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                      background: current.theme === 'light' ? 'rgba(56, 189, 248, 0.12)' : 'var(--bg-tertiary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      cursor: 'pointer',
                      color: 'var(--text-primary)',
                      fontWeight: 600,
                    }}
                  >
                    <Sun size={18} color="#f59e0b" />
                    <div style={{ textAlign: 'left' }}>
                      <div>Açık Tema (Light Mode)</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>Ferah, aydınlık beyaz tonlar</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Default Reader Filter */}
              <div style={{ background: 'var(--bg-secondary)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', display: 'block' }}>
                  Varsayılan Okuma Filtresi
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                  {[
                    { id: 'normal', label: 'Normal' },
                    { id: 'sepia', label: 'Sıcak Sepia' },
                    { id: 'inverted', label: 'Gece Modu' },
                    { id: 'high-contrast', label: 'Yüksek Kontrast' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => handleChange('readerFilter', f.id as any)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 'var(--radius-sm)',
                        border: current.readerFilter === f.id ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                        background: current.readerFilter === f.id ? 'rgba(56, 189, 248, 0.12)' : 'var(--bg-tertiary)',
                        color: 'var(--text-primary)',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Default Zoom & Sidebar */}
              <div style={{ background: 'var(--bg-secondary)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px', display: 'block' }}>
                    Başlangıç Yakınlaştırma (Zoom)
                  </label>
                  <select
                    value={current.defaultZoom}
                    onChange={(e) => handleChange('defaultZoom', Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      fontSize: '12.5px',
                    }}
                  >
                    <option value={0.75}>%75 (Kompakt)</option>
                    <option value={1.0}>%100 (Gerçek Boyut)</option>
                    <option value={1.25}>%125 (Geniş & Net)</option>
                    <option value={1.5}>%150 (Büyük)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px', display: 'block' }}>
                    Sol Sayfa Paneli (Thumbnails)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12.5px', color: 'var(--text-primary)', marginTop: '8px' }}>
                    <input
                      type="checkbox"
                      checked={current.sidebarDefaultOpen}
                      onChange={(e) => handleChange('sidebarDefaultOpen', e.target.checked)}
                    />
                    <span>Belge açıldığında sol paneli açık tut</span>
                  </label>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: TOOLS & DRAWING DEFAULTS */}
          {activeTab === 'tools' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} className="animate-fade-in">
              
              {/* Pen Settings */}
              <div style={{ background: 'var(--bg-secondary)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <PenTool size={15} color="#ef4444" />
                  <span>Çizim Kalemi Varsayılanları</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Kalem Rengi:</div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {penColors.map((color) => (
                        <div
                          key={color}
                          onClick={() => handleChange('defaultPenColor', color)}
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            backgroundColor: color,
                            border: current.defaultPenColor === color ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                            cursor: 'pointer',
                            boxShadow: current.defaultPenColor === color ? '0 0 0 2px rgba(56, 189, 248, 0.4)' : undefined,
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                      Çizgi Kalınlığı: <strong>{current.defaultPenWidth} px</strong>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={12}
                      value={current.defaultPenWidth}
                      onChange={(e) => handleChange('defaultPenWidth', Number(e.target.value))}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
              </div>

              {/* Highlighter Settings */}
              <div style={{ background: 'var(--bg-secondary)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={15} color="#f59e0b" />
                  <span>Fosforlu Vurgulayıcı Varsayılanları</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Vurgu Rengi:</div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {highlighterColors.map((color) => (
                        <div
                          key={color}
                          onClick={() => handleChange('defaultHighlighterColor', color)}
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            backgroundColor: color,
                            border: current.defaultHighlighterColor === color ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                            cursor: 'pointer',
                            boxShadow: current.defaultHighlighterColor === color ? '0 0 0 2px rgba(56, 189, 248, 0.4)' : undefined,
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                      Vurgu Şeffaflığı: <strong>%{Math.round(current.defaultHighlighterOpacity * 100)}</strong>
                    </div>
                    <input
                      type="range"
                      min={0.15}
                      max={0.85}
                      step={0.05}
                      value={current.defaultHighlighterOpacity}
                      onChange={(e) => handleChange('defaultHighlighterOpacity', Number(e.target.value))}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
              </div>

              {/* Text Tool Defaults */}
              <div style={{ background: 'var(--bg-secondary)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px', display: 'block' }}>
                    Varsayılan Yazı Tipi
                  </label>
                  <select
                    value={current.defaultFontFamily}
                    onChange={(e) => handleChange('defaultFontFamily', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      fontSize: '12.5px',
                    }}
                  >
                    {fontFamilies.map((f) => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px', display: 'block' }}>
                    Varsayılan Yazı Boyutu ({current.defaultFontSize} pt)
                  </label>
                  <input
                    type="range"
                    min={10}
                    max={36}
                    value={current.defaultFontSize}
                    onChange={(e) => handleChange('defaultFontSize', Number(e.target.value))}
                    style={{ width: '100%', marginTop: '6px' }}
                  />
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: FILE & SAVE PREFERENCES */}
          {activeTab === 'files' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} className="animate-fade-in">
              
              {/* Save Location Behavior */}
              <div style={{ background: 'var(--bg-secondary)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Kaydetme & Dışa Aktarma Davranışı
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: current.saveLocationMode === 'ask' ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                      background: current.saveLocationMode === 'ask' ? 'rgba(56, 189, 248, 0.08)' : 'var(--bg-tertiary)',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="settingsSaveLocation"
                      checked={current.saveLocationMode === 'ask'}
                      onChange={() => handleChange('saveLocationMode', 'ask')}
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
                      border: current.saveLocationMode === 'downloads' ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                      background: current.saveLocationMode === 'downloads' ? 'rgba(56, 189, 248, 0.08)' : 'var(--bg-tertiary)',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="settingsSaveLocation"
                      checked={current.saveLocationMode === 'downloads'}
                      onChange={() => handleChange('saveLocationMode', 'downloads')}
                      style={{ marginTop: '2px' }}
                    />
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Doğrudan İndirilenler'e Kaydet
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Soru sormadan standart Downloads klasörüne yazar.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Startup & Recent Files */}
              <div style={{ background: 'var(--bg-secondary)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Açılış & Son Kullanılan Dosyalar
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12.5px', color: 'var(--text-primary)' }}>
                  <input
                    type="checkbox"
                    checked={current.showWelcomeScreenOnStartup}
                    onChange={(e) => handleChange('showWelcomeScreenOnStartup', e.target.checked)}
                  />
                  <span>Uygulama açılışında Karşılama Merkezini (Welcome Dashboard) göster</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12.5px', color: 'var(--text-primary)' }}>
                  <input
                    type="checkbox"
                    checked={current.rememberRecentFiles}
                    onChange={(e) => handleChange('rememberRecentFiles', e.target.checked)}
                  />
                  <span>Son açılan belgeleri hatırla ve listele</span>
                </label>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '6px', borderTop: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Geçmiş listesini temizlemek mi istiyorsunuz?
                  </span>
                  <button
                    onClick={handleClearHistory}
                    className="btn-ghost"
                    style={{ fontSize: '11.5px', padding: '5px 12px', gap: '6px', color: '#f43f5e' }}
                  >
                    {clearedRecentSuccess ? (
                      <>
                        <Check size={13} color="#10b981" />
                        <span style={{ color: '#10b981' }}>Temizlendi!</span>
                      </>
                    ) : (
                      <>
                        <Trash2 size={13} />
                        <span>Geçmişi Temizle</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* TAB 4: OCR & LANGUAGE */}
          {activeTab === 'ocr' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} className="animate-fade-in">
              
              <div style={{ background: 'var(--bg-secondary)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Languages size={16} color="var(--accent-primary)" />
                  <span>Varsayılan OCR Optik Karakter Tanıma Dili</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Taranmış resim belgelerinden metin çıkarırken öncelikli olarak kullanılacak dil motoru:
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {[
                    { id: 'tur', label: 'Türkçe', desc: 'Türkçe karakterler (ç, ğ, ı, ö, ş, ü)' },
                    { id: 'eng', label: 'English', desc: 'Standard Latin / İngilizce belgeler' },
                    { id: 'deu', label: 'Deutsch', desc: 'Almanca ve özel harfler (ä, ö, ü, ß)' },
                    { id: 'fra', label: 'Français', desc: 'Fransızca aksanlı harfler (é, è, ç)' },
                  ].map((lang) => (
                    <div
                      key={lang.id}
                      onClick={() => handleChange('defaultOcrLanguage', lang.id as any)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: current.defaultOcrLanguage === lang.id ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                        background: current.defaultOcrLanguage === lang.id ? 'rgba(56, 189, 248, 0.1)' : 'var(--bg-tertiary)',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {lang.label}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {lang.desc}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

        </div>

        {/* FOOTER */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-secondary)',
          }}
        >
          <button
            onClick={handleResetDefaults}
            className="btn-ghost"
            style={{ fontSize: '11.5px', gap: '5px', color: 'var(--text-muted)' }}
          >
            <RotateCcw size={13} />
            <span>Varsayılanlara Sıfırla</span>
          </button>

          <button
            onClick={onClose}
            className="btn-primary"
            style={{
              fontSize: '12.5px',
              padding: '7px 20px',
              fontWeight: 600,
            }}
          >
            Tamam & Kapat
          </button>
        </div>

      </div>
    </div>
  );
};
