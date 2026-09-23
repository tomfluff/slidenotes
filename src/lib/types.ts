/** Rectangle in percentages of slide width and height, 0 to 100. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Slide {
  /** Stable id, generated once at import. Comments key to this, never to index. */
  id: string;
  /** Display order, mutable. */
  index: number;
  /** Natural pixel size, for aspect ratio and PDF layout. */
  width: number;
  height: number;
  /** Original file name or page label, used in exports. */
  sourceName?: string;
  /** Text content extracted at import (PDF pages), exposed as the slide description. */
  alt?: string;
}

export interface Comment {
  id: string;
  slideId: string;
  /** null means a general note on the slide. */
  rect: Rect | null;
  text: string;
  author?: string;
  createdAt: number;
  updatedAt?: number;
  resolved?: boolean;
}

export interface Deck {
  id: string;
  name: string;
  createdAt: number;
  slides: Slide[];
  /** True for the bundled demo deck, which is re-seeded on demand and never counts as user work. */
  sample?: boolean;
}

export interface ReviewProject {
  schemaVersion: 1;
  deck: Deck;
  comments: Comment[];
}

export const SCHEMA_VERSION = 1 as const;
