import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { CommentsPanel } from '../components/CommentsPanel';
import { FormsPanel } from '../components/FormsPanel';
import type { FormFieldInfo, PdfComment } from '../types/pdf';

const comments: PdfComment[] = [
  {
    id: 'cmt-1',
    pageIndex: 0,
    kind: 'note',
    rect: { x: 10, y: 20, width: 20, height: 20 },
    contents: 'Lütfen kontrol edin',
    author: 'Denetçi',
    modified: 'D:20260101120000Z',
  },
  {
    id: 'cmt-2',
    pageIndex: 1,
    kind: 'note',
    rect: { x: 10, y: 20, width: 20, height: 20 },
    contents: 'Yanıt',
    author: 'Yönetici',
    parentId: 'cmt-1',
  },
];

const fields: FormFieldInfo[] = [
  {
    name: 'Ad Soyad',
    kind: 'text',
    value: 'Ali Veli',
    options: [],
    readOnly: false,
    required: true,
    multiline: false,
    pageIndex: 0,
  },
  {
    name: 'Onay',
    kind: 'checkbox',
    value: false,
    options: [],
    readOnly: false,
    required: false,
    multiline: false,
    pageIndex: 0,
  },
  {
    name: 'Ulke',
    kind: 'dropdown',
    value: 'Turkiye',
    options: ['Turkiye', 'Almanya'],
    readOnly: false,
    required: false,
    multiline: false,
    pageIndex: 0,
  },
];

import { setLocale } from '../utils/i18n';

describe('CommentsPanel', () => {
  beforeEach(() => setLocale('tr'));

  it('lists the comments of the document', () => {
    const container = document.createElement('div');
    const root = createRoot(container);

    act(() => {
      root.render(
        <CommentsPanel
          comments={comments}
          currentPageIndex={0}
          onJumpToPage={() => {}}
          onAddComment={() => {}}
          onSetStatus={() => {}}
          onDeleteComment={() => {}}
          onStartCommentTool={() => {}}
        />,
      );
    });

    expect(container.textContent).toContain('Lütfen kontrol edin');
    expect(container.textContent).toContain('Denetçi');
    // The reply is nested under its comment, so it is listed as well.
    expect(container.textContent).toContain('Yanıt');
    expect(container.textContent).toContain('1 yanıt');
  });

  it('reports a deleted comment', () => {
    const handleDelete = vi.fn();
    const container = document.createElement('div');
    const root = createRoot(container);

    act(() => {
      root.render(
        <CommentsPanel
          comments={comments}
          currentPageIndex={0}
          onJumpToPage={() => {}}
          onAddComment={() => {}}
          onSetStatus={() => {}}
          onDeleteComment={handleDelete}
          onStartCommentTool={() => {}}
        />,
      );
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    const trash = buttons.find((b) => b.querySelector('svg') && b.textContent === '' && b.innerHTML.includes('lucide-trash-2'));
    expect(trash).toBeDefined();

    act(() => {
      (trash as HTMLButtonElement).click();
    });

    expect(handleDelete).toHaveBeenCalledWith('cmt-1');
  });

  it('starts the comment tool when the user asks for a new comment', () => {
    const handleStart = vi.fn();
    const container = document.createElement('div');
    const root = createRoot(container);

    act(() => {
      root.render(
        <CommentsPanel
          comments={comments}
          currentPageIndex={0}
          onJumpToPage={() => {}}
          onAddComment={() => {}}
          onSetStatus={() => {}}
          onDeleteComment={() => {}}
          onStartCommentTool={handleStart}
        />,
      );
    });

    const add = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Ekle'));
    expect(add).toBeDefined();

    act(() => {
      (add as HTMLButtonElement).click();
    });

    expect(handleStart).toHaveBeenCalled();
  });
});

describe('FormsPanel', () => {
  it('lists the fields of the form with their values', () => {
    const container = document.createElement('div');
    const root = createRoot(container);

    act(() => {
      root.render(
        <FormsPanel
          fields={fields}
          values={{}}
          onChange={() => {}}
          onJumpToPage={() => {}}
        />,
      );
    });

    expect(container.textContent).toContain('Ad Soyad');
    expect(container.textContent).toContain('Onay');
    expect(container.textContent).toContain('Ulke');
    expect(container.textContent).toContain('Turkiye');
  });

  it('reports the value that was typed into a text field', () => {
    const handleChange = vi.fn();
    const container = document.createElement('div');
    const root = createRoot(container);

    act(() => {
      root.render(
        <FormsPanel
          fields={fields}
          values={{}}
          onChange={handleChange}
          onJumpToPage={() => {}}
        />,
      );
    });

    const textarea = container.querySelector('textarea');
    expect(textarea).not.toBeNull();

    act(() => {
      const input = textarea as HTMLTextAreaElement;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(input, 'Yeni Ad');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(handleChange).toHaveBeenCalledWith('Ad Soyad', 'Yeni Ad');
  });

  it('says so when the document has no form', () => {
    const container = document.createElement('div');
    const root = createRoot(container);

    act(() => {
      root.render(
        <FormsPanel fields={[]} values={{}} onChange={() => {}} onJumpToPage={() => {}} />,
      );
    });

    expect(container.textContent).toContain('etkileşimli form alanı yok');
  });
});
