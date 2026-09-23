import JSZip from 'jszip';
import { fmtDateTimeLong } from '@/lib/format';
import { loadImage } from '@/lib/download';
import { describeRect } from '@/lib/geometry';
import type { Comment, Deck, Rect } from '@/lib/types';
import { buildSheetBlocks, sheetSummary } from './sheetData';
import type { ExportStyle } from './useExport';

export interface MarkdownResult {
  blob: Blob;
  failed: string[];
}

const pad = (n: number): string => String(n).padStart(2, '0');

function pxRect(r: Rect, w: number, h: number): { x: number; y: number; w: number; h: number } {
  return {
    x: Math.round((r.x / 100) * w),
    y: Math.round((r.y / 100) * h),
    w: Math.round((r.w / 100) * w),
    h: Math.round((r.h / 100) * h),
  };
}

async function cropRegion(blob: Blob, r: Rect, stroke: string): Promise<Blob> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    const W = img.naturalWidth;
    const H = img.naturalHeight;
    // A little context around the region helps a reader place it.
    const padX = Math.round(W * 0.02);
    const padY = Math.round(H * 0.02);
    const p = pxRect(r, W, H);
    const sx = Math.max(0, p.x - padX);
    const sy = Math.max(0, p.y - padY);
    const sw = Math.min(W - sx, p.w + padX * 2);
    const sh = Math.min(H - sy, p.h + padY * 2);
    const c = document.createElement('canvas');
    c.width = Math.max(1, sw);
    c.height = Math.max(1, sh);
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('canvas_unavailable');
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    // Outline the exact region inside the padded crop.
    ctx.strokeStyle = stroke;
    ctx.lineWidth = Math.max(2, Math.round(W / 500));
    ctx.strokeRect(p.x - sx, p.y - sy, p.w, p.h);
    const out = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/png'));
    if (!out) throw new Error('encode_failed');
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * A zip that co-authors and AI agents can act on: review.md with every comment and its
 * visual reference, comments.json with exact coordinates, full slide images and a crop
 * of every marked region.
 */
export async function buildMarkdownBundle(deck: Deck, comments: readonly Comment[], images: Map<string, Blob>, style: ExportStyle): Promise<MarkdownResult> {
  const blocks = buildSheetBlocks(deck, comments);
  const sum = sheetSummary(deck, comments);
  const zip = new JSZip();
  const failed: string[] = [];
  const md: string[] = [];
  const json: unknown[] = [];

  md.push(`# ${deck.name}: review notes`, '');
  md.push(`Generated ${fmtDateTimeLong(Date.now())}. ${sum.count} comment${sum.count === 1 ? '' : 's'} across ${sum.slides} of ${deck.slides.length} slides.`, '');
  md.push(
    '> Coordinates are percentages of the slide width and height, origin at the top left corner. ' +
      'Pixel values refer to the exported slide image. Every marked region has a numbered badge on the slide image, ' +
      'a crop under `crops/`, and a machine-readable entry in `comments.json`.',
    '',
  );

  for (const block of blocks) {
    const n = block.slide.index + 1;
    const blob = images.get(block.slide.id);
    const slideFile = `slides/slide-${pad(n)}.${extFor(blob?.type)}`;
    if (blob) zip.file(slideFile, blob);
    else failed.push(`slide ${n} image`);

    md.push(`## Slide ${n} of ${deck.slides.length}`, '');
    if (block.slide.sourceName) md.push(`Source: ${block.slide.sourceName}`, '');
    md.push(blob ? `![Slide ${n}](${slideFile})` : '_Slide image unavailable_', '');

    if (block.regions.length) {
      md.push('### Marked regions', '');
      for (const item of block.regions) {
        const r = item.comment.rect!;
        const px = pxRect(r, block.slide.width, block.slide.height);
        const cropFile = `crops/slide-${pad(n)}-region-${item.number}.png`;
        let cropOk = false;
        if (blob) {
          try {
            zip.file(cropFile, await cropRegion(blob, r, style.mark));
            cropOk = true;
          } catch {
            // The coordinates still describe the region; the missing crop is reported.
            failed.push(`crop of region ${item.number} on slide ${n}`);
          }
        }
        md.push(`${item.number}. **Region ${item.number}**, ${describeRect(r)}.`);
        md.push(`   Position: x ${r.x}%, y ${r.y}%, width ${r.w}%, height ${r.h}% (pixels ${px.x},${px.y} size ${px.w}×${px.h} of ${block.slide.width}×${block.slide.height}).`);
        if (cropOk) md.push(`   ![Region ${item.number} of slide ${n}](${cropFile})`);
        md.push('');
        md.push(indent(item.comment.text));
        md.push(meta(item.comment));
        md.push('');
        json.push(entry(block.slide.index, item.number, item.comment, px, slideFile, cropOk ? cropFile : null));
      }
    }
    if (block.generals.length) {
      md.push('### General notes', '');
      for (const item of block.generals) {
        md.push(`- ${item.comment.text.replace(/\n/g, '\n  ')}`);
        const m = meta(item.comment);
        if (m) md.push(`  ${m.trim()}`);
        json.push(entry(block.slide.index, null, item.comment, null, slideFile, null));
      }
      md.push('');
    }
  }
  if (!blocks.length) md.push('_No comments yet._', '');

  zip.file('review.md', md.join('\n'));
  zip.file(
    'comments.json',
    JSON.stringify(
      {
        deck: deck.name,
        generatedAt: new Date().toISOString(),
        slideCount: deck.slides.length,
        coordinateSystem: 'percent of slide width/height, origin top-left; pixel values refer to slide image size',
        comments: json,
      },
      null,
      2,
    ),
  );
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  return { blob, failed };
}

function extFor(mime: string | undefined): string {
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/svg+xml') return 'svg';
  return 'png';
}

function indent(text: string): string {
  return text
    .split('\n')
    .map((l) => `   ${l}`)
    .join('\n');
}

function meta(c: Comment): string {
  const bits: string[] = [];
  if (c.author) bits.push(`by ${c.author}`);
  if (c.resolved) bits.push('resolved');
  return bits.length ? `   _${bits.join(', ')}_` : '';
}

function entry(slideIndex: number, number: number | null, c: Comment, px: { x: number; y: number; w: number; h: number } | null, slideFile: string, cropFile: string | null) {
  return {
    slide: slideIndex + 1,
    number,
    kind: c.rect ? 'region' : 'general',
    text: c.text,
    author: c.author ?? null,
    resolved: !!c.resolved,
    regionPercent: c.rect,
    regionPixels: px,
    slideImage: slideFile,
    cropImage: cropFile,
    createdAt: new Date(c.createdAt).toISOString(),
    updatedAt: c.updatedAt ? new Date(c.updatedAt).toISOString() : null,
  };
}
