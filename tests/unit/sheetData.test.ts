import { describe, expect, it } from 'vitest';
import { buildSheetBlocks, sheetSummary } from '@/features/export/sheetData';
import type { Comment, Deck } from '@/lib/types';

const deck: Deck = {
  id: 'd', name: 'D', createdAt: 0,
  slides: [
    { id: 's1', index: 0, width: 16, height: 9 },
    { id: 's2', index: 1, width: 16, height: 9 },
    { id: 's3', index: 2, width: 16, height: 9 },
  ],
};
const comments: Comment[] = [
  { id: 'a', slideId: 's3', rect: { x: 1, y: 1, w: 2, h: 2 }, text: 'a', createdAt: 1 },
  { id: 'b', slideId: 's1', rect: null, text: 'b', createdAt: 2 },
  { id: 'c', slideId: 's1', rect: { x: 5, y: 5, w: 2, h: 2 }, text: 'c', createdAt: 3 },
];

describe('sheet data', () => {
  it('builds one block per commented slide in slide order', () => {
    const blocks = buildSheetBlocks(deck, comments);
    expect(blocks.map((b) => b.slide.id)).toEqual(['s1', 's3']);
    expect(blocks[0]?.regions.map((r) => r.comment.id)).toEqual(['c']);
    expect(blocks[0]?.generals.map((r) => r.comment.id)).toEqual(['b']);
  });
  it('summarises counts', () => {
    expect(sheetSummary(deck, comments)).toEqual({ count: 3, slides: 2 });
  });
});
