import { useMemo, useState } from 'react';
import { useStore } from '@/app/store';
import { buildSheetBlocks, sheetSummary } from '@/features/export/sheetData';
import { useExport } from '@/features/export/useExport';
import { fmtDateTimeLong, plural } from '@/lib/format';
import { Markers } from '@/features/review/Markers';
import { IconDoc, IconPrint, IconSave } from '@/app/icons';

export function Sheet() {
  const deck = useStore((s) => s.deck);
  const comments = useStore((s) => s.comments);
  const urls = useStore((s) => s.urls);
  const goTo = useStore((s) => s.goTo);
  const setView = useStore((s) => s.setView);
  const [hideResolved, setHideResolved] = useState(false);
  const { exportPdf, exportHtml, exportMarkdown, saveProject, busy } = useExport();

  const visible = useMemo(() => (hideResolved ? comments.filter((c) => !c.resolved) : comments), [comments, hideResolved]);
  const blocks = useMemo(() => (deck ? buildSheetBlocks(deck, visible) : []), [deck, visible]);
  if (!deck) return null;
  const sum = sheetSummary(deck, visible);
  const resolvedCount = comments.filter((c) => c.resolved).length;

  return (
    <main className="sheet-wrap" aria-labelledby="sheet-title">
      <div className="sheet">
        <div className="sheet-meta">
          <h2 id="sheet-title">{deck.name}, review notes</h2>
          <span className="sub">
            {plural(sum.count, 'comment')} across {plural(sum.slides, 'slide')} · generated {fmtDateTimeLong(Date.now())}
          </span>
        </div>

        <div className="sheet-tools no-print" role="group" aria-label="Export">
          <button type="button" className={`btn primary${busy === 'pdf' ? ' is-busy' : ''}`} onClick={() => void exportPdf(visible)} disabled={!!busy || !blocks.length}>
            <IconDoc /> Download PDF
          </button>
          <button type="button" className={`btn${busy === 'html' ? ' is-busy' : ''}`} onClick={() => void exportHtml(visible)} disabled={!!busy || !blocks.length}>
            Download HTML
          </button>
          <button type="button" className={`btn${busy === 'md' ? ' is-busy' : ''}`} onClick={() => void exportMarkdown(visible)} disabled={!!busy || !blocks.length}>
            Markdown bundle
          </button>
          <button type="button" className="btn ghost" onClick={() => window.print()} disabled={!blocks.length}>
            <IconPrint /> Print
          </button>
          <span className="spacer" />
          {resolvedCount > 0 && (
            <label className="check">
              <input type="checkbox" checked={hideResolved} onChange={(e) => setHideResolved(e.target.checked)} /> Hide resolved ({resolvedCount})
            </label>
          )}
          <button type="button" className={`btn${busy === 'project' ? ' is-busy' : ''}`} onClick={() => void saveProject()} disabled={!!busy}>
            <IconSave /> Save project
          </button>
        </div>

        {blocks.length === 0 && (
          <p className="sheet-empty">
            {comments.length ? 'Every comment is resolved and hidden.' : 'No comments yet. Go back to the review and mark up a slide first.'}
          </p>
        )}

        {blocks.map((b) => {
          const src = urls.get(b.slide.id);
          const label = `slide ${b.slide.index + 1} of ${deck.slides.length}`;
          return (
            <article className="sheet-block" key={b.slide.id} aria-labelledby={`sheet-h-${b.slide.id}`} data-testid="sheet-block">
              <div>
                <h3 id={`sheet-h-${b.slide.id}`}>
                  Slide {b.slide.index + 1} <span className="mono">/ {deck.slides.length}</span>
                </h3>
                <a
                  className="sheet-thumb-link"
                  href="#review"
                  aria-label={`Open slide ${b.slide.index + 1} in the review`}
                  onClick={(e) => {
                    e.preventDefault();
                    goTo(b.slide.index);
                    setView('review');
                  }}
                >
                  <div className="sheet-frame" style={{ aspectRatio: `${b.slide.width} / ${b.slide.height}` }}>
                    {src ? <img src={src} alt={`Slide ${b.slide.index + 1}`} /> : <div className="missing">Slide image unavailable</div>}
                    <Markers items={b.items} slideLabel={label} />
                  </div>
                </a>
              </div>
              <div>
                {b.regions.length > 0 && (
                  <ol className="sheet-notes" aria-label={`Region comments on slide ${b.slide.index + 1}`}>
                    {b.regions.map(({ comment, number }) => (
                      <li key={comment.id} className={comment.resolved ? 'resolved' : ''}>
                        <span className={`badge-num mono${comment.resolved ? ' resolved' : ''}`} aria-hidden="true">{number}</span>
                        <div>
                          <span className="visually-hidden">Region {number}: </span>
                          <p>{comment.text}</p>
                          {(comment.author || comment.resolved) && (
                            <small>
                              {[comment.author, comment.resolved ? 'resolved' : null].filter(Boolean).join(' · ')}
                            </small>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
                {b.generals.length > 0 && (
                  <>
                    <h4>General notes</h4>
                    <ul className="sheet-notes" aria-label={`General notes on slide ${b.slide.index + 1}`}>
                      {b.generals.map(({ comment }) => (
                        <li key={comment.id} className={comment.resolved ? 'resolved' : ''}>
                          <span className="badge-num mono general" aria-hidden="true">•</span>
                          <div>
                            <p>{comment.text}</p>
                            {(comment.author || comment.resolved) && (
                              <small>{[comment.author, comment.resolved ? 'resolved' : null].filter(Boolean).join(' · ')}</small>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
