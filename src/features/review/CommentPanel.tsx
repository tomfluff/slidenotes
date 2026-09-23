import { useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore, selectSlideComments } from '@/app/store';
import { useSettings } from '@/app/settings';
import { numberComments } from '@/lib/sort';
import { fmtTime } from '@/lib/format';
import { describeRect } from '@/lib/geometry';
import type { Comment } from '@/lib/types';
import { IconCheck, IconEdit, IconPlus, IconTrash, IconUndo } from '@/app/icons';

export function CommentPanel() {
  const deck = useStore((s) => s.deck);
  const current = useStore((s) => s.current);
  const slideComments = useStore(useShallow(selectSlideComments));
  const draft = useStore((s) => s.draft);
  const editingId = useStore((s) => s.editingId);
  const hotId = useStore((s) => s.hotId);
  const startDraft = useStore((s) => s.startDraft);
  const items = useMemo(() => numberComments(slideComments), [slideComments]);
  const listRef = useRef<HTMLOListElement>(null);

  // A new composer scrolls into view.
  useEffect(() => {
    if (draft) listRef.current?.querySelector('.composer')?.scrollIntoView({ block: 'nearest' });
  }, [draft]);

  if (!deck) return null;
  const total = slideComments.length;

  return (
    <aside className="panel" aria-labelledby="panel-title">
      <div className="panel-head">
        <h2 id="panel-title">Comments on slide {current + 1}</h2>
        <span className="count-pill num" aria-hidden="true">
          <b>{total}</b>
        </span>
      </div>
      <ol className="panel-list" ref={listRef} aria-label={`Comments on slide ${current + 1}`}>
        {items.length === 0 && !draft && (
          <li className="empty" style={{ listStyle: 'none' }}>
            No comments on this slide yet. <b>Drag a rectangle</b> on the slide, or add a general note below.
          </li>
        )}
        {items.map(({ comment, number }) =>
          editingId === comment.id ? (
            <Composer key={comment.id} number={number} existing={comment} />
          ) : (
            <Card key={comment.id} comment={comment} number={number} hot={hotId === comment.id} />
          ),
        )}
        {draft && <Composer number={draft.rect ? nextNumber(items, draft.rect.y, draft.rect.x) : null} />}
      </ol>
      <div className="panel-foot">
        <button type="button" className="btn" onClick={() => startDraft(null)} disabled={!!draft && !draft.rect} title="New general note (N)">
          <IconPlus /> General note
        </button>
      </div>
    </aside>
  );
}

/** Predicts the badge number a new region would get, so the composer shows it. */
function nextNumber(items: ReturnType<typeof numberComments>, y: number, x: number): number {
  let n = 1;
  for (const { comment } of items) {
    if (!comment.rect) continue;
    if (comment.rect.y < y || (comment.rect.y === y && comment.rect.x <= x)) n++;
  }
  return n;
}

function Card({ comment, number, hot }: { comment: Comment; number: number | null; hot: boolean }) {
  const setHot = useStore((s) => s.setHot);
  const startEdit = useStore((s) => s.startEdit);
  const updateComment = useStore((s) => s.updateComment);
  const deleteComment = useStore((s) => s.deleteComment);
  const announce = useStore((s) => s.announce);
  const isRegion = !!comment.rect;

  return (
    <li
      id={`comment-${comment.id}`}
      className={`card${hot ? ' hot' : ''}${comment.resolved ? ' resolved' : ''}`}
      tabIndex={-1}
      onMouseEnter={() => setHot(comment.id, 'card')}
      onMouseLeave={() => setHot(null)}
      onFocus={() => setHot(comment.id, 'card')}
      onBlur={() => setHot(null)}
    >
      <div className="card-top">
        <span className={`badge-num mono${isRegion ? '' : ' general'}${comment.resolved ? ' resolved' : ''}`} aria-hidden="true">
          {isRegion ? number : '•'}
        </span>
        <span className="card-label">
          {isRegion ? `Region ${number}` : 'General note'}
          {comment.resolved ? ' · resolved' : ''}
        </span>
        <div className="card-actions">
          <button
            type="button"
            className="icon-btn"
            aria-label={comment.resolved ? `Reopen ${isRegion ? `region ${number}` : 'general note'}` : `Mark ${isRegion ? `region ${number}` : 'general note'} resolved`}
            aria-pressed={!!comment.resolved}
            onClick={() => {
              void updateComment(comment.id, { resolved: !comment.resolved });
              announce(comment.resolved ? 'Comment reopened.' : 'Comment marked resolved.');
            }}
          >
            {comment.resolved ? <IconUndo /> : <IconCheck />}
          </button>
          <button type="button" className="icon-btn" aria-label={`Edit ${isRegion ? `region ${number}` : 'general note'}`} onClick={() => startEdit(comment.id)}>
            <IconEdit />
          </button>
          <button
            type="button"
            className="icon-btn danger"
            aria-label={`Delete ${isRegion ? `region ${number}` : 'general note'}`}
            onClick={() => {
              void deleteComment(comment.id);
              announce('Comment deleted.');
            }}
          >
            <IconTrash />
          </button>
        </div>
      </div>
      {isRegion && comment.rect && <span className="visually-hidden">{describeRect(comment.rect)}. </span>}
      <p className="card-text">{comment.text}</p>
      <div className="card-row">
        <span className="card-meta">
          {comment.author && <span>{comment.author}</span>}
          <span>{fmtTime(comment.updatedAt ?? comment.createdAt)}{comment.updatedAt ? ' (edited)' : ''}</span>
        </span>
      </div>
    </li>
  );
}

function Composer({ number, existing }: { number: number | null; existing?: Comment }) {
  const saveDraft = useStore((s) => s.saveDraft);
  const cancelDraft = useStore((s) => s.cancelDraft);
  const startEdit = useStore((s) => s.startEdit);
  const updateComment = useStore((s) => s.updateComment);
  const announce = useStore((s) => s.announce);
  const author = useSettings((s) => s.author);
  const [text, setText] = useState(existing?.text ?? '');
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const isRegion = existing ? !!existing.rect : number !== null;
  // Focus goes back to whatever opened the composer (edit button, panel button) when it
  // is still on the page; otherwise to the slide, which is where a drawn region came from.
  const returnTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const active = document.activeElement as HTMLElement | null;
    returnTo.current = active && active !== document.body ? active : null;
    const t = window.setTimeout(() => ref.current?.focus(), 30);
    return () => window.clearTimeout(t);
  }, []);

  const restoreFocus = () => {
    window.setTimeout(() => {
      const el = returnTo.current;
      if (el && el.isConnected && !el.closest('.composer')) el.focus();
      else document.querySelector<HTMLElement>('[data-testid="frame"]')?.focus();
    }, 0);
  };
  const close = () => {
    if (existing) startEdit(null);
    else cancelDraft();
    restoreFocus();
  };
  const save = async () => {
    const t = text.trim();
    if (!t || saving) return;
    setSaving(true);
    try {
      if (existing) {
        await updateComment(existing.id, { text: t });
        announce('Comment updated.');
      } else {
        await saveDraft(t, author);
        announce(isRegion ? `Comment saved as region ${number}.` : 'General note saved.');
      }
    } finally {
      setSaving(false);
    }
    restoreFocus();
  };

  return (
    <li className="card composer" style={{ listStyle: 'none' }}>
      <div className="card-top">
        <span className={`badge-num mono${isRegion ? '' : ' general'}`} aria-hidden="true">
          {isRegion ? number : '•'}
        </span>
        <span className="card-label" id="composer-label">
          {existing ? 'Edit ' : 'New '}
          {isRegion ? `comment on region ${number}` : 'general note'}
        </span>
      </div>
      <textarea
        ref={ref}
        value={text}
        aria-labelledby="composer-label"
        placeholder="What should change here, and why…"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            close();
          } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            void save();
          }
        }}
      />
      <div className="card-row">
        <span className="hint">
          <kbd>Ctrl</kbd>+<kbd>Enter</kbd> saves
        </span>
        <button type="button" className="btn ghost small" onClick={close}>
          Cancel
        </button>
        <button type="button" className="btn primary small" onClick={() => void save()} disabled={!text.trim() || saving}>
          {existing ? 'Update' : 'Save'}
        </button>
      </div>
    </li>
  );
}
