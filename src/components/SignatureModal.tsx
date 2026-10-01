import React, { useState, useRef, useEffect } from 'react';
import { X, PenTool, Type, Upload, Trash2, Check } from 'lucide-react';

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplySignature: (imageDataUrl: string) => void;
}

export const SignatureModal: React.FC<SignatureModalProps> = ({
  isOpen,
  onClose,
  onApplySignature,
}) => {
  const [activeTab, setActiveTab] = useState<'draw' | 'type' | 'upload'>('draw');
  const [inkColor, setInkColor] = useState('#0f172a');
  
  // Draw Tab State
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  // Type Tab State
  const [typedName, setTypedName] = useState('');
  const [selectedFont, setSelectedFont] = useState("'Dancing Script', cursive");

  // Upload Tab State
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && activeTab === 'draw') {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          setHasDrawn(false);
        }
      }
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  // Drawing Handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  // Convert Typed Name to Image
  const generateTypedSignatureDataUrl = (): string => {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 500;
    tempCanvas.height = 160;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return '';

    ctx.font = `64px ${selectedFont}`;
    ctx.fillStyle = inkColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(typedName || 'İmza', tempCanvas.width / 2, tempCanvas.height / 2);

    return tempCanvas.toDataURL('image/png');
  };

  // Process and Make Uploaded Signature Transparent
  const processUploadedImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const ctx = tempCanvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const data = imgData.data;

        // Remove white / light backgrounds
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i] ?? 0;
          const g = data[i + 1] ?? 0;
          const b = data[i + 2] ?? 0;
          const brightness = (r + g + b) / 3;

          if (brightness > 210) {
            data[i + 3] = 0; // Alpha = 0 (Transparent)
          } else {
            // Darken ink
            data[i] = Math.min(r, 40);
            data[i + 1] = Math.min(g, 40);
            data[i + 2] = Math.min(b, 40);
          }
        }

        ctx.putImageData(imgData, 0, 0);
        setUploadedImage(tempCanvas.toDataURL('image/png'));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleApply = () => {
    let resultDataUrl = '';

    if (activeTab === 'draw') {
      const canvas = canvasRef.current;
      if (canvas && hasDrawn) {
        resultDataUrl = canvas.toDataURL('image/png');
      }
    } else if (activeTab === 'type') {
      if (typedName.trim()) {
        resultDataUrl = generateTypedSignatureDataUrl();
      }
    } else if (activeTab === 'upload') {
      if (uploadedImage) {
        resultDataUrl = uploadedImage;
      }
    }

    if (resultDataUrl) {
      onApplySignature(resultDataUrl);
      onClose();
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card animate-fade-in" style={{ width: '540px' }}>
        {/* Modal Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ fontWeight: 600, fontSize: '15px' }}>Dijital İmza Oluştur</div>
          <button onClick={onClose} className="btn-icon" style={{ width: '28px', height: '28px' }}>
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-tertiary)',
        }}>
          <button
            onClick={() => setActiveTab('draw')}
            className={`btn-ghost ${activeTab === 'draw' ? 'active' : ''}`}
            style={{ flex: 1, padding: '10px 0', borderRadius: 0 }}
          >
            <PenTool size={15} /> Çizerek İmzala
          </button>

          <button
            onClick={() => setActiveTab('type')}
            className={`btn-ghost ${activeTab === 'type' ? 'active' : ''}`}
            style={{ flex: 1, padding: '10px 0', borderRadius: 0 }}
          >
            <Type size={15} /> Yazarak Oluştur
          </button>

          <button
            onClick={() => setActiveTab('upload')}
            className={`btn-ghost ${activeTab === 'upload' ? 'active' : ''}`}
            style={{ flex: 1, padding: '10px 0', borderRadius: 0 }}
          >
            <Upload size={15} /> Resim Yükle
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px' }}>
          {/* Tab 1: Draw */}
          {activeTab === 'draw' && (
            <div>
              <div style={{
                border: '2px dashed var(--border-color)',
                borderRadius: 'var(--radius-md)',
                background: '#ffffff',
                height: '180px',
                position: 'relative',
                overflow: 'hidden',
              }}>
                <canvas
                  ref={canvasRef}
                  width={500}
                  height={180}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  style={{ width: '100%', height: '100%', cursor: 'crosshair' }}
                />
                {!hasDrawn && (
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#94a3b8',
                    pointerEvents: 'none',
                    fontSize: '13px',
                  }}>
                    Buraya imzanızı çizin...
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                {/* Ink Color */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Mürekkep:</span>
                  {['#0f172a', '#1e40af', '#047857', '#991b1b'].map((c) => (
                    <div
                      key={c}
                      onClick={() => setInkColor(c)}
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        backgroundColor: c,
                        cursor: 'pointer',
                        border: inkColor === c ? '2px solid var(--accent-primary)' : '1px solid transparent',
                        transform: inkColor === c ? 'scale(1.2)' : 'scale(1)',
                      }}
                    />
                  ))}
                </div>

                <button onClick={clearCanvas} className="btn-ghost" style={{ fontSize: '12px', color: 'var(--danger)' }}>
                  <Trash2 size={14} /> Temizle
                </button>
              </div>
            </div>
          )}

          {/* Tab 2: Type */}
          {activeTab === 'type' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <input
                type="text"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder="Adınızı veya imza metnini yazın..."
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />

              {/* Preview Box */}
              <div style={{
                background: '#ffffff',
                borderRadius: 'var(--radius-md)',
                height: '140px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--border-color)',
                color: inkColor,
                fontSize: '48px',
                fontFamily: selectedFont,
              }}>
                {typedName || 'İmzanız'}
              </div>

              {/* Handwriting font options */}
              <div style={{ display: 'flex', gap: '8px' }}>
                {[
                  { name: 'Stil 1 (Zarif)', font: "'Dancing Script', cursive" },
                  { name: 'Stil 2 (Klasik)', font: "'Brush Script MT', cursive, sans-serif" },
                ].map((item) => (
                  <button
                    key={item.name}
                    onClick={() => setSelectedFont(item.font)}
                    className={`btn-ghost ${selectedFont === item.font ? 'active' : ''}`}
                    style={{ flex: 1, fontSize: '12px', padding: '6px' }}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tab 3: Upload */}
          {activeTab === 'upload' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '100%',
                  height: '160px',
                  border: '2px dashed var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--bg-tertiary)',
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*';
                  input.onchange = (e: any) => {
                    if (e.target.files && e.target.files[0]) {
                      processUploadedImage(e.target.files[0]);
                    }
                  };
                  input.click();
                }}
              >
                {uploadedImage ? (
                  <img src={uploadedImage} alt="Signature preview" style={{ maxHeight: '90%', maxWidth: '90%', objectFit: 'contain' }} />
                ) : (
                  <>
                    <Upload size={28} color="var(--accent-primary)" />
                    <span style={{ marginTop: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                      İmza Görseli Seçin (PNG / JPG)
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Arka plan otomatik olarak şeffaflaştırılır
                    </span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
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
            onClick={handleApply}
            className="btn-primary"
            style={{ fontSize: '13px' }}
          >
            <Check size={16} /> İmzayı Ekle
          </button>
        </div>
      </div>
    </div>
  );
};
