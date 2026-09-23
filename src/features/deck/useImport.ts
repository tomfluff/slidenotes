import { useCallback } from 'react';
import { useStore } from '@/app/store';
import { classifyFiles, ingestFiles, pdfToSlides, sniffFile } from './ingest';
import { convertPptxToPdf, ENGINE_MB, isIsolated, isPptxFile, requestIsolation, serviceWorkersAvailable, stashPending, takePending, type PptxPhase } from './pptx';
import { loadSampleDeck } from './sample';

/** One entry point for every way files reach the app: drop, picker, project file. */
export function useImport() {
  const addDeck = useStore((s) => s.addDeck);
  const setBusy = useStore((s) => s.setBusy);
  const toast = useStore((s) => s.toast);
  const announce = useStore((s) => s.announce);
  const setPptxPrompt = useStore((s) => s.setPptxPrompt);

  const importFiles = useCallback(
    async (list: FileList | File[]) => {
      const files = await Promise.all(Array.from(list).map(sniffFile));
      if (!files.length) return;
      const pptx = files.find(isPptxFile);
      if (pptx) {
        if (files.length > 1) {
          const msg = 'Load one PowerPoint file at a time, on its own.';
          toast('err', msg);
          announce(msg);
          return;
        }
        setPptxPrompt({ file: pptx });
        announce('PowerPoint file received. Choose whether to convert it in this browser or export it as PDF yourself.');
        return;
      }
      const kind = classifyFiles(files);
      try {
        if (kind === 'project') {
          setBusy({ label: 'Opening project', done: 0, total: 1 });
          const { readProjectZip } = await import('@/features/export/project');
          const loaded = await readProjectZip(files[0]!);
          await addDeck({ deck: loaded.deck, images: loaded.images }, loaded.comments);
          const msg = loaded.missing.length
            ? `Opened "${loaded.deck.name}". ${loaded.missing.length} slide image${loaded.missing.length === 1 ? ' was' : 's were'} missing from the file.`
            : `Opened "${loaded.deck.name}" with ${loaded.comments.length} comment${loaded.comments.length === 1 ? '' : 's'}.`;
          toast(loaded.missing.length ? 'err' : 'ok', msg);
          announce(msg);
          return;
        }
        const ingested = await ingestFiles(files, (done, total, label) => setBusy({ label, done, total }));
        await addDeck(ingested);
        const msg = `Loaded "${ingested.deck.name}", ${ingested.deck.slides.length} slide${ingested.deck.slides.length === 1 ? '' : 's'}.`;
        toast('ok', msg);
        announce(msg);
      } catch (err) {
        const text = err instanceof Error ? err.message : 'Something went wrong while reading the files.';
        toast('err', text);
        announce(text);
      } finally {
        setBusy(null);
      }
    },
    [addDeck, setBusy, toast, announce, setPptxPrompt],
  );

  /**
   * Converts a PowerPoint file in the browser, then feeds the PDF into the normal pipeline.
   * If the page is not cross-origin isolated yet, the file is parked and the page reloads
   * once with the header service worker; App resumes the conversion after the reload.
   */
  const convertPptx = useCallback(
    async (file: File) => {
      const labels: Record<PptxPhase, string> = {
        download: `Downloading the conversion engine (${ENGINE_MB} MB, once)…`,
        start: 'Starting LibreOffice in your browser…',
        convert: `Converting ${file.name} to PDF…`,
      };
      if (!isIsolated()) {
        if (!serviceWorkersAvailable()) {
          setPptxPrompt({ file, error: 'This browser does not allow the background worker the engine needs (private windows often block it). Export the deck as PDF instead.' });
          return;
        }
        setBusy({ label: 'Preparing the page for the conversion engine (reloads once)…', done: 0, total: 1 });
        announce('The page will reload once to enable the conversion engine.');
        try {
          await stashPending(file);
          const outcome = await requestIsolation();
          if (outcome === 'failed') throw new Error('isolation_failed');
        } catch (err) {
          console.error(err);
          // Nothing may linger for the next load to retry on its own.
          await takePending().catch(() => null);
          setBusy(null);
          setPptxPrompt({ file, error: 'The page could not be prepared for the engine. Export the deck as PDF instead.' });
        }
        return;
      }
      try {
        setBusy({ label: labels.download, done: 0, total: 1 });
        const pdf = await convertPptxToPdf(file, (phase) => setBusy({ label: labels[phase], done: 0, total: 1 }));
        const ingested = await pdfToSlides(pdf, (done, total, label) => setBusy({ label, done, total }));
        ingested.deck.name = file.name.replace(/\.pptx?$/i, '');
        await addDeck(ingested);
        const msg = `Converted "${file.name}", ${ingested.deck.slides.length} slide${ingested.deck.slides.length === 1 ? '' : 's'}. Fonts the engine lacks are substituted, so line breaks can differ from PowerPoint.`;
        toast('ok', msg);
        announce(msg);
      } catch (err) {
        console.error(err);
        const text = err instanceof Error ? err.message : String(err);
        const friendly = /timeout/.test(text)
          ? 'The conversion engine took too long to load or convert. Check the connection and try again, or export the deck as PDF.'
          : `The engine could not convert this file (${text}). Export the deck as PDF instead.`;
        setPptxPrompt({ file, error: friendly });
        announce(friendly);
      } finally {
        setBusy(null);
      }
    },
    [addDeck, setBusy, toast, announce, setPptxPrompt],
  );

  const importSample = useCallback(async () => {
    try {
      setBusy({ label: 'Loading the demo deck', done: 0, total: 1 });
      const ingested = await loadSampleDeck();
      await addDeck(ingested);
      announce('Demo deck loaded.');
    } catch {
      toast('err', 'The demo deck could not be loaded.');
    } finally {
      setBusy(null);
    }
  }, [addDeck, setBusy, toast, announce]);

  return { importFiles, importSample, convertPptx };
}

export const ACCEPT = '.pdf,.pptx,.ppt,.png,.jpg,.jpeg,.zip,.slidenotes,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,image/png,image/jpeg,application/zip';
