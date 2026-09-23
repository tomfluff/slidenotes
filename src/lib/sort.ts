import type { Comment } from './types';

/** Natural filename order, so slide-10.png sorts after slide-2.png. */
export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

export function sortByName<T extends { name: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => naturalCompare(a.name, b.name));
}

/**
 * Reading order for comments on one slide: region comments top to bottom, then
 * left to right, then by creation time. General notes come last, by creation time.
 */
export function byPosition(a: Comment, b: Comment): number {
  const ay = a.rect ? a.rect.y : Number.POSITIVE_INFINITY;
  const by = b.rect ? b.rect.y : Number.POSITIVE_INFINITY;
  if (ay !== by) return ay - by;
  const ax = a.rect ? a.rect.x : Number.POSITIVE_INFINITY;
  const bx = b.rect ? b.rect.x : Number.POSITIVE_INFINITY;
  if (ax !== bx) return ax - bx;
  return a.createdAt - b.createdAt;
}

export interface NumberedComment {
  comment: Comment;
  /** 1-based number for region comments; null for general notes. */
  number: number | null;
}

/** Sorts comments into reading order and assigns badge numbers to region comments. */
export function numberComments(list: readonly Comment[]): NumberedComment[] {
  let n = 0;
  return [...list].sort(byPosition).map((comment) => ({
    comment,
    number: comment.rect ? ++n : null,
  }));
}
