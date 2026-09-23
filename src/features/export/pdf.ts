import { jsPDF } from 'jspdf';
import { fmtDateTimeLong } from '@/lib/format';
import { loadImage } from '@/lib/download';
import type { Comment, Deck } from '@/lib/types';
import { buildSheetBlocks, sheetSummary } from './sheetData';
import type { ExportStyle } from './useExport';

export interface PdfProgress {
  (done: number, total: number): void;
}

export interface PdfResult {
  blob: Blob;
  /** Items that could not be rendered; the block still lists its comments. */
  failed: string[];
  pages: number;
}

// jsPDF's built-in fonts cover WinAnsi only, so anything outside it (Japanese in
// particular) is drawn line by line with canvas text and placed as images instead.
const LATIN_OK = /^[\u0000-ÿ–—‘’“”•…€]*$/;
const PX_PER_MM = 8;
const PT_TO_MM = 0.3528;
const LINE = 1.38;
const CANVAS_FONT = 'system-ui, -apple-system, "Segoe UI", "Hiragino Sans", "Noto Sans JP", "Yu Gothic", sans-serif';

type RGB = [number, number, number];
const INK: RGB = [16, 20, 24];
const MUTED: RGB = [85, 96, 110];
const LINE_C: RGB = [200, 206, 214];

function hexToRgb(hex: string): RGB {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  return m ? [parseInt(m[1]!, 16), parseInt(m[2]!, 16), parseInt(m[3]!, 16)] : [123, 44, 191];
}

/** A paragraph laid out into lines, each drawable on its own so page breaks fall between lines. */
interface Laid {
  lines: string[];
  lineMM: number;
  latin: boolean;
  sizePt: number;
  bold: boolean;
  rgb: RGB;
  widthMM: number;
}

function setFont(doc: jsPDF, sizePt: number, bold: boolean, rgb: RGB): void {
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setFontSize(sizePt);
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}

function canvasFont(sizePt: number, bold: boolean): string {
  return `${bold ? 600 : 400} ${sizePt * PT_TO_MM * PX_PER_MM}px ${CANVAS_FONT}`;
}

function wrapCanvas(ctx: CanvasRenderingContext2D, text: string, maxPx: number): string[] {
  const out: string[] = [];
  for (const para of text.split(/\n/)) {
    if (!para) {
      out.push('');
      continue;
    }
    let line = '';
    for (const w of para.split(/\s+/)) {
      const next = line ? `${line} ${w}` : w;
      if (ctx.measureText(next).width <= maxPx || !line) line = next;
      else {
        out.push(line);
        line = w;
      }
    }
    out.push(line);
  }
  // CJK has no spaces, so overlong lines still need hard breaking by character.
  const hard: string[] = [];
  for (const l of out) {
    if (ctx.measureText(l).width <= maxPx) {
      hard.push(l);
      continue;
    }
    let cur = '';
    for (const ch of l) {
      if (cur && ctx.measureText(cur + ch).width > maxPx) {
        hard.push(cur);
        cur = ch;
      } else cur += ch;
    }
    if (cur) hard.push(cur);
  }
  return hard;
}

function layout(doc: jsPDF, text: string, widthMM: number, sizePt: number, rgb: RGB, bold = false): Laid {
  const lineMM = sizePt * PT_TO_MM * LINE;
  if (LATIN_OK.test(text)) {
    setFont(doc, sizePt, bold, rgb);
    return { lines: doc.splitTextToSize(text, widthMM) as string[], lineMM, latin: true, sizePt, bold, rgb, widthMM };
  }
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  if (!ctx) return { lines: [text], lineMM, latin: true, sizePt, bold, rgb, widthMM };
  ctx.font = canvasFont(sizePt, bold);
  return { lines: wrapCanvas(ctx, text, widthMM * PX_PER_MM), lineMM, latin: false, sizePt, bold, rgb, widthMM };
}

/** Draws one line at (x, y) where y is the top of the line box. */
function drawLine(doc: jsPDF, laid: Laid, line: string, x: number, y: number): void {
  if (laid.latin) {
    setFont(doc, laid.sizePt, laid.bold, laid.rgb);
    doc.text(line, x, y + laid.lineMM * 0.8);
    return;
  }
  if (!line) return;
  const px = laid.sizePt * PT_TO_MM * PX_PER_MM;
  const c = document.createElement('canvas');
  c.width = Math.ceil(laid.widthMM * PX_PER_MM);
  c.height = Math.ceil(px * LINE);
  const ctx = c.getContext('2d');
  if (!ctx) return;
  ctx.font = canvasFont(laid.sizePt, laid.bold);
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = `rgb(${laid.rgb[0]},${laid.rgb[1]},${laid.rgb[2]})`;
  ctx.fillText(line, 0, px * 1.05);
  doc.addImage(c.toDataURL('image/png'), 'PNG', x, y, laid.widthMM, c.height / PX_PER_MM);
}

async function slideJpeg(blob: Blob, maxW: number): Promise<{ data: string; w: number; h: number }> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, maxW / img.naturalWidth);
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * scale));
    c.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('canvas_unavailable');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return { data: c.toDataURL('image/jpeg', 0.88), w: c.width, h: c.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * A4 portrait, 14mm margins, deck name and timestamp header, then one block per
 * commented slide: slide image 86mm wide on the left with translucent regions and
 * numbered badges, numbered comment text to the right. Comment text paginates line by
 * line; the slide image stays with its block and is scaled to fit a page if it is tall.
 */
export async function buildPdf(
  deck: Deck,
  comments: readonly Comment[],
  images: Map<string, Blob>,
  style: ExportStyle,
  onProgress?: PdfProgress,
): Promise<PdfResult> {
  const MARK = hexToRgb(style.mark);
  const blocks = buildSheetBlocks(deck, comments);
  const failed: string[] = [];
  const rendered = new Map<string, { data: string; w: number; h: number }>();
  for (const [i, b] of blocks.entries()) {
    onProgress?.(i, blocks.length);
    const blob = images.get(b.slide.id);
    if (!blob) {
      failed.push(`slide ${b.slide.index + 1} image`);
      continue;
    }
    try {
      rendered.set(b.slide.id, await slideJpeg(blob, 1400));
    } catch {
      failed.push(`slide ${b.slide.index + 1} image`);
    }
  }
  onProgress?.(blocks.length, blocks.length);

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const M = 14;
  const PW = 210;
  const PH = 297;
  const BOTTOM = PH - M;
  const W = PW - M * 2;
  const IMG_W = 86;
  const GAP = 9;
  const TX = M + IMG_W + GAP;
  const TW = W - IMG_W - GAP;
  const BADGE = 2.1;
  const INDENT = 7;

  /** Cursor for the text column. Page breaks move it to the top of a fresh page. */
  let ty = M;
  const ensure = (need: number) => {
    if (ty + need > BOTTOM) {
      doc.addPage();
      ty = M;
    }
  };
  /** Draws a paragraph at the cursor, breaking pages between lines. */
  const paragraph = (laid: Laid, x: number) => {
    for (const line of laid.lines) {
      ensure(laid.lineMM);
      drawLine(doc, laid, line, x, ty);
      ty += laid.lineMM;
    }
  };

  // Header
  paragraph(layout(doc, `${deck.name}, review notes`, W, 16, INK, true), M);
  ty += 1.5;
  const sum = sheetSummary(deck, comments);
  paragraph(
    layout(
      doc,
      `${sum.count} comment${sum.count === 1 ? '' : 's'} across ${sum.slides} slide${sum.slides === 1 ? '' : 's'}, generated ${fmtDateTimeLong(Date.now())}`,
      W, 9, MUTED,
    ),
    M,
  );
  ty += 3;
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.5);
  doc.line(M, ty, PW - M, ty);
  ty += 7;

  blocks.forEach((block, bi) => {
    const img = rendered.get(block.slide.id);
    const ratio = img ? img.h / img.w : block.slide.height / block.slide.width;
    // The image never exceeds the page; a tall (portrait) slide is scaled down instead.
    const titleH = 10 * PT_TO_MM * LINE + 1.5;
    const imgW = Math.min(IMG_W, (BOTTOM - M - titleH - 4) / ratio);
    const imgH = imgW * ratio;
    // Start a new page unless the title, the image and at least two comment lines fit.
    ensure(titleH + Math.min(imgH, 40) + 4);

    const top = ty;
    let left = ty;
    const title = layout(doc, `Slide ${block.slide.index + 1} / ${deck.slides.length}`, IMG_W, 10, INK, true);
    for (const line of title.lines) {
      drawLine(doc, title, line, M, left);
      left += title.lineMM;
    }
    left += 1.5;

    if (img) {
      doc.addImage(img.data, 'JPEG', M, left, imgW, imgH);
    } else {
      doc.setFillColor(245, 247, 249);
      doc.rect(M, left, imgW, imgH, 'F');
      const note = layout(doc, 'Slide image unavailable', imgW - 8, 8, MUTED);
      drawLine(doc, note, note.lines[0] ?? '', M + 4, left + imgH / 2 - 3);
    }
    doc.setDrawColor(...LINE_C);
    doc.setLineWidth(0.2);
    doc.rect(M, left, imgW, imgH, 'S');

    for (const item of block.regions) {
      const r = item.comment.rect;
      if (!r) continue;
      const rx = M + (r.x / 100) * imgW;
      const ry = left + (r.y / 100) * imgH;
      const rw = (r.w / 100) * imgW;
      const rh = (r.h / 100) * imgH;
      const ms = style.markerStyle;
      if (ms === 'solid') {
        doc.saveGraphicsState();
        doc.setGState(new (doc as unknown as { GState: new (o: { opacity: number }) => unknown }).GState({ opacity: 0.16 }) as never);
        doc.setFillColor(...MARK);
        doc.rect(rx, ry, rw, rh, 'F');
        doc.restoreGraphicsState();
      }
      if (ms === 'solid' || ms === 'outline') {
        if (style.halo) {
          // A pale halo under the coloured stroke keeps the outline visible on any slide.
          doc.setDrawColor(255, 255, 255);
          doc.setLineWidth(0.9);
          doc.rect(rx, ry, rw, rh, 'S');
        }
        doc.setDrawColor(...MARK);
        doc.setLineWidth(0.45);
        doc.rect(rx, ry, rw, rh, 'S');
      } else if (ms === 'corners') {
        const lx = Math.min(rw * 0.28, 4);
        const ly = Math.min(rh * 0.28, 4);
        const segs: [number, number, number, number][] = [
          [rx, ry + ly, rx, ry], [rx, ry, rx + lx, ry],
          [rx + rw - lx, ry, rx + rw, ry], [rx + rw, ry, rx + rw, ry + ly],
          [rx + rw, ry + rh - ly, rx + rw, ry + rh], [rx + rw, ry + rh, rx + rw - lx, ry + rh],
          [rx + lx, ry + rh, rx, ry + rh], [rx, ry + rh, rx, ry + rh - ly],
        ];
        const passes: [RGB, number][] = style.halo ? [[[255, 255, 255], 1.2], [MARK, 0.6]] : [[MARK, 0.6]];
        for (const [c, w] of passes) {
          doc.setDrawColor(...c);
          doc.setLineWidth(w);
          doc.setLineCap('round');
          for (const [x1, y1, x2, y2] of segs) doc.line(x1, y1, x2, y2);
        }
      }
      const bx = Math.min(rx + 2.6, M + imgW - 2.6);
      const by = Math.min(ry + 2.6, left + imgH - 2.6);
      doc.setFillColor(...MARK);
      doc.circle(bx, by, 2.3, 'F');
      setFont(doc, 8, true, [255, 255, 255]);
      doc.text(String(item.number), bx, by + 0.95, { align: 'center' });
    }
    const imageBottom = left + imgH;

    // Text column, starting level with the block title. The column may run past the
    // image and onto following pages; the image itself stays put.
    ty = top;
    const imagePage = doc.getCurrentPageInfo().pageNumber;
    const item = (label: string, c: Comment, colour: RGB) => {
      const body = layout(doc, c.author ? `${c.text}\n— ${c.author}` : c.text, TW - INDENT, 10, c.resolved ? MUTED : INK);
      ensure(Math.min(body.lines.length, 2) * body.lineMM);
      doc.setFillColor(...colour);
      doc.circle(TX + BADGE, ty + 2.4, BADGE, 'F');
      if (label) {
        setFont(doc, 8, true, [255, 255, 255]);
        doc.text(label, TX + BADGE, ty + 3.3, { align: 'center' });
      }
      const startY = ty;
      const startPage = doc.getCurrentPageInfo().pageNumber;
      paragraph(body, TX + INDENT);
      // A one-line comment still clears its badge, but only when no page break intervened.
      if (doc.getCurrentPageInfo().pageNumber === startPage && ty - startY < 6) ty = startY + 6;
      if (c.resolved) {
        const res = layout(doc, 'Resolved', TW - INDENT, 7, MUTED, true);
        paragraph(res, TX + INDENT);
      }
      ty += 2.4;
    };
    for (const it of block.regions) item(String(it.number), it.comment, MARK);
    if (block.generals.length) {
      ty += 1.5;
      ensure(12);
      paragraph(layout(doc, 'General notes', TW, 8, MUTED, true), TX);
      ty += 1;
      for (const it of block.generals) item('', it.comment, MUTED);
    }

    // Next block starts below whichever column ended lower, on the current page.
    const endPage = doc.getCurrentPageInfo().pageNumber;
    if (endPage === imagePage) ty = Math.max(imageBottom, ty) + 6;
    else ty += 6;
    if (bi < blocks.length - 1) {
      ensure(8);
      doc.setDrawColor(...LINE_C);
      doc.setLineWidth(0.2);
      doc.line(M, ty, PW - M, ty);
      ty += 6;
    }
  });

  return { blob: doc.output('blob'), failed, pages: doc.getNumberOfPages() };
}
