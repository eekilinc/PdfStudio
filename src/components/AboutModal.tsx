import React, { useState } from 'react';
import { APP_VERSION, GITHUB_REPO_URL } from '../version';
import { 
  X, 
  Sparkles, 
  FileText, 
  Cpu, 
  ShieldCheck, 
  Keyboard, 
  CheckCircle2, 
  Layers,
  Zap,
  PenTool,
  ScanText,
  Scissors,
  Hash,
  GitCompare,
  Stamp,
  Lock,
  Minimize2,
  ExternalLink,
  Info,
  Ruler,
  CheckSquare
} from 'lucide-react';

const GithubIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
);

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'overview' | 'features' | 'shortcuts' | 'licenses';

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [displayVersion, setDisplayVersion] = useState(APP_VERSION);

  React.useEffect(() => {
    import('@tauri-apps/api/app')
      .then((app) => app.getVersion())
      .then((v) => {
        if (v) setDisplayVersion(v);
      })
      .catch(() => {});
  }, []);

  if (!isOpen) return null;

  const shortcuts = [
    { key: 'Ctrl + S', desc: 'Doğrudan Kaydet (Hızlı Kaydet)' },
    { key: 'Ctrl + Shift + S', desc: 'Farklı Kaydet... (Konum Seç)' },
    { key: 'Ctrl + O', desc: 'PDF Dosyası Aç' },
    { key: 'Ctrl + Z', desc: 'Geri Al (Undo)' },
    { key: 'Ctrl + Y', desc: 'Yinele (Redo)' },
    { key: 'Ctrl + F', desc: 'Belge İçinde Arama' },
    { key: 'Ctrl + P', desc: 'Belgeyi Yazdır' },
    { key: 'V', desc: 'Seçim & Taşıma & Kopyalama' },
    { key: 'H', desc: 'Sayfayı Kaydır / Gezin (Pan)' },
    { key: 'E', desc: 'Doğrudan Metin Düzenleme' },
    { key: 'P', desc: 'Canlı Çizim Kalemi' },
    { key: 'T', desc: 'Yeni Metin Kutusu Ekle' },
    { key: 'Delete', desc: 'Seçili Nesneyi Sil' },
  ];

  const features = [
    { title: 'Doğrudan Metin Düzenleme', desc: 'Orijinal PDF metinlerini anında değiştirin, silin ve yeniden yazın.', icon: FileText, color: '#38bdf8' },
    { title: 'Tesseract OCR Tarama', desc: 'Taranmış resim belgelerini optik karakter tanıma ile düzenlenebilir yapın.', icon: ScanText, color: '#10b981' },
    { title: 'Ofis Dışa Aktarımı', desc: 'Word (.doc), Excel (.csv), PowerPoint (.html) ve Text formatlarına dönüştürün.', icon: Layers, color: '#3b82f6' },
    { title: 'Sayfaları Böl & Ayıkla', desc: 'Aralık çıkarma, tek sayfa bölme, tek/çift ayrımı veya gruplayarak parçalama.', icon: Scissors, color: '#f43f5e' },
    { title: 'Sayfa Numaralandırma', desc: 'Tüm sayfalara otomatik başlık, altbilgi ve sayfa numarası basın.', icon: Hash, color: '#3b82f6' },
    { title: 'İki PDF Karşılaştırma', desc: 'İki sözleşmeyi yan yana pencerelerde eşzamanlı kaydırarak inceleyin.', icon: GitCompare, color: '#10b981' },
    { title: 'Boyut Küçült & Optimize Et', desc: 'Yüksek kaliteli sıkıştırma profilleriyle dosya boyutunu küçültün.', icon: Minimize2, color: '#f59e0b' },
    { title: 'Dijital İmza & Kaşe', desc: 'Çizerek, yazarak veya resim yükleyerek resmi onay ve damgalama.', icon: Stamp, color: '#ec4899' },
    { title: 'Parola & Güvenlik Kilidi', desc: '128-bit AES şifreleme ve güçlü parolalarla koruma altına alın.', icon: Lock, color: '#a855f7' },
    { title: 'Teknik Mesafe Ölçümü', desc: 'Plan ve krokiler üzerinde iki nokta arasındaki mesafeyi (cm/mm) ölçün.', icon: Ruler, color: '#38bdf8' },
    { title: 'İnteraktif Onay Kutusu', desc: 'Tıklanabilir onay kutuları (checkbox) ekleyin ve yönetin.', icon: CheckSquare, color: '#10b981' },
    { title: 'Canlı Çizim & Fosforlu Kalem', desc: '60 FPS anlık önizleme ile serbest çizim ve satır vurgulama.', icon: PenTool, color: '#f59e0b' },
  ];

  const technologies = [
    {
      name: 'Tauri 2.0',
      role: 'Rust Tabanlı Güvenli Masaüstü Mimarisi',
      license: 'MIT / Apache-2.0',
      url: 'https://tauri.app',
      desc: 'Düşük bellek kullanımı, ultra hızlı yerel dosya G/Ç ve donanım hızlandırma sağlar.',
    },
    {
      name: 'PDF.js (Mozilla)',
      role: 'Web Standartlarında PDF Render Motoru',
      license: 'Apache-2.0',
      url: 'https://mozilla.github.io/pdf.js',
      desc: 'CMap glif motoru ve Web Worker ile yüksek çözünürlüklü sayfa işleme.',
    },
    {
      name: 'pdf-lib',
      role: 'Vektörel PDF Oluşturma & Sayfa Modifikasyonu',
      license: 'MIT',
      url: 'https://pdf-lib.js.org',
      desc: 'Doğrudan PDF bayt akışı seviyesinde sayfa düzenleme, birleştirme ve şifreleme.',
    },
    {
      name: 'React 19 & TypeScript',
      role: 'Reaktif Kullanıcı Deneyimi & Tip Güvenliği',
      license: 'MIT',
      url: 'https://react.dev',
      desc: 'Modern bileşen yapısı, anlık durum yönetimi ve hatasız kod mimarisi.',
    },
    {
      name: 'Tesseract.js',
      role: 'Optik Karakter Tanıma (OCR) Motoru',
      license: 'Apache-2.0',
      url: 'https://tesseract.projectnaptha.com',
      desc: 'Taranmış belgeleri ve resimleri istemci tarafında çevrimdışı metne dönüştürür.',
    },
    {
      name: 'Vite 6',
      role: 'Yeni Nesil Ön Uç Derleme Sistemi',
      license: 'MIT',
      url: 'https://vite.dev',
      desc: 'Modüler JavaScript paketleme, Hot Module Replacement (HMR) ve optimizasyon.',
    },
    {
      name: 'Lucide Icons',
      role: 'Modern Vektörel İkon Seti',
      license: 'ISC',
      url: 'https://lucide.dev',
      desc: 'Tüm arayüzde tutarlı, net ve hafif SVG vektör simgeleri.',
    },
  ];

  const handleOpenUrl = async (url: string) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('open_url', { url });
    } catch {
      window.open(url, '_blank');
    }
  };

  const handleOpenGithub = async () => {
    handleOpenUrl(GITHUB_REPO_URL);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card animate-fade-in" style={{ width: '680px', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-tertiary)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'var(--accent-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-glow)',
            }}>
              <FileText size={18} color="#ffffff" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>PDF Studio Pro</span>
                <span style={{ fontSize: '10px', background: 'rgba(56, 189, 248, 0.15)', color: 'var(--accent-primary)', padding: '1px 5px', borderRadius: '4px' }}>v{displayVersion}</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Yüksek Performanslı Masaüstü PDF Düzenleme Paketi
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={handleOpenGithub}
              className="btn-ghost"
              data-tooltip="GitHub Kaynak Kodu"
              style={{ fontSize: '11px', padding: '5px 8px', gap: '5px', color: 'var(--text-primary)' }}
            >
              <GithubIcon size={14} />
              <span>GitHub</span>
              <ExternalLink size={11} style={{ opacity: 0.6 }} />
            </button>

            <button onClick={onClose} className="btn-icon" style={{ width: '26px', height: '26px' }}>
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Tab Navigation Bar */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-secondary)',
          padding: '0 12px',
          gap: '4px',
        }}>
          <button
            onClick={() => setActiveTab('overview')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 12px',
              fontSize: '12px',
              fontWeight: 600,
              color: activeTab === 'overview' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'overview' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              background: 'transparent',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Info size={14} />
            <span>Genel Bakış</span>
          </button>

          <button
            onClick={() => setActiveTab('features')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 12px',
              fontSize: '12px',
              fontWeight: 600,
              color: activeTab === 'features' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'features' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              background: 'transparent',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Zap size={14} />
            <span>Özellikler ({features.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('shortcuts')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 12px',
              fontSize: '12px',
              fontWeight: 600,
              color: activeTab === 'shortcuts' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'shortcuts' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              background: 'transparent',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Keyboard size={14} />
            <span>Kısayollar ({shortcuts.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('licenses')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 12px',
              fontSize: '12px',
              fontWeight: 600,
              color: activeTab === 'licenses' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'licenses' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              background: 'transparent',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Layers size={14} />
            <span>Teknolojiler & Lisanslar</span>
          </button>
        </div>

        {/* Tab Content */}
        <div style={{ padding: '16px 18px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }} className="animate-fade-in">
              {/* Hero Box */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.1), rgba(129, 140, 248, 0.06))',
                border: '1px solid rgba(56, 189, 248, 0.2)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}>
                <Sparkles size={22} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
                <div style={{ fontSize: '12px', lineHeight: '1.5', color: 'var(--text-secondary)' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>PDF Studio Pro</strong>, %100 gizlilik odaklı mimarisiyle hiçbir veriyi sunuculara göndermeden tüm işlemleri yerel cihazınızda gerçekleştiren, ultra hızlı ve profesyonel bir masaüstü PDF aracıdır.
                </div>
              </div>

              {/* Highlights 3-Card Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '10px', textAlign: 'center' }}>
                  <ShieldCheck size={18} color="#10b981" style={{ margin: '0 auto 4px' }} />
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>%100 Yerel Güvenlik</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Sıfır veri sızıntısı</div>
                </div>

                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '10px', textAlign: 'center' }}>
                  <Cpu size={18} color="#38bdf8" style={{ margin: '0 auto 4px' }} />
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>Rust + React 19</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Maksimum hız</div>
                </div>

                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '10px', textAlign: 'center' }}>
                  <ScanText size={18} color="#f59e0b" style={{ margin: '0 auto 4px' }} />
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>Tesseract OCR</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Optik karakter tanıma</div>
                </div>
              </div>

              {/* GitHub Repo Card */}
              <div style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <GithubIcon size={20} />
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      eekilinc/pdfstudio
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      Resmi Açık Kaynak GitHub Deposu
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleOpenGithub}
                  className="btn-primary"
                  style={{ fontSize: '11px', padding: '5px 12px', gap: '5px' }}
                >
                  <span>Depoyu Aç</span>
                  <ExternalLink size={12} />
                </button>
              </div>

              {/* Tech Stack Specs */}
              <div style={{
                background: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 12px',
                border: '1px solid var(--border-color)',
                fontSize: '11px',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Cpu size={13} color="var(--accent-primary)" />
                  <span>Tauri 2.0 (Rust) + PDF.js + pdf-lib + React 19 + Vite</span>
                </div>
                <div style={{ color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle2 size={12} />
                  <span>v{displayVersion} Yayın</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: FEATURES (Compact 2-Column Grid) */}
          {activeTab === 'features' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }} className="animate-fade-in">
              {features.map((f, i) => (
                <div 
                  key={i} 
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    <f.icon size={13} color={f.color} />
                    <span>{f.title}</span>
                  </div>
                  <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', lineHeight: '1.35' }}>
                    {f.desc}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 3: KEYBOARD SHORTCUTS (Compact Matrix) */}
          {activeTab === 'shortcuts' && (
            <div style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
            }} className="animate-fade-in">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'var(--border-color)' }}>
                {shortcuts.map((s, i) => (
                  <div 
                    key={i}
                    style={{
                      background: 'var(--bg-secondary)',
                      padding: '7px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '11px',
                    }}
                  >
                    <span style={{ color: 'var(--text-secondary)' }}>{s.desc}</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', background: 'var(--bg-tertiary)', padding: '1px 5px', borderRadius: '4px', border: '1px solid var(--border-color)', fontWeight: 600 }}>
                      {s.key}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: TECHNOLOGIES & LICENSES */}
          {activeTab === 'licenses' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }} className="animate-fade-in">
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '2px' }}>
                PDF Studio Pro, aşağıdaki güvenilir açık kaynaklı teknolojiler ve kütüphaneler üzerine inşa edilmiştir:
              </div>

              {technologies.map((tech, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {tech.name}
                      </span>
                      <span style={{
                        fontSize: '9.5px',
                        fontWeight: 700,
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: '#10b981',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                      }}>
                        {tech.license}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--accent-primary)', fontWeight: 500 }}>
                      {tech.role}
                    </div>
                    <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', lineHeight: 1.35 }}>
                      {tech.desc}
                    </div>
                  </div>

                  <button
                    onClick={() => handleOpenUrl(tech.url)}
                    className="btn-ghost"
                    data-tooltip="Resmi Siteyi / Dokümantasyonu Aç"
                    style={{
                      padding: '5px 8px',
                      fontSize: '11px',
                      gap: '4px',
                      color: 'var(--text-primary)',
                      flexShrink: 0,
                    }}
                  >
                    <span>Resmi Site</span>
                    <ExternalLink size={12} style={{ opacity: 0.7 }} />
                  </button>
                </div>
              ))}
            </div>
          )}

        </div>

        {/* Footer */}
        <div style={{
          padding: '10px 18px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-tertiary)',
          fontSize: '11px',
        }}>
          <div style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>© 2026 PDF Studio Pro • MIT Lisansı</span>
          </div>

          <button onClick={onClose} className="btn-primary" style={{ padding: '5px 16px', fontSize: '11.5px' }}>
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
