import type { Rect } from './types';

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
export const clamp01 = (v: number): number => clamp(v, 0, 1);
export const clampPct = (v: number): number => clamp(v, 0, 100);

/** Minimum size, in percent, below which a drag is treated as a click and discarded. */
export const MIN_RECT_PCT = 1.5;

/** Client coordinates to slide percentages given the slide element's bounding box. */
export function pointToPct(clientX: number, clientY: number, box: DOMRect): { x: number; y: number } {
  if (box.width <= 0 || box.height <= 0) return { x: 0, y: 0 };
  return {
    x: clampPct(((clientX - box.left) / box.width) * 100),
    y: clampPct(((clientY - box.top) / box.height) * 100),
  };
}

/** Normalised rectangle from two corner points, any order. */
export function rectFromPoints(a: { x: number; y: number }, b: { x: number; y: number }): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
}

/** Keeps a rectangle fully inside the slide, shrinking it if it cannot be moved in. */
export function clampRect(r: Rect): Rect {
  const w = clamp(r.w, 0, 100);
  const h = clamp(r.h, 0, 100);
  return { x: clamp(r.x, 0, 100 - w), y: clamp(r.y, 0, 100 - h), w, h };
}

export function isUsableRect(r: Rect | null | undefined): r is Rect {
  return !!r && r.w >= MIN_RECT_PCT && r.h >= MIN_RECT_PCT;
}

export function roundRect(r: Rect, digits = 2): Rect {
  const f = 10 ** digits;
  const rd = (v: number) => Math.round(v * f) / f;
  return { x: rd(r.x), y: rd(r.y), w: rd(r.w), h: rd(r.h) };
}

/**
 * Describes a rectangle in words for assistive technology, e.g.
 * "upper left quarter" or "centre, about a third of the slide".
 */
export function describeRect(r: Rect): string {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const area = (r.w * r.h) / 10000;

  const vert = cy < 33 ? 'upper' : cy > 67 ? 'lower' : 'middle';
  const horiz = cx < 33 ? 'left' : cx > 67 ? 'right' : 'centre';
  const where =
    vert === 'middle' && horiz === 'centre'
      ? 'centre'
      : vert === 'middle'
        ? `${horiz} middle`
        : horiz === 'centre'
          ? `${vert} centre`
          : `${vert} ${horiz}`;

  let size: string;
  if (r.w >= 90 && r.h >= 90) size = 'almost the whole slide';
  else if (r.w >= 90) size = 'a full-width band';
  else if (r.h >= 90) size = 'a full-height band';
  else if (area >= 0.4) size = 'about half of the slide';
  else if (area >= 0.2) size = 'about a quarter of the slide';
  else if (area >= 0.08) size = 'a medium area';
  else if (area >= 0.02) size = 'a small area';
  else size = 'a very small area';

  return `${size} in the ${where}`;
}
