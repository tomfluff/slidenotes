import { useRef, useState, type DragEvent } from 'react';
import { useStore } from '@/app/store';
import { IconFolder, IconShield, IconUpload } from '@/app/icons';
import { fmtTime, plural } from '@/lib/format';
import { ACCEPT, useImport } from './useImport';
import { DeckRow } from './DeckRow';

export function Landing() {
  const decks = useStore((s) => s.decks);
  const busy = useStore((s) => s.busy);
  const { importFiles, importSample } = useImport();
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const projectRef = useRef<HTMLInputElement>(null);

  // The document-level drop handler in App does the import; this only clears the highlight.
  const onDrop = (_e: DragEvent) => setDrag(false);

  return (
    <main className="landing" aria-labelledby="landing-title">
      <div className="landing-inner">
        <div>
          <h2 id="landing-title">Review a slide deck, one region at a time.</h2>
          <p className="lede">
            Load a deck, drag over anything that needs attention, write the comment. Export a sheet that
            shows each comment next to the exact place it refers to, for co-authors or for an AI agent that
            will make the fixes.
          </p>
        </div>

        <div
          className={`drop${drag ? ' drag' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
        >
          <IconUpload className="drop-icon" />
          {busy ? (
            <div className="progress" role="status">
              <span>{busy.label}</span>
              <progress value={busy.done} max={Math.max(1, busy.total)} aria-label={busy.label} />
            </div>
          ) : (
            <>
              <p>
                <b>Drop a PDF or PowerPoint file here</b>, or PNG/JPG images, one per slide. PowerPoint files are
                converted in your browser by LibreOffice; a PDF exported from PowerPoint is the most faithful.
              </p>
              <div className="drop-actions">
                <button type="button" className="btn primary" onClick={() => fileRef.current?.click()}>
                  <IconUpload /> Choose PDF, PowerPoint or images
                </button>
                <button type="button" className="btn" onClick={() => projectRef.current?.click()}>
                  <IconFolder /> Open a project file
                </button>
                <button type="button" className="btn ghost" onClick={() => void importSample()}>
                  Try the demo deck
                </button>
              </div>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files?.length) void importFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <input
            ref={projectRef}
            type="file"
            accept=".zip,.slidenotes,application/zip"
            hidden
            onChange={(e) => {
              if (e.target.files?.length) void importFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>

        <p className="privacy">
          <IconShield />
          <span>
            <b>Your slides never leave your browser.</b> Decks are rendered and stored locally, so work under embargo
            stays on your machine; only anonymous page-view analytics are collected. PowerPoint conversion downloads an
            engine once. Save a project file to keep your review beyond this browser.
          </span>
        </p>

        {decks.length > 0 && (
          <div className="landing-decks">
            <h3>Decks in this browser</h3>
            <ul>
              {decks.map((d) => (
                <DeckRow key={d.id} deck={d} meta={`${plural(d.slides.length, 'slide')} · ${d.sample ? 'demo' : fmtTime(d.createdAt)}`} />
              ))}
            </ul>
          </div>
        )}

        <div className="landing-how">
          <b>How it works</b>
          <ol>
            <li>Drag a rectangle over the part of a slide you want to comment on, then write the comment. Each region gets a number that matches the comment list. Press <kbd>N</kbd> for a note about the whole slide.</li>
            <li>Drag a region to move it, or drag its handles to resize it. Hover a comment to see where it points.</li>
            <li>Open the comment sheet and export it as PDF, HTML, or a Markdown bundle with coordinates and crops for co-authors or an AI agent. Save a project file to come back later.</li>
          </ol>
        </div>
      </div>
    </main>
  );
}
