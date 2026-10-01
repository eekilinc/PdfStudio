import { describe, it, expect } from 'vitest';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { usePdfHistory, MAX_HISTORY_LENGTH } from '../hooks/usePdfHistory';
import type { PDFDocumentState } from '../types/pdf';

const makeDoc = (filename: string): PDFDocumentState => ({
  filename,
  fileSize: 1000,
  data: null,
  numPages: 1,
  pages: [],
  pageOrder: [0],
  annotations: {},
});

/** Mount the hook in a throwaway root and hand back a live handle to it. */
function mountHistory(initial: PDFDocumentState) {
  const handle: { current: ReturnType<typeof usePdfHistory> | null } = { current: null };

  function TestComponent() {
    const res = usePdfHistory(initial);
    useEffect(() => {
      handle.current = res;
    });
    return null;
  }

  const container = document.createElement('div');
  let root: Root | null = null;
  act(() => {
    root = createRoot(container);
    root.render(<TestComponent />);
  });

  return {
    get current() {
      // Non-null by construction: the component rendered at least once.
      return handle.current!;
    },
    run(fn: (h: ReturnType<typeof usePdfHistory>) => void) {
      act(() => {
        fn(handle.current!);
      });
    },
    destroy() {
      act(() => {
        root?.unmount();
      });
    },
  };
}

describe('usePdfHistory', () => {
  it('starts clean with no undo or redo available', () => {
    const h = mountHistory(makeDoc('a.pdf'));
    expect(h.current.docState.filename).toBe('a.pdf');
    expect(h.current.canUndo).toBe(false);
    expect(h.current.canRedo).toBe(false);
    expect(h.current.isDirty).toBe(false);
    h.destroy();
  });

  it('records an update as a single undo step and marks the document dirty', () => {
    const h = mountHistory(makeDoc('a.pdf'));
    h.run((s) => s.updateDocWithHistory(() => makeDoc('b.pdf')));

    expect(h.current.docState.filename).toBe('b.pdf');
    expect(h.current.canUndo).toBe(true);
    expect(h.current.canRedo).toBe(false);
    expect(h.current.isDirty).toBe(true);
    h.destroy();
  });

  it('round-trips through undo and redo', () => {
    const h = mountHistory(makeDoc('a.pdf'));
    h.run((s) => s.updateDocWithHistory(() => makeDoc('b.pdf')));

    h.run((s) => s.undo());
    expect(h.current.docState.filename).toBe('a.pdf');
    expect(h.current.canUndo).toBe(false);
    expect(h.current.canRedo).toBe(true);

    h.run((s) => s.redo());
    expect(h.current.docState.filename).toBe('b.pdf');
    expect(h.current.canUndo).toBe(true);
    expect(h.current.canRedo).toBe(false);
    h.destroy();
  });

  it('invokes the undo/redo callbacks exactly once each', () => {
    const h = mountHistory(makeDoc('a.pdf'));
    h.run((s) => s.updateDocWithHistory(() => makeDoc('b.pdf')));

    let undoCalls = 0;
    h.run((s) => s.undo(() => { undoCalls += 1; }));
    expect(undoCalls).toBe(1);

    // No further step available, so a second undo must be a no-op.
    h.run((s) => s.undo(() => { undoCalls += 1; }));
    expect(undoCalls).toBe(1);
    h.destroy();
  });

  it('does not run callbacks when the stack is already at the boundary', () => {
    const h = mountHistory(makeDoc('a.pdf'));
    let calls = 0;
    h.run((s) => {
      s.undo(() => { calls += 1; });
      s.redo(() => { calls += 1; });
    });
    expect(calls).toBe(0);
    expect(h.current.docState.filename).toBe('a.pdf');
    h.destroy();
  });

  it('drops the redo tail when a new edit lands after an undo', () => {
    const h = mountHistory(makeDoc('a.pdf'));
    h.run((s) => s.updateDocWithHistory(() => makeDoc('b.pdf')));
    h.run((s) => s.updateDocWithHistory(() => makeDoc('c.pdf')));
    h.run((s) => s.undo());
    expect(h.current.canRedo).toBe(true);

    // Branching off the undone state must discard the "c" future.
    h.run((s) => s.updateDocWithHistory(() => makeDoc('d.pdf')));
    expect(h.current.docState.filename).toBe('d.pdf');
    expect(h.current.canRedo).toBe(false);

    h.run((s) => s.undo());
    expect(h.current.docState.filename).toBe('b.pdf');

    // Redoing lands on the branch that was taken, never back on the abandoned
    // "c" — proof the future was discarded rather than merely hidden.
    h.run((s) => s.redo());
    expect(h.current.docState.filename).toBe('d.pdf');
    expect(h.current.canRedo).toBe(false);
    h.destroy();
  });

  it('keeps the stack consistent for two updates batched in one tick', () => {
    // Regression: the previous implementation read a stale cursor from the
    // render closure while slicing, so batching two updates could leave the
    // cursor past the end of the stack and break canRedo/undo.
    const h = mountHistory(makeDoc('a.pdf'));
    h.run((s) => {
      s.updateDocWithHistory(() => makeDoc('b.pdf'));
      s.updateDocWithHistory(() => makeDoc('c.pdf'));
    });

    expect(h.current.docState.filename).toBe('c.pdf');
    expect(h.current.canUndo).toBe(true);
    expect(h.current.canRedo).toBe(false);

    h.run((s) => s.undo());
    expect(h.current.docState.filename).toBe('b.pdf');
    h.run((s) => s.undo());
    expect(h.current.docState.filename).toBe('a.pdf');
    expect(h.current.canUndo).toBe(false);
    h.destroy();
  });

  it('opens a recoverable step for a gesture started on a pristine document', () => {
    const h = mountHistory(makeDoc('a.pdf'));
    h.run((s) => {
      // A drag as the very first edit of a session.
      for (let i = 1; i <= 5; i += 1) {
        s.updateDocInPlace(() => makeDoc(`drag-${i}.pdf`), 'drag:ann-1');
      }
    });

    expect(h.current.docState.filename).toBe('drag-5.pdf');
    // Exactly one step was consumed by the whole gesture, and the pristine
    // document is still reachable behind it.
    expect(h.current.canUndo).toBe(true);
    h.run((s) => s.undo());
    expect(h.current.docState.filename).toBe('a.pdf');
    expect(h.current.canUndo).toBe(false);
    h.destroy();
  });

  it('keeps a discrete edit out of a gesture that is still open', () => {
    // Keying the gesture explicitly stops a following discrete action from
    // being swallowed into the open step.
    const h = mountHistory(makeDoc('a.pdf'));
    h.run((s) => {
      s.updateDocInPlace(() => makeDoc('dragged.pdf'), 'drag:ann-1');
    });
    expect(h.current.canUndo).toBe(true);

    h.run((s) => s.updateDocWithHistory(() => makeDoc('deleted.pdf')));
    expect(h.current.docState.filename).toBe('deleted.pdf');

    // Two distinct steps: the discrete edit, then the drag behind it.
    h.run((s) => s.undo());
    expect(h.current.docState.filename).toBe('dragged.pdf');
    h.run((s) => s.undo());
    expect(h.current.docState.filename).toBe('a.pdf');
    expect(h.current.canUndo).toBe(false);
    h.destroy();
  });

  it('opens a separate step for two gestures with different keys', () => {
    const h = mountHistory(makeDoc('a.pdf'));
    h.run((s) => {
      s.updateDocInPlace(() => makeDoc('drag-a.pdf'), 'drag:ann-1');
      s.updateDocInPlace(() => makeDoc('drag-b.pdf'), 'drag:ann-2');
    });

    // Two different annotations dragged: two undo steps, not one.
    h.run((s) => s.undo());
    expect(h.current.docState.filename).toBe('drag-a.pdf');
    h.run((s) => s.undo());
    expect(h.current.docState.filename).toBe('a.pdf');
    h.destroy();
  });

  it('closes an open gesture on undo so the next edit starts fresh', () => {
    const h = mountHistory(makeDoc('a.pdf'));
    h.run((s) => s.updateDocInPlace(() => makeDoc('dragged.pdf'), 'drag:ann-1'));
    h.run((s) => s.undo());
    h.run((s) => s.redo());

    // Reusing the same key after a redo must not merge into the restored step.
    h.run((s) => s.updateDocInPlace(() => makeDoc('dragged-again.pdf'), 'drag:ann-1'));
    expect(h.current.docState.filename).toBe('dragged-again.pdf');
    expect(h.current.canRedo).toBe(false);
    h.destroy();
  });

  it('caps retained snapshots at MAX_HISTORY_LENGTH', () => {
    const h = mountHistory(makeDoc('start.pdf'));
    h.run((s) => {
      for (let i = 0; i < MAX_HISTORY_LENGTH + 50; i += 1) {
        s.updateDocWithHistory(() => makeDoc(`v${i}.pdf`));
      }
    });

    // Undo everything that is still retained; the cursor must land exactly on
    // the oldest surviving snapshot rather than walking off the front.
    let steps = 0;
    while (h.current.canUndo) {
      h.run((s) => s.undo());
      steps += 1;
    }
    expect(steps).toBe(MAX_HISTORY_LENGTH - 1);
    expect(h.current.docState.filename).toBe('v50.pdf');
    h.destroy();
  });

  it('treats an unchanged updater as a no-op', () => {
    const h = mountHistory(makeDoc('a.pdf'));
    h.run((s) => {
      s.updateDocWithHistory((prev) => prev);
      s.updateDocInPlace((prev) => prev, 'drag:ann-1');
    });
    expect(h.current.canUndo).toBe(false);
    expect(h.current.isDirty).toBe(false);
    h.destroy();
  });

  it('clears the dirty flag on save and re-raises it on the next edit', () => {
    const h = mountHistory(makeDoc('a.pdf'));
    h.run((s) => s.updateDocWithHistory(() => makeDoc('b.pdf')));
    expect(h.current.isDirty).toBe(true);

    h.run((s) => s.markSaved());
    expect(h.current.isDirty).toBe(false);

    h.run((s) => s.updateDocWithHistory(() => makeDoc('c.pdf')));
    expect(h.current.isDirty).toBe(true);
    h.destroy();
  });

  it('reports clean when the history cursor returns to the saved snapshot', () => {
    const h = mountHistory(makeDoc('a.pdf'));
    h.run((s) => s.updateDocWithHistory(() => makeDoc('b.pdf')));
    h.run((s) => s.updateDocWithHistory(() => makeDoc('c.pdf')));
    h.run((s) => s.markSaved());
    expect(h.current.isDirty).toBe(false);

    // Stepping back off the saved state is an unsaved change.
    h.run((s) => s.undo());
    expect(h.current.docState.filename).toBe('b.pdf');
    expect(h.current.isDirty).toBe(true);

    // Returning to the saved snapshot means nothing is pending any more.
    h.run((s) => s.redo());
    expect(h.current.docState.filename).toBe('c.pdf');
    expect(h.current.isDirty).toBe(false);
    h.destroy();
  });

  it('stays dirty when a gesture rewrites the snapshot at the saved position', () => {
    // Regression guard for the reference-based dirty check: a gesture that
    // starts from a saved document replaces the snapshot sitting at the saved
    // position, which an index-based check would have reported as "clean".
    const h = mountHistory(makeDoc('a.pdf'));
    h.run((s) => s.updateDocInPlace(() => makeDoc('dragged.pdf'), 'drag:ann-1'));
    expect(h.current.isDirty).toBe(true);
    expect(h.current.canUndo).toBe(true);
    h.destroy();
  });

  it('markDirty flags divergence without opening an undo step', () => {
    const h = mountHistory(makeDoc('a.pdf'));
    h.run((s) => s.markDirty());
    expect(h.current.isDirty).toBe(true);
    expect(h.current.canUndo).toBe(false);

    h.run((s) => s.markSaved());
    expect(h.current.isDirty).toBe(false);
    h.destroy();
  });

  it('updateDocSilently changes the document without touching the stack', () => {
    const h = mountHistory(makeDoc('a.pdf'));
    h.run((s) => s.updateDocSilently((prev) => ({ ...prev, filename: 'renamed.pdf' })));
    expect(h.current.docState.filename).toBe('renamed.pdf');
    expect(h.current.canUndo).toBe(false);

    h.run((s) => s.markSaved());
    expect(h.current.isDirty).toBe(false);
    h.destroy();
  });

  it('initHistory discards prior history and resets the dirty flag', () => {
    const h = mountHistory(makeDoc('a.pdf'));
    h.run((s) => s.updateDocWithHistory(() => makeDoc('b.pdf')));
    h.run((s) => s.updateDocWithHistory(() => makeDoc('c.pdf')));
    expect(h.current.canUndo).toBe(true);

    h.run((s) => s.initHistory(makeDoc('fresh.pdf')));
    expect(h.current.docState.filename).toBe('fresh.pdf');
    expect(h.current.canUndo).toBe(false);
    expect(h.current.canRedo).toBe(false);
    expect(h.current.isDirty).toBe(false);
    h.destroy();
  });
});
