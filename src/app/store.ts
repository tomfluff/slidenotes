import { create } from 'zustand';
import { storage } from '@/lib/db';
import { uid } from '@/lib/id';
import { clampRect, roundRect } from '@/lib/geometry';
import type { Comment, Deck, Rect } from '@/lib/types';
import type { IngestedDeck } from '@/features/deck/ingest';

export type View = 'review' | 'sheet';
export type ExportKind = 'pdf' | 'html' | 'md' | 'project';

export interface Toast {
  id: number;
  kind: 'info' | 'ok' | 'err';
  text: string;
}

export interface Busy {
  label: string;
  done: number;
  total: number;
}

export interface PptxPrompt {
  file: File;
  /** Why an earlier conversion attempt failed, if it did. */
  error?: string;
}

export interface Draft {
  /** null: general note. */
  rect: Rect | null;
}

interface State {
  ready: boolean;
  decks: Deck[];
  deck: Deck | null;
  comments: Comment[];
  images: Map<string, Blob>;
  urls: Map<string, string>;
  current: number;
  view: View;
  draft: Draft | null;
  editingId: string | null;
  hotId: string | null;
  /** Where the highlight came from: only a hovered comment card pulses the region. */
  hotSource: 'card' | 'slide' | null;
  /** The region selected for moving or resizing. */
  selectedId: string | null;
  /** True when the open deck has changes not yet written to a project file. */
  dirty: boolean;
  /** Increments on every mutation of the open deck; a save is only "clean" if it matches. */
  revision: number;
  busy: Busy | null;
  exporting: ExportKind | null;
  toasts: Toast[];
  announcement: string;
  /** Set once IndexedDB has failed; the session continues in memory. */
  storageBroken: boolean;
  /** A dropped PowerPoint file awaiting the convert-or-export dialog. */
  pptxPrompt: PptxPrompt | null;
}

interface Actions {
  init: () => Promise<void>;
  openDeck: (id: string) => Promise<void>;
  closeDeck: () => void;
  addDeck: (ingested: IngestedDeck, comments?: Comment[]) => Promise<void>;
  deleteDeck: (id: string) => Promise<void>;
  renameDeck: (name: string) => Promise<void>;
  goTo: (index: number) => void;
  step: (delta: number) => void;
  setView: (v: View) => void;
  startDraft: (rect: Rect | null) => void;
  cancelDraft: () => void;
  saveDraft: (text: string, author: string) => Promise<void>;
  startEdit: (id: string | null) => void;
  updateComment: (id: string, patch: Partial<Pick<Comment, 'text' | 'rect' | 'resolved' | 'author'>>) => Promise<void>;
  deleteComment: (id: string) => Promise<void>;
  setHot: (id: string | null, source?: 'card' | 'slide') => void;
  setSelected: (id: string | null) => void;
  /** Clears the dirty flag only if nothing changed since `revision` was read. */
  markSaved: (deckId: string, revision: number) => void;
  setBusy: (b: Busy | null) => void;
  setExporting: (k: ExportKind | null) => void;
  toast: (kind: Toast['kind'], text: string) => void;
  dismissToast: (id: number) => void;
  announce: (text: string) => void;
  setPptxPrompt: (p: PptxPrompt | null) => void;
}

export type Store = State & Actions;

let toastSeq = 0;
/** Load token: only the newest openDeck call may commit its result. */
let loadSeq = 0;

function revokeAll(urls: Map<string, string>): void {
  for (const u of urls.values()) URL.revokeObjectURL(u);
}

export const useStore = create<Store>()((set, get) => {
  /**
   * Runs a storage write after the state has already been updated. The session never
   * blocks on IndexedDB; a failure is reported once and work continues in memory.
   */
  const persist = async (op: () => Promise<unknown>): Promise<void> => {
    try {
      await op();
    } catch (err) {
      console.error(err);
      if (!get().storageBroken) {
        set({ storageBroken: true });
        get().toast('err', 'Local storage failed. Your work continues in memory; save a project file to keep it.');
      }
    }
  };

  const touch = (): { dirty: true; revision: number } => ({ dirty: true, revision: get().revision + 1 });

  return {
    ready: false,
    decks: [],
    deck: null,
    comments: [],
    images: new Map(),
    urls: new Map(),
    current: 0,
    view: 'review',
    draft: null,
    editingId: null,
    hotId: null,
    hotSource: null,
    selectedId: null,
    dirty: false,
    revision: 0,
    busy: null,
    exporting: null,
    toasts: [],
    announcement: '',
    storageBroken: false,
    pptxPrompt: null,

    async init() {
      try {
        const decks = (await storage.listDecks()).sort((a, b) => b.createdAt - a.createdAt);
        set({ decks });
        const active = await storage.getMeta<string>('activeDeckId');
        if (active && decks.some((d) => d.id === active)) await get().openDeck(active);
      } catch (err) {
        console.error(err);
        set({ storageBroken: true });
        get().toast('err', 'Could not open local storage. Work will not be saved between visits; save a project file instead.');
      } finally {
        set({ ready: true });
      }
    },

    async openDeck(id) {
      const token = ++loadSeq;
      const deck = await storage.getDeck(id);
      if (!deck || token !== loadSeq) return;
      const [comments, images] = await Promise.all([storage.listComments(id), storage.getImages(deck.slides.map((s) => s.id))]);
      if (token !== loadSeq) return;
      revokeAll(get().urls);
      const urls = new Map<string, string>();
      for (const [sid, blob] of images) urls.set(sid, URL.createObjectURL(blob));
      set({
        deck, comments, images, urls, current: 0, view: 'review',
        draft: null, editingId: null, hotId: null, selectedId: null, dirty: false, revision: 0,
      });
      void persist(() => storage.setMeta('activeDeckId', id));
    },

    closeDeck() {
      loadSeq++;
      revokeAll(get().urls);
      set({ deck: null, comments: [], images: new Map(), urls: new Map(), current: 0, draft: null, editingId: null, selectedId: null, view: 'review', dirty: false, revision: 0 });
      void persist(() => storage.setMeta('activeDeckId', null));
    },

    async addDeck(ingested, comments = []) {
      // Replace semantics: reopening a project with the same deck id replaces the stored copy.
      await persist(() => storage.importDeck(ingested.deck, ingested.images, comments));
      const decks = [ingested.deck, ...get().decks.filter((d) => d.id !== ingested.deck.id)];
      set({ decks });
      if (get().storageBroken) {
        // In-memory fallback: show the deck straight from the ingested blobs.
        loadSeq++;
        revokeAll(get().urls);
        const urls = new Map<string, string>();
        for (const [sid, blob] of ingested.images) urls.set(sid, URL.createObjectURL(blob));
        set({ deck: ingested.deck, comments, images: ingested.images, urls, current: 0, view: 'review', draft: null, editingId: null, hotId: null, selectedId: null, dirty: false, revision: 0 });
        return;
      }
      await get().openDeck(ingested.deck.id);
    },

    async deleteDeck(id) {
      set({ decks: get().decks.filter((d) => d.id !== id) });
      if (get().deck?.id === id) get().closeDeck();
      await persist(() => storage.deleteDeck(id));
    },

    async renameDeck(name) {
      const deck = get().deck;
      if (!deck) return;
      const next = { ...deck, name: name.trim() || deck.name };
      set({ deck: next, decks: get().decks.map((d) => (d.id === next.id ? next : d)), ...touch() });
      await persist(() => storage.putDeck(next));
    },

    goTo(index) {
      const deck = get().deck;
      if (!deck) return;
      const i = Math.max(0, Math.min(deck.slides.length - 1, index));
      if (i === get().current) return;
      set({ current: i, draft: null, editingId: null, hotId: null, selectedId: null });
    },
    step(delta) {
      get().goTo(get().current + delta);
    },
    setView(view) {
      set({ view, draft: null, editingId: null, hotId: null, selectedId: null });
    },

    startDraft(rect) {
      set({ draft: { rect: rect ? roundRect(clampRect(rect)) : null }, editingId: null, selectedId: null });
    },
    cancelDraft() {
      set({ draft: null });
    },
    async saveDraft(text, author) {
      const { deck, draft, current } = get();
      const slide = deck?.slides[current];
      if (!deck || !draft || !slide || !text.trim()) return;
      const c: Comment = { id: uid(), slideId: slide.id, rect: draft.rect, text: text.trim(), createdAt: Date.now() };
      if (author.trim()) c.author = author.trim();
      set({ comments: [...get().comments, c], draft: null, ...touch() });
      await persist(() => storage.putComment(deck.id, c));
    },

    startEdit(id) {
      set({ editingId: id, draft: null });
    },
    async updateComment(id, patch) {
      const { deck } = get();
      const existing = get().comments.find((c) => c.id === id);
      if (!deck || !existing) return;
      const next: Comment = { ...existing, ...patch, updatedAt: Date.now() };
      if (patch.rect) next.rect = roundRect(clampRect(patch.rect));
      set({ comments: get().comments.map((c) => (c.id === id ? next : c)), editingId: null, ...touch() });
      await persist(() => storage.putComment(deck.id, next));
    },
    async deleteComment(id) {
      const { deck } = get();
      if (!deck || !get().comments.some((c) => c.id === id)) return;
      set({ comments: get().comments.filter((c) => c.id !== id), hotId: null, selectedId: get().selectedId === id ? null : get().selectedId, ...touch() });
      await persist(() => storage.deleteComment(deck.id, id));
    },

    setHot(id, source = 'slide') {
      if (get().hotId !== id || get().hotSource !== (id ? source : null)) set({ hotId: id, hotSource: id ? source : null });
    },
    setSelected(id) {
      if (get().selectedId === id) return;
      set({ selectedId: id, draft: id ? null : get().draft });
    },
    markSaved(deckId, revision) {
      if (get().deck?.id === deckId && get().revision === revision) set({ dirty: false });
    },
    setBusy(busy) {
      set({ busy });
    },
    setExporting(exporting) {
      set({ exporting });
    },
    toast(kind, text) {
      const id = ++toastSeq;
      set({ toasts: [...get().toasts, { id, kind, text }] });
    },
    dismissToast(id) {
      set({ toasts: get().toasts.filter((t) => t.id !== id) });
    },
    announce(text) {
      // Re-announce identical strings by nudging the value.
      set({ announcement: get().announcement === text ? text + '\u200b' : text });
    },
    setPptxPrompt(pptxPrompt) {
      set({ pptxPrompt });
    },
  };
});

/** Comments on the current slide, unsorted. */
export function selectSlideComments(s: Store): Comment[] {
  const slide = s.deck?.slides[s.current];
  return slide ? s.comments.filter((c) => c.slideId === slide.id) : [];
}
