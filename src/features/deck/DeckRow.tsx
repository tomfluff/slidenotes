import { useStore } from '@/app/store';
import { IconTrash } from '@/app/icons';
import type { Deck } from '@/lib/types';

export function DeckRow({ deck, meta, onOpen }: { deck: Deck; meta: string; onOpen?: () => void }) {
  const activeId = useStore((s) => s.deck?.id);
  const openDeck = useStore((s) => s.openDeck);
  const deleteDeck = useStore((s) => s.deleteDeck);
  const toast = useStore((s) => s.toast);
  const dirty = useStore((s) => s.dirty);
  const active = activeId === deck.id;

  const remove = () => {
    const ok = window.confirm(`Delete "${deck.name}" and all of its comments from this browser? This cannot be undone.`);
    if (!ok) return;
    void deleteDeck(deck.id).then(() => toast('info', `Deleted "${deck.name}".`));
  };

  return (
    <li className="deck-row">
      <button
        type="button"
        className="deck-row-main"
        aria-current={active ? 'true' : undefined}
        onClick={() => {
          if (active) return onOpen?.();
          if (dirty && !window.confirm('You have unsaved changes in the current deck. They stay in this browser, but are not in a project file yet. Switch anyway?')) return;
          void openDeck(deck.id).then(() => onOpen?.());
        }}
      >
        <span className="dn">{deck.name}</span>
        <span className="dm">
          {meta}
          {active ? ' · open' : ''}
        </span>
      </button>
      <button type="button" className="icon-btn danger" onClick={remove} aria-label={`Delete deck ${deck.name}`}>
        <IconTrash />
      </button>
    </li>
  );
}
