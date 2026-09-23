import { describe, expect, it } from 'vitest';
import { naturalCompare, numberComments, sortByName } from '@/lib/sort';
import type { Comment } from '@/lib/types';

const c = (id: string, rect: Comment['rect'], createdAt = 0): Comment => ({ id, slideId: 's', rect, text: id, createdAt });

describe('sort', () => {
  it('sorts filenames naturally', () => {
    const names = ['slide-10.png', 'slide-2.png', 'slide-1.png', 'Slide-3.png'];
    expect(names.slice().sort(naturalCompare)).toEqual(['slide-1.png', 'slide-2.png', 'Slide-3.png', 'slide-10.png']);
    expect(sortByName([{ name: 'b2' }, { name: 'b10' }, { name: 'a' }]).map((x) => x.name)).toEqual(['a', 'b2', 'b10']);
  });
  it('numbers region comments in reading order and leaves general notes unnumbered', () => {
    const out = numberComments([
      c('general', null, 1),
      c('low', { x: 10, y: 60, w: 5, h: 5 }, 2),
      c('right', { x: 50, y: 10, w: 5, h: 5 }, 3),
      c('left', { x: 5, y: 10, w: 5, h: 5 }, 4),
    ]);
    expect(out.map((o) => [o.comment.id, o.number])).toEqual([
      ['left', 1],
      ['right', 2],
      ['low', 3],
      ['general', null],
    ]);
  });
});
