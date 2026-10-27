import React, { useState } from 'react';
import { Hash, Layers, Ruler, X } from 'lucide-react';
import type {
  PageBoxKind,
  PageBoxSettings,
  PageLabelRange,
  PageLabelStyle,
  PageTransition,
  PageTransitionStyle,
  PDFDocumentState,
} from '../types/pdf';

interface PageSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  docState: PDFDocumentState;
  /** Called with the new page setup; it is written when the file is saved. */
  onApply: (setup: {
    pageLabels: PageLabelRange[];
    pageTransitions: PageTransition[];
    pageBoxes: PageBoxSettings[];
  }) => void;
  onShowToast?: (text: string, type?: 'success' | 'error' | 'info') => void;
}

type Section = 'labels' | 'transitions' | 'boxes';

/** The numbering styles a page label can use. */
const LABEL_STYLES: Array<{ value: PageLabelStyle; label: string }> = [
  { value: 'D', label: '1, 2, 3' },
  { value: 'R', label: 'I, II, III' },
  { value: 'r', label: 'i, ii, iii' },
  { value: 'A', label: 'A, B, C' },
  { value: 'a', label: 'a, b, c' },
];

/** The transition effects a page can carry. */
const TRANSITION_STYLES: Array<{ value: PageTransitionStyle; label: string }> = [
  { value: 'Fade', label: 'Solma (Fade)' },
  { value: 'Split', label: 'Bölünme (Split)' },
  { value: 'Blinds', label: 'Jaluz (Blinds)' },
  { value: 'Box', label: 'Kutu (Box)' },
  { value: 'Wipe', label: 'Süpürme (Wipe)' },
  { value: 'Dissolve', label: 'Dağılma (Dissolve)' },
  { value: 'Glitter', label: 'Prizma (Glitter)' },
  { value: 'Fly', label: 'Uçuş (Fly)' },
  { value: 'Push', label: 'İtme (Push)' },
  { value: 'Cover', label: 'Örtme (Cover)' },
  { value: 'Uncover', label: 'Açma (Uncover)' },
];

/** The boxes a page can carry besides its media box. */
const BOX_KINDS: Array<{ value: PageBoxKind; label: string }> = [
  { value: 'CropBox', label: 'Kırpma (Crop)' },
  { value: 'TrimBox', label: 'Baskı (Trim)' },
  { value: 'BleedBox', label: 'Taşma (Bleed)' },
  { value: 'ArtBox', label: 'Sanat (Art)' },
];

/** The number a label style writes for a number. */
function labelFor(style: PageLabelStyle, number: number): string {
  if (style === 'D') return String(number);
  if (style === 'R' || style === 'r') {
    const roman: Array<[number, string]> = [
      [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
      [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
    ];
    let value = number;
    let out = '';
    for (const [amount, symbol] of roman) {
      while (value >= amount) {
        out += symbol;
        value -= amount;
      }
    }
    return style === 'r' ? out.toLowerCase() : out;
  }
  // Letters: A, B, ... Z, AA, AB, ...
  let value = number;
  let out = '';
  while (value > 0) {
    const rest = (value - 1) % 26;
    out = String.fromCharCode(65 + rest) + out;
    value = Math.floor((value - 1) / 26);
  }
  return style === 'a' ? out.toLowerCase() : out;
}

/**
 * The page setup of the document: labels, transitions and boxes.
 *
 * All three are written into the file when the document is saved, so a
 * reader sees the page numbers, the transitions and the print boxes that
 * were set here.
 */
export const PageSetupModal: React.FC<PageSetupModalProps> = ({
  isOpen,
  onClose,
  docState,
  onApply,
  onShowToast,
}) => {
  const [section, setSection] = useState<Section>('labels');
  // The modal is mounted afresh every time it opens, so the state starts
  // from the document as it is.
  const [labels, setLabels] = useState<PageLabelRange[]>(() => docState.pageLabels ?? []);
  const [transitions, setTransitions] = useState<PageTransition[]>(() => docState.pageTransitions ?? []);
  const [boxes, setBoxes] = useState<PageBoxSettings[]>(() => docState.pageBoxes ?? []);

  if (!isOpen) return null;

  const totalPages = docState.pageOrder.length;

  const inputStyle: React.CSSProperties = {
    fontSize: '12px',
    padding: '5px 8px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
  };

  const fieldLabel = (text: string) => (
    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
      {text}
    </label>
  );

  const apply = () => {
    onApply({ pageLabels: labels, pageTransitions: transitions, pageBoxes: boxes });
    onShowToast?.('Sayfa ayarları kaydedildi; dosyayı kaydedin.', 'success');
    onClose();
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card animate-fade-in" style={{ width: '620px', maxHeight: '85vh', overflow: 'auto' }}>
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontWeight: 600, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} color="var(--accent-primary)" />
            Sayfa Ayarları
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Kapat">
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '14px 20px' }}>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
            {([
              { key: 'labels', text: 'Sayfa Etiketleri', icon: <Hash size={13} /> },
              { key: 'transitions', text: 'Geçişler', icon: <Layers size={13} /> },
              { key: 'boxes', text: 'Sayfa Kutuları', icon: <Ruler size={13} /> },
            ] as Array<{ key: Section; text: string; icon: React.ReactNode }>).map((tab) => (
              <button
                key={tab.key}
                className={`btn-ghost ${section === tab.key ? 'active' : ''}`}
                style={{ flex: 1, fontSize: '11.5px', justifyContent: 'center', gap: '5px' }}
                onClick={() => setSection(tab.key)}
              >
                {tab.icon}
                {tab.text}
              </button>
            ))}
          </div>

          {section === 'labels' && (
            <div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.55, marginTop: 0 }}>
                Sayfalara i, ii, 1, 2 gibi etiketler verin. Etiketler PDF'in içine yazılır, okuyucu
                sayfa numarasını bu etiketten okur.
              </p>

              {labels.map((range, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: '6px',
                    marginBottom: '8px',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ width: 76 }}>
                    {fieldLabel('Sayfa')}
                    <input
                      type="number"
                      min={1}
                      value={range.startPage + 1}
                      onChange={(e) => {
                        const value = Math.max(1, Number(e.target.value) || 1) - 1;
                        setLabels((prev) => prev.map((r, i) => (i === index ? { ...r, startPage: value } : r)));
                      }}
                      style={{ ...inputStyle, width: '100%' }}
                    />
                  </div>
                  <div style={{ width: 120 }}>
                    {fieldLabel('Biçim')}
                    <select
                      value={range.style}
                      onChange={(e) => {
                        const value = e.target.value as PageLabelStyle;
                        setLabels((prev) => prev.map((r, i) => (i === index ? { ...r, style: value } : r)));
                      }}
                      style={{ ...inputStyle, width: '100%' }}
                    >
                      {LABEL_STYLES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ width: 76 }}>
                    {fieldLabel('İlk sayı')}
                    <input
                      type="number"
                      min={1}
                      value={range.first}
                      onChange={(e) => {
                        const value = Math.max(1, Number(e.target.value) || 1);
                        setLabels((prev) => prev.map((r, i) => (i === index ? { ...r, first: value } : r)));
                      }}
                      style={{ ...inputStyle, width: '100%' }}
                    />
                  </div>
                  <div style={{ width: 90 }}>
                    {fieldLabel('Ön ek')}
                    <input
                      value={range.prefix ?? ''}
                      placeholder="Ön ek"
                      onChange={(e) => {
                        const value = e.target.value;
                        setLabels((prev) => prev.map((r, i) => (i === index ? { ...r, prefix: value } : r)));
                      }}
                      style={{ ...inputStyle, width: '100%' }}
                    />
                  </div>
                  <button
                    className="btn-ghost"
                    style={{ fontSize: '11px', color: '#f43f5e' }}
                    onClick={() => setLabels((prev) => prev.filter((_, i) => i !== index))}
                  >
                    Sil
                  </button>
                </div>
              ))}

              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px' }}>
                <button
                  className="btn-ghost"
                  style={{ fontSize: '11.5px' }}
                  onClick={() =>
                    setLabels((prev) => [
                      ...prev,
                      { startPage: prev.length ? prev[prev.length - 1]!.startPage + 1 : 0, style: 'D', first: 1 },
                    ])
                  }
                >
                  + Aralık ekle
                </button>
                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                  Örnek: {labels.length
                    ? labels
                        .map((r) => `${r.prefix ?? ''}${labelFor(r.style, r.first)}`)
                        .join(', ')
                    : '—'}
                </span>
              </div>
            </div>
          )}

          {section === 'transitions' && (
            <div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.55, marginTop: 0 }}>
                Sayfalar arasına geçiş efekti ekleyin. Efekt, sunum modunda ve tam ekran okumada
                görünür.
              </p>

              <TransitionEditor
                transitions={transitions}
                totalPages={totalPages}
                onChange={setTransitions}
              />
            </div>
          )}

          {section === 'boxes' && (
            <div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.55, marginTop: 0 }}>
                Sayfanın kırpma, baskı, taşma ve sanat kutularını medya kutusundan ölçerek
                ayarlayın. Baskı için kırpma ve baskı kutuları kullanılır.
              </p>

              <BoxEditor boxes={boxes} totalPages={totalPages} onChange={setBoxes} />
            </div>
          )}
        </div>

        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
          }}
        >
          <button className="btn-ghost" onClick={onClose}>
            Vazgeç
          </button>
          <button className="btn-primary" onClick={apply}>
            Uygula
          </button>
        </div>
      </div>
    </div>
  );
};

/** The editor of the page transitions. */
function TransitionEditor({
  transitions,
  totalPages,
  onChange,
}: {
  transitions: PageTransition[];
  totalPages: number;
  onChange: (next: PageTransition[]) => void;
}) {
  const [style, setStyle] = useState<PageTransitionStyle>('Fade');
  const [duration, setDuration] = useState(1);
  const [page, setPage] = useState(0);

  const apply = () => {
    const next = transitions.filter((t) => t.pageIndex !== page);
    next.push({ pageIndex: page, style, duration });
    onChange(next.sort((a, b) => a.pageIndex - b.pageIndex));
  };

  const inputStyle: React.CSSProperties = {
    fontSize: '12px',
    padding: '5px 8px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
        <div style={{ width: 150 }}>
          <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
            Efekt
          </label>
          <select value={style} onChange={(e) => setStyle(e.target.value as PageTransitionStyle)} style={{ ...inputStyle, width: '100%' }}>
            {TRANSITION_STYLES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div style={{ width: 90 }}>
          <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
            Süre (sn)
          </label>
          <input
            type="number"
            min={0.1}
            step={0.1}
            value={duration}
            onChange={(e) => setDuration(Math.max(0.1, Number(e.target.value) || 1))}
            style={{ ...inputStyle, width: '100%' }}
          />
        </div>
        <div style={{ width: 110 }}>
          <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
            Sayfa
          </label>
          <select value={page} onChange={(e) => setPage(Number(e.target.value))} style={{ ...inputStyle, width: '100%' }}>
            {Array.from({ length: Math.max(1, totalPages) }, (_, i) => (
              <option key={i} value={i}>
                Sayfa {i + 1}
              </option>
            ))}
          </select>
        </div>
        <button className="btn-ghost" style={{ fontSize: '11.5px' }} onClick={apply}>
          Uygula
        </button>
        <button
          className="btn-ghost"
          style={{ fontSize: '11.5px' }}
          onClick={() => {
            const next = transitions.filter((t) => t.pageIndex !== page);
            onChange(next);
          }}
        >
          Sayfadan kaldır
        </button>
      </div>

      <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
        {transitions.length === 0
          ? 'Henüz geçiş yok.'
          : `${transitions.length} sayfada geçiş tanımlı.`}
      </div>
    </div>
  );
}

/** The editor of the page boxes. */
function BoxEditor({
  boxes,
  totalPages,
  onChange,
}: {
  boxes: PageBoxSettings[];
  totalPages: number;
  onChange: (next: PageBoxSettings[]) => void;
}) {
  const [page, setPage] = useState(0);
  const [kind, setKind] = useState<PageBoxKind>('CropBox');

  const current = boxes.find((b) => b.pageIndex === page && b.box === kind);
  const margins = {
    left: current?.left ?? 0,
    bottom: current?.bottom ?? 0,
    right: current?.right ?? 0,
    top: current?.top ?? 0,
  };

  const inputStyle: React.CSSProperties = {
    fontSize: '12px',
    padding: '5px 8px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    width: '100%',
  };

  const setMargin = (key: 'left' | 'bottom' | 'right' | 'top', value: number) => {
    const next = boxes.filter((b) => !(b.pageIndex === page && b.box === kind));
    next.push({ pageIndex: page, box: kind, ...margins, [key]: Math.max(0, value) });
    onChange(next);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
        <div style={{ width: 110 }}>
          <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
            Sayfa
          </label>
          <select value={page} onChange={(e) => setPage(Number(e.target.value))} style={inputStyle}>
            {Array.from({ length: Math.max(1, totalPages) }, (_, i) => (
              <option key={i} value={i}>
                Sayfa {i + 1}
              </option>
            ))}
          </select>
        </div>
        <div style={{ width: 160 }}>
          <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
            Kutu
          </label>
          <select value={kind} onChange={(e) => setKind(e.target.value as PageBoxKind)} style={inputStyle}>
            {BOX_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
        {(['left', 'right', 'top', 'bottom'] as const).map((key) => (
          <div key={key}>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              {key === 'left' ? 'Sol' : key === 'right' ? 'Sağ' : key === 'top' ? 'Üst' : 'Alt'} (pt)
            </label>
            <input
              type="number"
              min={0}
              value={Math.round(margins[key] * 100) / 100}
              onChange={(e) => setMargin(key, Number(e.target.value) || 0)}
              style={inputStyle}
            />
          </div>
        ))}
      </div>

      <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '10px' }}>
        {boxes.length === 0 ? 'Henüz kutu ayarı yok.' : `${boxes.length} kutu ayarı var.`}
      </div>
    </div>
  );
}
