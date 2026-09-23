import { useEffect, useId, useRef, useState } from 'react';
import { useStore } from './store';
import { IconCaret, IconEdit, IconFolder, IconUpload } from './icons';
import { fmtTime, plural } from '@/lib/format';
import { ACCEPT, useImport } from '@/features/deck/useImport';
import { DeckRow } from '@/features/deck/DeckRow';

/** Deck switcher: a popover (top layer, so no ancestor can clip it) with the list and import actions. */
export function DeckMenu() {
  const deck = useStore((s) => s.deck);
  const decks = useStore((s) => s.decks);
  const dirty = useStore((s) => s.dirty);
  const renameDeck = useStore((s) => s.renameDeck);
  const { importFiles } = useImport();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const projRef = useRef<HTMLInputElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const b = btnRef.current?.getBoundingClientRect();
      const p = popRef.current;
      if (!b || !p) return;
      p.style.top = `${b.bottom + 6}px`;
      p.style.left = `${Math.max(8, Math.min(b.left, window.innerWidth - p.offsetWidth - 8))}px`;
    };
    place();
    const onDoc = (e: MouseEvent) => {
      if (popRef.current?.contains(e.target as Node) || btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', place);
    popRef.current?.querySelector<HTMLElement>('button, input')?.focus();
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', place);
    };
  }, [open]);

  if (!deck) return null;

  return (
    <div>
      <button
        ref={btnRef}
        type="button"
        className={`deck-btn${dirty ? ' unsaved' : ''}`}
        aria-expanded={open}
        aria-controls={id}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
        title={dirty ? 'Unsaved changes: save a project file to keep them beyond this browser' : 'Switch or load a deck'}
      >
        <span className="name">{deck.name}</span>
        <IconCaret />
        <span className="visually-hidden">{dirty ? ', unsaved changes' : ''}</span>
      </button>
      {open && (
        <div ref={popRef} id={id} className="popover" role="dialog" aria-label="Decks">
          <h3>Decks in this browser</h3>
          <ul className="deck-list">
            {decks.map((d) => (
              <DeckRow key={d.id} deck={d} meta={`${plural(d.slides.length, 'slide')} · ${d.sample ? 'demo' : fmtTime(d.createdAt)}`} onOpen={() => setOpen(false)} />
            ))}
          </ul>
          <hr />
          <div className="popover-actions">
            <button
              type="button"
              className="btn"
              onClick={() => {
                const name = window.prompt('Deck name', deck.name);
                if (name !== null) void renameDeck(name);
              }}
            >
              <IconEdit /> Rename current deck
            </button>
            <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
              <IconUpload /> Load a PDF, PowerPoint or images
            </button>
            <button type="button" className="btn" onClick={() => projRef.current?.click()}>
              <IconFolder /> Open a project file
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files?.length) {
                void importFiles(e.target.files);
                setOpen(false);
              }
              e.target.value = '';
            }}
          />
          <input
            ref={projRef}
            type="file"
            accept=".zip,.slidenotes,application/zip"
            hidden
            onChange={(e) => {
              if (e.target.files?.length) {
                void importFiles(e.target.files);
                setOpen(false);
              }
              e.target.value = '';
            }}
          />
        </div>
      )}
    </div>
  );
}
