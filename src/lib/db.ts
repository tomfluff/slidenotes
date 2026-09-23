import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Comment, Deck } from './types';

interface SlideNotesDB extends DBSchema {
  decks: { key: string; value: Deck };
  comments: {
    key: string;
    value: Comment & { deckId: string };
    indexes: { byDeck: string };
  };
  images: { key: string; value: Blob };
  meta: { key: string; value: unknown };
}

let dbPromise: Promise<IDBPDatabase<SlideNotesDB>> | null = null;

function db(): Promise<IDBPDatabase<SlideNotesDB>> {
  if (!dbPromise) {
    dbPromise = openDB<SlideNotesDB>('slidenotes', 1, {
      upgrade(d) {
        d.createObjectStore('decks', { keyPath: 'id' });
        const c = d.createObjectStore('comments', { keyPath: 'id' });
        c.createIndex('byDeck', 'deckId');
        d.createObjectStore('images');
        d.createObjectStore('meta');
      },
    });
  }
  return dbPromise;
}

export const storage = {
  async listDecks(): Promise<Deck[]> {
    return (await db()).getAll('decks');
  },
  async getDeck(id: string): Promise<Deck | undefined> {
    return (await db()).get('decks', id);
  },
  async putDeck(deck: Deck): Promise<void> {
    await (await db()).put('decks', deck);
  },
  async deleteDeck(id: string): Promise<void> {
    const d = await db();
    const deck = await d.get('decks', id);
    const tx = d.transaction(['decks', 'comments', 'images'], 'readwrite');
    const comments = await tx.objectStore('comments').index('byDeck').getAllKeys(id);
    await Promise.all([
      tx.objectStore('decks').delete(id),
      ...comments.map((k) => tx.objectStore('comments').delete(k)),
      ...(deck?.slides ?? []).map((s) => tx.objectStore('images').delete(s.id)),
    ]);
    await tx.done;
  },

  async putImage(slideId: string, blob: Blob): Promise<void> {
    await (await db()).put('images', blob, slideId);
  },
  async getImage(slideId: string): Promise<Blob | undefined> {
    return (await db()).get('images', slideId);
  },
  async getImages(slideIds: readonly string[]): Promise<Map<string, Blob>> {
    const d = await db();
    const tx = d.transaction('images');
    const out = new Map<string, Blob>();
    await Promise.all(
      slideIds.map(async (id) => {
        const b = await tx.store.get(id);
        if (b) out.set(id, b);
      }),
    );
    return out;
  },

  async listComments(deckId: string): Promise<Comment[]> {
    const rows = await (await db()).getAllFromIndex('comments', 'byDeck', deckId);
    return rows.map(({ deckId: _d, ...c }) => c);
  },
  async putComment(deckId: string, comment: Comment): Promise<void> {
    await (await db()).put('comments', { ...comment, deckId });
  },
  async putComments(deckId: string, comments: readonly Comment[]): Promise<void> {
    const tx = (await db()).transaction('comments', 'readwrite');
    await Promise.all(comments.map((c) => tx.store.put({ ...c, deckId })));
    await tx.done;
  },
  async deleteComment(deckId: string, id: string): Promise<void> {
    const d = await db();
    const row = await d.get('comments', id);
    if (row && row.deckId === deckId) await d.delete('comments', id);
  },

  async getMeta<T>(key: string): Promise<T | undefined> {
    return (await (await db()).get('meta', key)) as T | undefined;
  },
  async setMeta(key: string, value: unknown): Promise<void> {
    await (await db()).put('meta', value, key);
  },

  /**
   * Writes a whole deck, its images and its comments in one transaction, replacing any
   * stored deck with the same id so an older project file never merges with newer local rows.
   */
  async importDeck(deck: Deck, images: Map<string, Blob>, comments: readonly Comment[]): Promise<void> {
    const tx = (await db()).transaction(['decks', 'comments', 'images'], 'readwrite');
    const previous = await tx.objectStore('decks').get(deck.id);
    const oldComments = await tx.objectStore('comments').index('byDeck').getAllKeys(deck.id);
    await Promise.all([
      ...oldComments.map((k) => tx.objectStore('comments').delete(k)),
      ...(previous?.slides ?? []).map((s) => tx.objectStore('images').delete(s.id)),
    ]);
    await Promise.all([
      tx.objectStore('decks').put(deck),
      ...deck.slides.map((s) => {
        const b = images.get(s.id);
        return b ? tx.objectStore('images').put(b, s.id) : Promise.resolve();
      }),
      ...comments.map((c) => tx.objectStore('comments').put({ ...c, deckId: deck.id })),
    ]);
    await tx.done;
  },
};
