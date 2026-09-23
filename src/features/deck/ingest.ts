import { uid } from '@/lib/id';
import { sortByName } from '@/lib/sort';
import { loadImage } from '@/lib/download';
import type { Deck, Slide } from '@/lib/types';

export interface IngestedDeck {
  deck: Deck;
  images: Map<string, Blob>;
}

export type Progress = (done: number, total: number, label: string) => void;

const TARGET_WIDTH = 1600;

/** Renders every page of a PDF to a PNG blob, off the main thread via the bundled worker. */
export async function pdfToSlides(file: File, onProgress?: Progress): Promise<IngestedDeck> {
  const [pdfjs, { default: workerUrl }] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const data = await file.arrayBuffer();
  const task = pdfjs.getDocument({ data });
  const slides: Slide[] = [];
  const images = new Map<string, Blob>();
  try {
    const pdf = await task.promise;
    for (let p = 1; p <= pdf.numPages; p++) {
      onProgress?.(p - 1, pdf.numPages, `Rendering page ${p} of ${pdf.numPages}`);
      const page = await pdf.getPage(p);
      try {
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(3, TARGET_WIDTH / base.width);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('canvas_unavailable');
        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
        const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
        if (!blob) throw new Error('encode_failed');
        const alt = await pageText(page);
        const id = uid();
        const slide: Slide = { id, index: p - 1, width: canvas.width, height: canvas.height, sourceName: `Page ${p}` };
        if (alt) slide.alt = alt;
        slides.push(slide);
        images.set(id, blob);
      } finally {
        page.cleanup();
      }
    }
    onProgress?.(pdf.numPages, pdf.numPages, 'Done');
  } finally {
    await task.destroy();
  }

  return {
    deck: { id: uid(), name: file.name.replace(/\.pdf$/i, ''), createdAt: Date.now(), slides },
    images,
  };
}

/** The page's text, in reading order, as a description for screen-reader users. */
async function pageText(page: { getTextContent: () => Promise<{ items: unknown[] }> }): Promise<string> {
  try {
    const content = await page.getTextContent();
    const parts: string[] = [];
    for (const it of content.items) {
      const item = it as { str?: string; hasEOL?: boolean };
      if (typeof item.str === 'string' && item.str) parts.push(item.str);
      if (item.hasEOL) parts.push('\n');
    }
    return parts.join(' ').replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim().slice(0, 2000);
  } catch {
    return '';
  }
}

/** Accepts PNG and JPEG files, one per slide, in natural filename order. */
export async function imagesToSlides(files: readonly File[], onProgress?: Progress): Promise<IngestedDeck> {
  const sorted = sortByName(files);
  const slides: Slide[] = [];
  const images = new Map<string, Blob>();
  for (const [i, file] of sorted.entries()) {
    onProgress?.(i, sorted.length, `Reading ${file.name}`);
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      const id = uid();
      slides.push({ id, index: i, width: img.naturalWidth, height: img.naturalHeight, sourceName: file.name });
      images.set(id, file);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  onProgress?.(sorted.length, sorted.length, 'Done');
  const first = sorted[0];
  const name = first ? first.name.replace(/[-_ ]?\d+\.(png|jpe?g)$/i, '').replace(/\.(png|jpe?g)$/i, '') || 'Image deck' : 'Image deck';
  return { deck: { id: uid(), name, createdAt: Date.now(), slides }, images };
}

export const isPdf = (f: File): boolean => /\.pdf$/i.test(f.name) || f.type === 'application/pdf';
export const isImage = (f: File): boolean => /\.(png|jpe?g)$/i.test(f.name) || /^image\/(png|jpeg)$/.test(f.type);
export const isProjectZip = (f: File): boolean => /\.(zip|slidenotes)$/i.test(f.name);

export type FileKind = 'pdf' | 'images' | 'project' | 'mixed' | 'unsupported';

/** Reads the magic bytes so a file with no extension is still recognised. */
export async function sniffFile(file: File): Promise<File> {
  // A .pptx is a zip too, so the name wins over the magic bytes.
  if (isPdf(file) || isImage(file) || isProjectZip(file) || /\.pptx?$/i.test(file.name)) return file;
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const hex = Array.from(head, (b) => b.toString(16).padStart(2, '0')).join('');
  let ext: string | null = null;
  let type = '';
  if (hex.startsWith('25504446')) { ext = 'pdf'; type = 'application/pdf'; }
  else if (hex.startsWith('89504e47')) { ext = 'png'; type = 'image/png'; }
  else if (hex.startsWith('ffd8ff')) { ext = 'jpg'; type = 'image/jpeg'; }
  else if (hex.startsWith('504b0304')) { ext = 'zip'; type = 'application/zip'; }
  if (!ext) return file;
  return new File([file], `${file.name || 'file'}.${ext}`, { type, lastModified: file.lastModified });
}

export function classifyFiles(files: readonly File[]): FileKind {
  if (!files.length) return 'unsupported';
  if (files.length === 1 && files[0] && isPdf(files[0])) return 'pdf';
  if (files.length === 1 && files[0] && isProjectZip(files[0])) return 'project';
  if (files.every(isImage)) return 'images';
  if (files.some(isPdf) || files.some(isProjectZip)) return 'mixed';
  return 'unsupported';
}

/** Ingests any accepted selection: one PDF, one project zip, or a set of images. */
export async function ingestFiles(files: readonly File[], onProgress?: Progress): Promise<IngestedDeck> {
  const kind = classifyFiles(files);
  const first = files[0];
  if (kind === 'pdf' && first) return pdfToSlides(first, onProgress);
  if (kind === 'images') return imagesToSlides(files, onProgress);
  if (kind === 'mixed') throw new Error('Choose either one PDF or a set of PNG/JPG images, not both.');
  throw new Error('Unsupported file type. Use one PDF, or PNG/JPG images, one per slide.');
}
