import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, ChevronUp, ChevronDown, X, Loader2 } from 'lucide-react';
import { getSharedPdfDoc } from '../utils/pdfInit';
import type { PDFDocumentState, SearchMatch } from '../types/pdf';

interface SearchBarProps {
  isOpen: boolean;
  onClose: () => void;
  docState: PDFDocumentState;
  onMatchesFound: (matches: SearchMatch[], activeIndex: number) => void;
  onActiveMatchChange: (index: number) => void;
  activeMatchIndex: number;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  isOpen,
  onClose,
  docState,
  onMatchesFound,
  onActiveMatchChange,
  activeMatchIndex,
}) => {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [matchCase, setMatchCase] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onMatchesFoundRef = useRef(onMatchesFound);
  useEffect(() => {
    onMatchesFoundRef.current = onMatchesFound;
  });

  const performSearch = useCallback(async (searchTerm: string, isCaseSensitive: boolean) => {
    if (!docState.data) return;
    setIsSearching(true);

    try {
      const pdf = await getSharedPdfDoc(docState.data);
      if (!pdf) return;

      const results: SearchMatch[] = [];
      let matchCounter = 0;

      for (let pIdx = 0; pIdx < docState.pages.length; pIdx++) {
        const page = docState.pages[pIdx];
        if (page.isDeleted) continue;

        const pdfPage = await pdf.getPage(page.originalPageNumber);
        const textContent = await pdfPage.getTextContent();
        const unscaledViewport = pdfPage.getViewport({ scale: 1.0, rotation: page.rotation || 0 });

        textContent.items.forEach((item: any) => {
          if (!item.str) return;

          const itemText = isCaseSensitive ? item.str : item.str.toLowerCase();
          const target = isCaseSensitive ? searchTerm : searchTerm.toLowerCase();

          let startIndex = 0;
          let foundIndex: number;

          while ((foundIndex = itemText.indexOf(target, startIndex)) !== -1) {
            const tx = item.transform; // [scaleX, skewY, skewX, scaleY, transX, transY]
            const fontSize = Math.round(Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1]));
            const fontHeight = fontSize;
            const totalWidth = item.width || (item.str.length * fontSize * 0.55);
            const charWidth = totalWidth / Math.max(1, item.str.length);

            const matchX = tx[4] + foundIndex * charWidth;
            const matchY = unscaledViewport.height - tx[5] - fontHeight;
            const matchW = Math.max(12, target.length * charWidth);
            const matchH = Math.max(12, fontHeight * 1.15);

            results.push({
              matchIndex: matchCounter,
              pageIndex: page.pageIndex,
              pageNumber: page.displayPageNumber,
              text: item.str.substring(foundIndex, foundIndex + target.length),
              x: Math.round(matchX),
              y: Math.round(matchY),
              width: Math.round(matchW),
              height: Math.round(matchH),
            });

            matchCounter++;
            startIndex = foundIndex + target.length;
          }
        });
      }

      setMatches(results);
      const initialActive = results.length > 0 ? 0 : -1;
      onMatchesFoundRef.current(results, initialActive);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  }, [docState.data, docState.pages]);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Debounced search when query changes
  useEffect(() => {
    if (!isOpen || !docState.data) return;
    const cleanQuery = query.trim();
    if (!cleanQuery) return;

    const timer = setTimeout(() => {
      performSearch(cleanQuery, matchCase);
    }, 250);

    return () => clearTimeout(timer);
  }, [query, matchCase, docState.data, isOpen, performSearch]);

  const handleClose = () => {
    setQuery('');
    setMatches([]);
    onMatchesFoundRef.current([], -1);
    onClose();
  };

  const handleNextMatch = () => {
    if (matches.length === 0) return;
    const next = (activeMatchIndex + 1) % matches.length;
    onActiveMatchChange(next);
  };

  const handlePrevMatch = () => {
    if (matches.length === 0) return;
    const prev = (activeMatchIndex - 1 + matches.length) % matches.length;
    onActiveMatchChange(prev);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    } else if (e.key === 'Enter') {
      if (e.shiftKey) {
        handlePrevMatch();
      } else {
        handleNextMatch();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="glass-panel animate-fade-in"
      style={{
        position: 'absolute',
        top: '64px',
        right: '24px',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 10px',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-lg)',
        border: '1px solid var(--border-color)',
        minWidth: '320px',
      }}
    >
      <Search size={15} color="var(--text-muted)" style={{ flexShrink: 0 }} />

      <input
        ref={inputRef}
        type="text"
        placeholder="PDF içinde ara... (Enter ile sonraki)"
        value={query}
        onChange={(e) => {
          const val = e.target.value;
          setQuery(val);
          if (!val.trim()) {
            setMatches([]);
            onMatchesFoundRef.current([], -1);
          }
        }}
        onKeyDown={handleKeyDown}
        style={{
          flex: 1,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: 'var(--text-primary)',
          fontSize: '12px',
        }}
      />

      {/* Case Sensitive Toggle */}
      <button
        onClick={() => setMatchCase(!matchCase)}
        className={`btn-icon ${matchCase ? 'active' : ''}`}
        style={{ width: '24px', height: '24px', fontSize: '10px', fontWeight: 700 }}
        data-tooltip="Büyük/Küçük Harf Duyarlı (Aa)"
      >
        Aa
      </button>

      {/* Match Counter Badge */}
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', minWidth: '60px', textAlign: 'center' }}>
        {isSearching ? (
          <Loader2 size={12} className="animate-spin" style={{ margin: '0 auto' }} />
        ) : query.trim() ? (
          matches.length > 0 ? (
            <span style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>
              {activeMatchIndex + 1} / {matches.length}
            </span>
          ) : (
            <span style={{ color: 'var(--danger)' }}>Sonuç yok</span>
          )
        ) : null}
      </div>

      {/* Navigation Buttons */}
      <button
        onClick={handlePrevMatch}
        disabled={matches.length === 0}
        className="btn-icon"
        style={{ width: '24px', height: '24px' }}
        data-tooltip="Önceki Eşleşme (Shift+Enter)"
      >
        <ChevronUp size={14} />
      </button>

      <button
        onClick={handleNextMatch}
        disabled={matches.length === 0}
        className="btn-icon"
        style={{ width: '24px', height: '24px' }}
        data-tooltip="Sonraki Eşleşme (Enter)"
      >
        <ChevronDown size={14} />
      </button>

      <div style={{ width: '1px', height: '16px', background: 'var(--border-color)' }} />

      <button
        onClick={handleClose}
        className="btn-icon"
        style={{ width: '24px', height: '24px' }}
        data-tooltip="Kapat (Esc)"
      >
        <X size={14} />
      </button>
    </div>
  );
};
