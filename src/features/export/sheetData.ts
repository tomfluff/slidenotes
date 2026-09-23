import { numberComments, type NumberedComment } from '@/lib/sort';
import type { Comment, Deck, Slide } from '@/lib/types';

export interface SheetBlock {
  slide: Slide;
  items: NumberedComment[];
  regions: NumberedComment[];
  generals: NumberedComment[];
}

/** One block per slide that has comments, in slide order, with badge numbers assigned. */
export function buildSheetBlocks(deck: Deck, comments: readonly Comment[]): SheetBlock[] {
  const bySlide = new Map<string, Comment[]>();
  for (const c of comments) {
    const list = bySlide.get(c.slideId);
    if (list) list.push(c);
    else bySlide.set(c.slideId, [c]);
  }
  return [...deck.slides]
    .sort((a, b) => a.index - b.index)
    .flatMap((slide) => {
      const list = bySlide.get(slide.id);
      if (!list?.length) return [];
      const items = numberComments(list);
      return [{ slide, items, regions: items.filter((i) => i.number !== null), generals: items.filter((i) => i.number === null) }];
    });
}

export function sheetSummary(deck: Deck, comments: readonly Comment[]): { count: number; slides: number } {
  const ids = new Set(deck.slides.map((s) => s.id));
  const own = comments.filter((c) => ids.has(c.slideId));
  return { count: own.length, slides: new Set(own.map((c) => c.slideId)).size };
}
