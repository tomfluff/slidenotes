import { useEffect, useRef } from 'react';
import { useStore } from '@/app/store';

export function Filmstrip() {
  const deck = useStore((s) => s.deck);
  const current = useStore((s) => s.current);
  const urls = useStore((s) => s.urls);
  const comments = useStore((s) => s.comments);
  const goTo = useStore((s) => s.goTo);
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${current}"]`);
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [current]);

  if (!deck) return null;
  const counts = new Map<string, number>();
  for (const c of comments) counts.set(c.slideId, (counts.get(c.slideId) ?? 0) + 1);

  return (
    <nav className="rail" aria-label="Slides">
      <ol ref={listRef}>
        {deck.slides.map((s) => {
          const n = counts.get(s.id) ?? 0;
          const active = s.index === current;
          return (
            <li key={s.id} style={{ display: 'contents' }}>
              <button
                type="button"
                className="thumb"
                data-index={s.index}
                aria-current={active ? 'true' : undefined}
                aria-label={`Slide ${s.index + 1}${n ? `, ${n} comment${n === 1 ? '' : 's'}` : ''}${active ? ', current' : ''}`}
                onClick={() => goTo(s.index)}
              >
                {urls.get(s.id) ? <img src={urls.get(s.id)} alt="" loading="lazy" /> : null}
                <span className="n mono" aria-hidden="true">{s.index + 1}</span>
                {n > 0 && (
                  <span className="badge mono" aria-hidden="true">
                    {n}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
