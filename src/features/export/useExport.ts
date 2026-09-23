import { useCallback } from 'react';
import { useStore, type ExportKind } from '@/app/store';
import { useSettings, markerHex } from '@/app/settings';
import { downloadBlob } from '@/lib/download';
import { fileStem } from '@/lib/format';
import type { Comment } from '@/lib/types';

export interface ExportStyle {
  /** Marker colour, the text colour on it, and the drawing style, captured from settings at export time. */
  mark: string;
  markInk: string;
  markerStyle: 'solid' | 'outline' | 'corners';
  halo: boolean;
}

export function useExport() {
  const busy = useStore((s) => s.exporting);
  const setBusy = useStore((s) => s.setExporting);
  const toast = useStore((s) => s.toast);
  const announce = useStore((s) => s.announce);
  const markSaved = useStore((s) => s.markSaved);

  const style = (): ExportStyle => {
    const s = useSettings.getState();
    return { mark: markerHex(s.marker), markInk: '#ffffff', markerStyle: s.markerStyle, halo: s.halo };
  };

  const run = useCallback(
    async (kind: ExportKind, label: string, fn: () => Promise<{ blob: Blob; failed?: string[]; name: string; after?: () => void }>) => {
      if (useStore.getState().exporting) return;
      setBusy(kind);
      announce(`Building ${label}…`);
      try {
        const r = await fn();
        downloadBlob(r.blob, r.name);
        r.after?.();
        if (r.failed?.length) {
          toast('err', `${label} saved, but ${r.failed.length} item${r.failed.length === 1 ? '' : 's'} could not be rendered: ${r.failed.slice(0, 3).join(', ')}${r.failed.length > 3 ? '…' : ''}.`);
        } else {
          toast('ok', `${label} saved.`);
        }
        announce(`${label} ready.`);
      } catch (err) {
        console.error(err);
        toast('err', `Could not build the ${label}.`);
        announce(`Could not build the ${label}.`);
      } finally {
        setBusy(null);
      }
    },
    [toast, announce, setBusy],
  );

  const exportPdf = useCallback(
    (comments?: readonly Comment[]) => {
      const { deck, images, comments: all } = useStore.getState();
      if (!deck) return Promise.resolve();
      return run('pdf', 'PDF', async () => {
        const { buildPdf } = await import('./pdf');
        const r = await buildPdf(deck, comments ?? all, images, style());
        return { blob: r.blob, failed: r.failed, name: `${fileStem(deck.name)}-review-comments.pdf` };
      });
    },
    [run],
  );

  const exportHtml = useCallback(
    (comments?: readonly Comment[]) => {
      const { deck, images, comments: all } = useStore.getState();
      if (!deck) return Promise.resolve();
      return run('html', 'HTML file', async () => {
        const { buildStandaloneHtml } = await import('./html');
        const r = await buildStandaloneHtml(deck, comments ?? all, images, style());
        return { blob: r.blob, failed: r.failed, name: `${fileStem(deck.name)}-review-comments.html` };
      });
    },
    [run],
  );

  const exportMarkdown = useCallback(
    (comments?: readonly Comment[]) => {
      const { deck, images, comments: all } = useStore.getState();
      if (!deck) return Promise.resolve();
      return run('md', 'Markdown bundle', async () => {
        const { buildMarkdownBundle } = await import('./markdown');
        const r = await buildMarkdownBundle(deck, comments ?? all, images, style());
        return { blob: r.blob, failed: r.failed, name: `${fileStem(deck.name)}-review-notes.zip` };
      });
    },
    [run],
  );

  const saveProject = useCallback(() => {
    const { deck, images, comments, revision } = useStore.getState();
    if (!deck) return Promise.resolve();
    return run('project', 'Project file', async () => {
      const { writeProjectZip } = await import('./project');
      const missing = deck.slides.filter((s) => !images.has(s.id)).map((s) => `slide ${s.index + 1} image`);
      const blob = await writeProjectZip(deck, images, comments);
      return {
        blob,
        failed: missing,
        name: `${fileStem(deck.name)}.slidenotes.zip`,
        // Clean only once the download started, and only if nothing changed meanwhile.
        after: () => markSaved(deck.id, revision),
      };
    });
  }, [run, markSaved]);

  return { busy, exportPdf, exportHtml, exportMarkdown, saveProject };
}
