import { useState } from 'react';
import { useStore } from './store';
import { IconBack, IconBrand, IconHelp, IconSave, IconSettings, IconSheet } from './icons';
import { HelpDialog } from './HelpDialog';
import { DeckMenu } from './DeckMenu';
import { SettingsDialog } from './SettingsDialog';
import { useExport } from '@/features/export/useExport';
import { plural } from '@/lib/format';

export function Header() {
  const deck = useStore((s) => s.deck);
  const current = useStore((s) => s.current);
  const comments = useStore((s) => s.comments);
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const dirty = useStore((s) => s.dirty);
  const { saveProject, busy } = useExport();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <header className="header">
      <div className="brand">
        <IconBrand className="brand-mark" />
        <h1>SlideNotes</h1>
      </div>
      <DeckMenu />
      <span className="header-spacer" />
      {deck && (
        <div className="header-meta">
          {view === 'review' && (
            <span className="num">
              Slide <b>{current + 1}</b> / {deck.slides.length}
            </span>
          )}
          <span className="count-pill">
            <b className="num">{comments.length}</b> {comments.length === 1 ? 'comment' : 'comments'}
          </span>
        </div>
      )}
      <div className="header-actions">
        {deck && (
          <>
            <button
              type="button"
              className={`btn${dirty ? ' primary' : ''}${busy === 'project' ? ' is-busy' : ''}`}
              onClick={() => void saveProject()}
              disabled={!!busy}
              title="Save the deck and its comments as a project file you can reopen later"
              aria-label={dirty ? 'Save project, unsaved changes' : 'Save project'}
            >
              <IconSave /> <span className="btn-label">Save project</span>
            </button>
            <button
              type="button"
              className="btn ghost"
              aria-pressed={view === 'sheet'}
              aria-label={view === 'sheet' ? 'Back to review' : 'Comment sheet'}
              onClick={() => setView(view === 'sheet' ? 'review' : 'sheet')}
            >
              {view === 'sheet' ? (
                <>
                  <IconBack /> <span className="btn-label">Back to review</span>
                </>
              ) : (
                <>
                  <IconSheet /> <span className="btn-label">Comment sheet</span>
                </>
              )}
            </button>
          </>
        )}
        <button type="button" className="btn icon ghost" aria-label="Help and keyboard shortcuts" aria-haspopup="dialog" onClick={() => setHelpOpen(true)}>
          <IconHelp />
        </button>
        <button type="button" className="btn icon ghost" aria-label="Settings" aria-haspopup="dialog" onClick={() => setSettingsOpen(true)}>
          <IconSettings />
        </button>
      </div>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
      {deck && <span className="visually-hidden">{plural(comments.length, 'comment')} in this deck.</span>}
    </header>
  );
}
