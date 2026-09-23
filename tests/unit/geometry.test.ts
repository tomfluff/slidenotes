import { describe, expect, it } from 'vitest';
import { clampRect, describeRect, isUsableRect, pointToPct, rectFromPoints, roundRect } from '@/lib/geometry';

describe('geometry', () => {
  it('converts client points to percentages and clamps', () => {
    const box = { left: 100, top: 50, width: 200, height: 100 } as DOMRect;
    expect(pointToPct(150, 75, box)).toEqual({ x: 25, y: 25 });
    expect(pointToPct(0, 0, box)).toEqual({ x: 0, y: 0 });
    expect(pointToPct(1000, 1000, box)).toEqual({ x: 100, y: 100 });
  });
  it('normalises rectangles from any two corners', () => {
    expect(rectFromPoints({ x: 50, y: 60 }, { x: 10, y: 20 })).toEqual({ x: 10, y: 20, w: 40, h: 40 });
  });
  it('keeps rectangles inside the slide', () => {
    expect(clampRect({ x: 90, y: -5, w: 30, h: 20 })).toEqual({ x: 70, y: 0, w: 30, h: 20 });
    expect(clampRect({ x: 0, y: 0, w: 150, h: 150 })).toEqual({ x: 0, y: 0, w: 100, h: 100 });
  });
  it('discards click-sized rectangles', () => {
    expect(isUsableRect({ x: 1, y: 1, w: 1, h: 1 })).toBe(false);
    expect(isUsableRect({ x: 1, y: 1, w: 2, h: 2 })).toBe(true);
    expect(isUsableRect(null)).toBe(false);
  });
  it('rounds to two decimals', () => {
    expect(roundRect({ x: 1.2345, y: 2.3456, w: 3.4567, h: 4.5678 })).toEqual({ x: 1.23, y: 2.35, w: 3.46, h: 4.57 });
  });
  it('describes regions in words', () => {
    expect(describeRect({ x: 0, y: 0, w: 50, h: 50 })).toBe('about a quarter of the slide in the upper left');
    expect(describeRect({ x: 40, y: 40, w: 20, h: 20 })).toBe('a small area in the centre');
    expect(describeRect({ x: 0, y: 80, w: 100, h: 15 })).toBe('a full-width band in the lower centre');
  });
});
