import { describe, it, expect, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { DocumentTabs, type DocumentTabItem } from '../components/DocumentTabs';

const sampleTabs: DocumentTabItem[] = [
  {
    id: 'tab-1',
    filename: 'Sozlesme.pdf',
    filePath: '/docs/Sozlesme.pdf',
    docState: {
      filename: 'Sozlesme.pdf',
      fileSize: 1024,
      data: null,
      numPages: 1,
      pages: [],
      pageOrder: [0],
      annotations: {},
    },
    currentPageIndex: 0,
    isDirty: false,
  },
  {
    id: 'tab-2',
    filename: 'Fatura.pdf',
    filePath: '/docs/Fatura.pdf',
    docState: {
      filename: 'Fatura.pdf',
      fileSize: 2048,
      data: null,
      numPages: 2,
      pages: [],
      pageOrder: [0, 1],
      annotations: {},
    },
    currentPageIndex: 1,
    isDirty: true,
  },
];

describe('DocumentTabs Component', () => {
  it('should render all tab titles and dirty indicator', () => {
    const container = document.createElement('div');
    const root = createRoot(container);

    act(() => {
      root.render(
        <DocumentTabs
          tabs={sampleTabs}
          activeTabId="tab-1"
          onSelectTab={() => {}}
          onCloseTab={() => {}}
          onNewTab={() => {}}
        />
      );
    });

    expect(container.textContent).toContain('Sozlesme.pdf');
    expect(container.textContent).toContain('Fatura.pdf');
  });

  it('should trigger onSelectTab when clicking a tab', () => {
    const handleSelect = vi.fn();
    const container = document.createElement('div');
    const root = createRoot(container);

    act(() => {
      root.render(
        <DocumentTabs
          tabs={sampleTabs}
          activeTabId="tab-1"
          onSelectTab={handleSelect}
          onCloseTab={() => {}}
          onNewTab={() => {}}
        />
      );
    });

    const tabs = container.querySelectorAll('[role="tab"]');
    expect(tabs.length).toBe(2);

    act(() => {
      (tabs[1] as HTMLElement).click();
    });

    expect(handleSelect).toHaveBeenCalledWith('tab-2');
  });

  it('should trigger onNewTab when clicking plus button', () => {
    const handleNew = vi.fn();
    const container = document.createElement('div');
    const root = createRoot(container);

    act(() => {
      root.render(
        <DocumentTabs
          tabs={sampleTabs}
          activeTabId="tab-1"
          onSelectTab={() => {}}
          onCloseTab={() => {}}
          onNewTab={handleNew}
        />
      );
    });

    const plusBtn = container.querySelector('button[title*="Yeni Belge"]');
    expect(plusBtn).not.toBeNull();

    act(() => {
      (plusBtn as HTMLButtonElement).click();
    });

    expect(handleNew).toHaveBeenCalledTimes(1);
  });
});
