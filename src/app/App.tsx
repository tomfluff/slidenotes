import { useEffect } from 'react';
import { useSettings } from './settings';
import { Resizer } from './Resizer';
import { useStore } from './store';
import { applySettings } from './settings';
import { Header } from './Header';
import { Footer } from './Footer';
import { Toasts } from './Toasts';
import { Landing } from '@/features/deck/Landing';
import { Filmstrip } from '@/features/review/Filmstrip';
import { Stage } from '@/features/review/Stage';
import { CommentPanel } from '@/features/review/CommentPanel';
import { Sheet } from '@/features/sheet/Sheet';
import { ACCEPT, useImport } from '@/features/deck/useImport';
import { PptxDialog } from '@/features/deck/PptxDialog';
import { takePending } from '@/features/deck/pptx';
import { useRef } from 'react';

export function App() {
  const ready = useStore((s) => s.ready);
  const deck = useStore((s) => s.deck);
  const view = useStore((s) => s.view);
  const dirty = useStore((s) => s.dirty);
  const init = useStore((s) => s.init);
  const step = useStore((s) => s.step);
  const cancelDraft = useStore((s) => s.cancelDraft);
  const { importFiles, convertPptx } = useImport();
  const pptxPrompt = useStore((s) => s.pptxPrompt);
  const setPptxPrompt = useStore((s) => s.setPptxPrompt);
  const pdfPicker = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void init().then(async () => {
      // A PowerPoint file parked before the isolation reload resumes here.
      const pending = await takePending().catch(() => null);
      if (pending) void convertPptx(pending);
    });
  }, [init, convertPptx]);

  // Settings are mirrored onto <html> so CSS tokens follow them.
  useEffect(() => {
    applySettings(useSettings.getState());
    return useSettings.subscribe((s) => applySettings(s));
  }, []);

  // The project file is the durable artefact; IndexedDB is the working copy.
  useEffect(() => {
    if (!dirty) return;
    const onLeave = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [dirty]);

  // Global keys: arrows step slides, Escape cancels. No single-letter shortcuts outside the stage (WCAG 2.1.4).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT' || el?.isContentEditable || el?.closest('dialog, [role=dialog]')) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const st = useStore.getState();
      if (!st.deck) return;
      if (st.selectedId) return; // the stage owns the keys while a region is selected
      // Arrow keys inside the comment panel or a popover belong to that widget.
      const inPanel = !!el?.closest('.panel-list, .popover, .zoom-toolbar');
      if (st.view === 'review' && !inPanel) {
        if (e.key === 'ArrowRight' || e.key === 'PageDown') {
          e.preventDefault();
          step(1);
        } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
          e.preventDefault();
          step(-1);
        } else if (e.key === 'Home') {
          e.preventDefault();
          st.goTo(0);
        } else if (e.key === 'End') {
          e.preventDefault();
          st.goTo(st.deck.slides.length - 1);
        } else if (e.key === 'Escape') {
          cancelDraft();
          st.startEdit(null);
          st.setSelected(null);
        } else if ((e.key === 'n' || e.key === 'N') && !inPanel) {
          // N: new general note on this slide. Active outside text fields and dialogs only.
          e.preventDefault();
          st.startDraft(null);
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [step, cancelDraft]);

  // Files dropped anywhere on the app load a deck.
  useEffect(() => {
    const over = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      if (!e.dataTransfer?.files.length) return;
      e.preventDefault();
      void importFiles(e.dataTransfer.files);
    };
    document.addEventListener('dragover', over);
    document.addEventListener('drop', drop);
    return () => {
      document.removeEventListener('dragover', over);
      document.removeEventListener('drop', drop);
    };
  }, [importFiles]);

  const mode = !deck ? 'is-empty' : view === 'sheet' ? 'is-sheet' : '';
  const railWidth = useSettings((s) => s.railWidth);
  const panelWidth = useSettings((s) => s.panelWidth);
  const setSettings = useSettings((s) => s.set);
  const rem = typeof window === 'undefined' ? 16 : parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;

  return (
    <div className={`app ${mode}`}>
      <Header />
      {!ready ? null : !deck ? (
        <Landing />
      ) : view === 'sheet' ? (
        <Sheet />
      ) : (
        <>
          <Filmstrip />
          <Resizer
            className="sep1"
            label="Resize the slide list"
            side="left"
            value={railWidth ?? 7.5 * rem}
            min={5 * rem}
            max={16 * rem}
            onChange={(px) => setSettings({ railWidth: px })}
            onReset={() => setSettings({ railWidth: null })}
          />
          <Stage />
          <Resizer
            className="sep2"
            label="Resize the comment panel"
            side="right"
            value={panelWidth ?? 23 * rem}
            min={16 * rem}
            max={40 * rem}
            onChange={(px) => setSettings({ panelWidth: px })}
            onReset={() => setSettings({ panelWidth: null })}
          />
          <CommentPanel />
        </>
      )}
      <Footer />
      <Toasts />
      <PptxDialog
        prompt={pptxPrompt}
        onClose={() => setPptxPrompt(null)}
        onConvert={() => {
          const file = pptxPrompt?.file;
          setPptxPrompt(null);
          if (file) void convertPptx(file);
        }}
        onChoosePdf={() => {
          setPptxPrompt(null);
          pdfPicker.current?.click();
        }}
      />
      <input
        ref={pdfPicker}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) void importFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
