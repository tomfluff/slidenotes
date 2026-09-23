import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { useStore, selectSlideComments } from '@/app/store';
import { useSettings } from '@/app/settings';
import { useShallow } from 'zustand/react/shallow';
import { numberComments } from '@/lib/sort';
import { clamp, clamp01, describeRect, isUsableRect, pointToPct, rectFromPoints, clampRect } from '@/lib/geometry';
import type { Rect } from '@/lib/types';
import { IconClose, IconRegion, IconZoomIn, IconZoomOut } from '@/app/icons';
import { Markers, type HandleId } from './Markers';

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 4;
const ZOOM_STEP = 1.25;
const MIN_EDIT_PCT = 2;

/** Applies an arrow-key nudge (move, or resize with Alt) to a rectangle. */
function nudge(r: Rect, key: string, shift: boolean, resize: boolean): Rect | null {
  const step = shift ? 5 : 1;
  const out = { ...r };
  switch (key) {
    case 'ArrowLeft':
      if (resize) out.w = Math.max(MIN_EDIT_PCT, out.w - step);
      else out.x -= step;
      break;
    case 'ArrowRight':
      if (resize) out.w = Math.min(100 - out.x, out.w + step);
      else out.x += step;
      break;
    case 'ArrowUp':
      if (resize) out.h = Math.max(MIN_EDIT_PCT, out.h - step);
      else out.y -= step;
      break;
    case 'ArrowDown':
      if (resize) out.h = Math.min(100 - out.y, out.h + step);
      else out.y += step;
      break;
    default:
      return null;
  }
  return clampRect(out);
}

/** Resizes a rectangle by moving one handle to a point, keeping the opposite edge fixed. */
function resizeTo(orig: Rect, handle: HandleId, p: { x: number; y: number }): Rect {
  let x1 = orig.x;
  let y1 = orig.y;
  let x2 = orig.x + orig.w;
  let y2 = orig.y + orig.h;
  if (handle.includes('w')) x1 = Math.min(p.x, x2 - MIN_EDIT_PCT);
  if (handle.includes('e')) x2 = Math.max(p.x, x1 + MIN_EDIT_PCT);
  if (handle.includes('n')) y1 = Math.min(p.y, y2 - MIN_EDIT_PCT);
  if (handle.includes('s')) y2 = Math.max(p.y, y1 + MIN_EDIT_PCT);
  return clampRect({ x: x1, y: y1, w: x2 - x1, h: y2 - y1 });
}

export function Stage() {
  const { deck, current, draft, hotId, hotSource, selectedId } = useStore(
    useShallow((s) => ({ deck: s.deck, current: s.current, draft: s.draft, hotId: s.hotId, hotSource: s.hotSource, selectedId: s.selectedId })),
  );
  const slideComments = useStore(useShallow(selectSlideComments));
  const urls = useStore((s) => s.urls);
  const startDraft = useStore((s) => s.startDraft);
  const setSelected = useStore((s) => s.setSelected);
  const updateComment = useStore((s) => s.updateComment);
  const setHot = useStore((s) => s.setHot);
  const announce = useStore((s) => s.announce);
  const startEdit = useStore((s) => s.startEdit);
  const hintDismissed = useSettings((s) => s.hintDismissed);
  const setSettings = useSettings((s) => s.set);

  const slide = deck?.slides[current];
  const total = deck?.slides.length ?? 0;
  const slideLabel = `slide ${current + 1} of ${total}`;

  const stageRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const matRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoomState] = useState(1);
  const zoomRef = useRef(1);
  const [live, setLiveState] = useState<Rect | null>(null);
  const liveRef = useRef<Rect | null>(null);
  const setLive = useCallback((r: Rect | null) => {
    liveRef.current = r;
    setLiveState(r);
  }, []);
  /** A region being moved or resized: the preview rect replaces the stored one while dragging. */
  const [editPreview, setEditPreviewState] = useState<{ id: string; rect: Rect } | null>(null);
  // Mirrored in a ref: pointermove updates are continuous-priority and may not have
  // rendered by the time the discrete pointerup arrives, so the handler reads the ref.
  const editPreviewRef = useRef<{ id: string; rect: Rect } | null>(null);
  const setEditPreview = useCallback((v: { id: string; rect: Rect } | null) => {
    editPreviewRef.current = v;
    setEditPreviewState(v);
  }, []);
  const editRef = useRef<{ id: string; handle: HandleId | 'body'; orig: Rect; start: { x: number; y: number }; pointerId: number } | null>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  /** True while a region body is being dragged: the cursor stays "move" for the whole gesture. */
  const [moving, setMoving] = useState(false);
  const [spaceDown, setSpaceDown] = useState(false);
  const [panning, setPanning] = useState(false);
  /**
   * Free pan offset, used on an axis where the slide fits and there is nothing to scroll.
   * A translated slide would itself create scrollable overflow, so that axis is clipped
   * (overflow hidden) while the offset is in use.
   */
  const offset = useRef({ x: 0, y: 0 });
  const applyOffset = () => {
    const inner = innerRef.current;
    if (inner) inner.style.transform = offset.current.x || offset.current.y ? `translate(${offset.current.x}px, ${offset.current.y}px)` : '';
  };
  const clearOffset = () => {
    offset.current = { x: 0, y: 0 };
    applyOffset();
    const stage = stageRef.current;
    if (stage) {
      stage.style.overflowX = '';
      stage.style.overflowY = '';
    }
  };
  const drag = useRef<{ x0: number; y0: number; id: number } | null>(null);
  const pan = useRef<{ x: number; y: number; sl: number; st: number; ox: number; oy: number; freeX: boolean; freeY: boolean; id: number } | null>(null);
  const announceTimer = useRef<number | null>(null);

  const items = useMemo(() => {
    const list = numberComments(slideComments);
    if (!editPreview) return list;
    return list.map((it) => (it.comment.id === editPreview.id ? { ...it, comment: { ...it.comment, rect: editPreview.rect } } : it));
  }, [slideComments, editPreview]);

  // Zoom changes real layout width, never a CSS transform, so the scroll container
  // gets a genuine scrollable area and native panning works. Fit considers both axes,
  // so a tall slide fits the height and a wide display is actually used.
  const fitWidth = useCallback((): number => {
    const stage = stageRef.current;
    const mat = matRef.current;
    if (!stage) return 320;
    const cs = getComputedStyle(stage);
    const availW = stage.clientWidth - parseFloat(cs.paddingLeft || '0') - parseFloat(cs.paddingRight || '0');
    const availH = stage.clientHeight - parseFloat(cs.paddingTop || '0') - parseFloat(cs.paddingBottom || '0');
    const ratio = slide ? slide.height / slide.width : 9 / 16;
    // The mat adds a fixed amount of chrome around the slide; subtract it before fitting.
    const chrome = mat ? mat.offsetWidth - (frameRef.current?.clientWidth ?? mat.offsetWidth) : 0;
    const byHeight = availH > 0 ? (availH - chrome) / ratio + chrome : Number.POSITIVE_INFINITY;
    const w = Math.min(availW > 0 ? availW : 320, byHeight);
    return Math.max(160, w);
  }, [slide]);

  const applyZoom = useCallback(
    (z: number) => {
      const inner = innerRef.current;
      if (!inner) return;
      inner.style.width = `${Math.round(fitWidth() * z)}px`;
      inner.style.maxWidth = 'none';
    },
    [fitWidth],
  );

  /** Anchors by measuring the slide's box before and after, never by predicting. */
  const setZoom = useCallback(
    (next: number, clientX?: number, clientY?: number) => {
      const stage = stageRef.current;
      const mat = matRef.current;
      if (!stage || !mat) return;
      next = clamp(next, ZOOM_MIN, ZOOM_MAX);
      if (Math.abs(next - zoomRef.current) < 0.001) return;
      clearOffset();
      const sr = stage.getBoundingClientRect();
      const before = mat.getBoundingClientRect();
      const ax = clientX ?? sr.left + sr.width / 2;
      const ay = clientY ?? sr.top + sr.height / 2;
      const fx = before.width ? clamp01((ax - before.left) / before.width) : 0.5;
      const fy = before.height ? clamp01((ay - before.top) / before.height) : 0.5;
      zoomRef.current = next;
      applyZoom(next);
      const after = mat.getBoundingClientRect();
      stage.scrollLeft += after.left + fx * after.width - ax;
      stage.scrollTop += after.top + fy * after.height - ay;
      setZoomState(next);
    },
    [applyZoom],
  );

  const resetZoom = useCallback(() => {
    zoomRef.current = 1;
    applyZoom(1);
    setZoomState(1);
    clearOffset();
    const stage = stageRef.current;
    if (stage) {
      stage.scrollLeft = 0;
      stage.scrollTop = 0;
    }
  }, [applyZoom]);

  useLayoutEffect(() => {
    applyZoom(zoomRef.current);
    const stage = stageRef.current;
    if (!stage) return;
    const ro = new ResizeObserver(() => applyZoom(zoomRef.current));
    ro.observe(stage);
    return () => ro.disconnect();
  }, [applyZoom]);

  // New slide: back to fit, and every in-flight gesture or pending announcement is dropped.
  useEffect(() => {
    resetZoom();
    setLive(null);
    setEditPreview(null);
    editRef.current = null;
    drag.current = null;
    pan.current = null;
    setPanning(false);
    if (announceTimer.current) {
      window.clearTimeout(announceTimer.current);
      announceTimer.current = null;
    }
  }, [slide?.id, resetZoom, setLive, setEditPreview]);

  // Ctrl or Cmd + wheel zooms; plain wheel is native pan. Non-passive so preventDefault works.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      // deltaY is device dependent: ~100 per mouse notch, single digits for a pinch,
      // lines or pages for other devices. Normalise, clamp, then apply exponentially.
      let d = e.deltaY;
      if (e.deltaMode === 1) d *= 16;
      else if (e.deltaMode === 2) d *= 100;
      d = clamp(d, -40, 40);
      setZoom(zoomRef.current * Math.exp(-d * 0.0035), e.clientX, e.clientY);
    };
    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, [setZoom]);

  // Space held = pan mode. Space still activates focused controls and types in fields.
  useEffect(() => {
    const isTyping = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT' || el.isContentEditable) return true;
      // Region bodies and handles are buttons only for focus; Space pans there too.
      if (el.closest('.region-body, .handle')) return false;
      return !!el.closest('button, a, [role=button], dialog');
    };
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || isTyping(e.target)) return;
      e.preventDefault();
      setSpaceDown(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceDown(false);
    };
    const blur = () => setSpaceDown(false);
    document.addEventListener('keydown', down);
    document.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      document.removeEventListener('keydown', down);
      document.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  // ---- drawing on the slide ----
  const spaceRef = useRef(false);
  spaceRef.current = spaceDown;

  /** The smallest existing region under a point, so nested regions stay reachable. */
  const regionAt = (p: { x: number; y: number }): string | null => {
    let best: { id: string; area: number } | null = null;
    for (const c of slideComments) {
      const r = c.rect;
      if (!r || p.x < r.x || p.y < r.y || p.x > r.x + r.w || p.y > r.y + r.h) continue;
      const area = r.w * r.h;
      if (!best || area < best.area) best = { id: c.id, area };
    }
    return best?.id ?? null;
  };

  const onFramePointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    // Only the primary button draws: middle click and space-drag are panning.
    if (e.button !== 0 || spaceRef.current) return;
    const frame = frameRef.current;
    if (!frame) return;
    e.stopPropagation();
    const p = pointToPct(e.clientX, e.clientY, frame.getBoundingClientRect());
    // Pressing inside an existing region grabs it: it becomes selected and moves with the
    // pointer. Pressing on empty slide deselects and starts a new rectangle.
    const hit = regionAt(p);
    if (hit) {
      const comment = slideComments.find((c) => c.id === hit);
      if (comment?.rect) {
        setSelected(hit);
        setHot(hit);
        frame.setPointerCapture(e.pointerId);
        editRef.current = { id: hit, handle: 'body', orig: comment.rect, start: p, pointerId: e.pointerId };
        setMoving(true);
        return;
      }
    }
    if (selectedId) setSelected(null);
    frame.setPointerCapture(e.pointerId);
    drag.current = { x0: p.x, y0: p.y, id: e.pointerId };
    setLive(null);
  };
  const onFramePointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    const frame = frameRef.current;
    if (!frame) return;
    const ed = editRef.current;
    if (ed && ed.pointerId === e.pointerId) {
      const p = pointToPct(e.clientX, e.clientY, frame.getBoundingClientRect());
      if (ed.handle === 'body') {
        const dx = p.x - ed.start.x;
        const dy = p.y - ed.start.y;
        setEditPreview({ id: ed.id, rect: clampRect({ ...ed.orig, x: ed.orig.x + dx, y: ed.orig.y + dy }) });
      } else {
        setEditPreview({ id: ed.id, rect: resizeTo(ed.orig, ed.handle, p) });
      }
      return;
    }
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const p = pointToPct(e.clientX, e.clientY, frame.getBoundingClientRect());
    setLive(rectFromPoints({ x: d.x0, y: d.y0 }, p));
  };
  const endDraw = (e: RPointerEvent<HTMLDivElement>) => {
    const ed = editRef.current;
    if (ed && ed.pointerId === e.pointerId) {
      editRef.current = null;
      setMoving(false);
      const preview = editPreviewRef.current;
      setEditPreview(null);
      if (preview && preview.id === ed.id) {
        void updateComment(ed.id, { rect: preview.rect });
        announce(`Region now ${describeRect(preview.rect)}.`);
      }
      return;
    }
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    const r = liveRef.current;
    setLive(null);
    if (isUsableRect(r)) {
      startDraft(r);
      announce(`Region marked, ${describeRect(r)} of ${slideLabel}. Write your comment.`);
    }
  };
  /** A cancelled touch or pen gesture never becomes a region or an edit. */
  const cancelDraw = (e: RPointerEvent<HTMLDivElement>) => {
    if (editRef.current?.pointerId === e.pointerId) {
      editRef.current = null;
      setMoving(false);
      setEditPreview(null);
      return;
    }
    if (drag.current?.id !== e.pointerId) return;
    drag.current = null;
    setLive(null);
  };

  /**
   * Pointer down on a selected region's body or handle starts a move or resize. Middle
   * button and space-drag are left alone so they still pan through the region controls.
   */
  const onGrab = (id: string, handle: HandleId | 'body', e: React.PointerEvent): boolean => {
    if (e.button !== 0 || spaceRef.current) return false;
    const frame = frameRef.current;
    const comment = slideComments.find((c) => c.id === id);
    if (!frame || !comment?.rect) return false;
    frame.setPointerCapture(e.pointerId);
    editRef.current = { id, handle, orig: comment.rect, start: pointToPct(e.clientX, e.clientY, frame.getBoundingClientRect()), pointerId: e.pointerId };
    if (handle === 'body') setMoving(true);
    return true;
  };

  // ---- panning on the stage (middle button, space-drag, or empty area) ----
  const onStagePointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    const stage = stageRef.current;
    if (!stage) return;
    const onSlide = !!frameRef.current?.contains(e.target as Node);
    const wantsPan = spaceRef.current || e.button === 1 || !onSlide;
    if (!wantsPan || (e.button !== 0 && e.button !== 1)) return;
    // Toolbar buttons keep their clicks; region badges, bodies and handles still pan.
    const btn = (e.target as HTMLElement).closest('button');
    if (btn && !btn.closest('.pin-layer')) return;
    // Decide per axis, once, whether this pan scrolls or translates.
    const freeX = offset.current.x !== 0 || stage.scrollWidth <= stage.clientWidth + 1;
    const freeY = offset.current.y !== 0 || stage.scrollHeight <= stage.clientHeight + 1;
    if (freeX) stage.style.overflowX = 'hidden';
    if (freeY) stage.style.overflowY = 'hidden';
    pan.current = { x: e.clientX, y: e.clientY, sl: stage.scrollLeft, st: stage.scrollTop, ox: offset.current.x, oy: offset.current.y, freeX, freeY, id: e.pointerId };
    stage.setPointerCapture(e.pointerId);
    setPanning(true);
    e.preventDefault();
  };
  // Panning scrolls where the slide overflows and translates it where it fits, so the
  // slide can always be dragged, at 100% and below as well as when zoomed in.
  const onStagePointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    const p = pan.current;
    const stage = stageRef.current;
    if (!p || p.id !== e.pointerId || !stage) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (p.freeX) offset.current.x = clamp(p.ox + dx, -stage.clientWidth * 0.8, stage.clientWidth * 0.8);
    else stage.scrollLeft = p.sl - dx;
    if (p.freeY) offset.current.y = clamp(p.oy + dy, -stage.clientHeight * 0.8, stage.clientHeight * 0.8);
    else stage.scrollTop = p.st - dy;
    applyOffset();
  };
  const endPan = (e: RPointerEvent<HTMLDivElement>) => {
    if (!pan.current || pan.current.id !== e.pointerId) return;
    pan.current = null;
    setPanning(false);
  };

  // ---- keyboard: nudging the selected region ----
  const selected = selectedId ? slideComments.find((c) => c.id === selectedId) : undefined;
  const onKeyEdit = (e: KeyboardEvent) => {
    if (selected?.rect) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setSelected(null);
        announce('Region deselected.');
        return;
      }
      const r = nudge(selected.rect, e.key, e.shiftKey, e.altKey);
      if (!r) return;
      e.preventDefault();
      e.stopPropagation();
      void updateComment(selected.id, { rect: r });
      if (announceTimer.current) window.clearTimeout(announceTimer.current);
      announceTimer.current = window.setTimeout(() => announce(`Region now ${describeRect(r)}.`), 350);
    }
  };
  const keyHandlerRef = useRef(onKeyEdit);
  keyHandlerRef.current = onKeyEdit;
  // While a region is selected, its keys work from anywhere outside a
  // text field or dialog, so tabbing away never strands the mode.
  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT' || el?.closest('dialog, .popover')) return;
      keyHandlerRef.current(e);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selectedId]);

  const activateComment = (id: string) => {
    startEdit(null);
    if (selectedId === id) {
      // Second activation opens the comment itself.
      setSelected(null);
      const card = document.getElementById(`comment-${id}`);
      card?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      card?.focus();
      return;
    }
    setSelected(id);
    setHot(id);
    const c = slideComments.find((x) => x.id === id);
    if (c?.rect) announce(`Region selected, ${describeRect(c.rect)}. Drag it or its handles, or use the arrow keys. Activate again to open the comment.`);
    document.getElementById(`comment-${id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  if (!deck || !slide) return null;
  const src = urls.get(slide.id);
  const regionCount = items.filter((i) => i.number !== null).length;
  const frameLabel = `${slideLabel}, ${regionCount} marked region${regionCount === 1 ? '' : 's'}. Drag to mark a region; a region's number badge selects it for moving with the arrow keys.`;
  const selectedNumber = selected ? items.find((i) => i.comment.id === selected.id)?.number : null;

  return (
    <main className="stage-area" aria-label="Slide">
      {!hintDismissed && (
        <p className="stage-hint" aria-hidden="true">
          <IconRegion /> Drag a rectangle over anything you want to comment on.
          <span className="extra">
            {' '}
            <kbd>N</kbd> adds a general note. <kbd>Ctrl</kbd> + scroll zooms, hold <kbd>Space</kbd> to pan.
          </span>
          <button type="button" className="icon-btn dismiss" onClick={() => setSettings({ hintDismissed: true })} aria-label="Dismiss hint" title="Dismiss (Help has all shortcuts)">
            <IconClose />
          </button>
        </p>
      )}
      {selected?.rect && (
        <div className="mode-bar" role="status">
          <IconRegion />
          <span className="grow">
            <b>Region {selectedNumber}</b> selected. Drag to move, handles or <kbd>Alt</kbd> + arrows to resize.
          </span>
          <button type="button" className="btn small" onClick={() => activateComment(selected.id)}>
            Open comment
          </button>
          <button
            type="button"
            className="btn small"
            onClick={() => {
              setSelected(null);
              announce('Region deselected.');
            }}
          >
            Done
          </button>
        </div>
      )}
      <div
        ref={stageRef}
        className={`stage${zoom > 1.001 || spaceDown ? ' pannable' : ''}${panning ? ' panning' : ''}${spaceDown ? ' space-pan' : ''}`}
        data-testid="stage"
        onPointerDown={onStagePointerDown}
        onPointerMove={onStagePointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        onMouseDown={(e) => {
          if (e.button === 1) e.preventDefault();
        }}
        onAuxClick={(e) => {
          if (e.button === 1) e.preventDefault();
        }}
      >
        <div ref={innerRef} className="stage-inner">
          <div ref={matRef} className="frame-mat" data-testid="mat">
            <div
              ref={frameRef}
              className={`frame${moving ? ' moving' : ''}${src && loadedSrc === src ? '' : ' loading'}`}
              data-testid="frame"
              tabIndex={0}
              role="group"
              aria-label={frameLabel}
              aria-describedby={slide.alt ? 'slide-description' : undefined}
              style={{ aspectRatio: `${slide.width} / ${slide.height}` }}
              onPointerDown={onFramePointerDown}
              onPointerMove={onFramePointerMove}
              onPointerUp={endDraw}
              onPointerCancel={cancelDraw}
              onLostPointerCapture={cancelDraw}
              onDoubleClick={(e) => {
                e.preventDefault();
                if (zoomRef.current > 1.01) resetZoom();
                else setZoom(2, e.clientX, e.clientY);
              }}
            >
              {src ? (
                <img
                  key={slide.id}
                  src={src}
                  alt={`Slide ${current + 1} of ${total}${slide.sourceName ? `, ${slide.sourceName}` : ''}`}
                  onLoad={(e) => setLoadedSrc(e.currentTarget.getAttribute('src'))}
                  draggable={false}
                />
              ) : (
                <div className="missing" style={{ aspectRatio: `${slide.width} / ${slide.height}` }}>Slide image unavailable</div>
              )}
              <Markers
                items={items}
                draft={live ?? draft?.rect ?? null}
                hotId={hotId}
                pulseId={hotSource === 'card' && hotId !== selectedId ? hotId : null}
                selectedId={selectedId}
                onHot={setHot}
                onActivate={activateComment}
                onGrab={onGrab}
                panning={spaceDown}
                interactive
                slideLabel={slideLabel}
              />
            </div>
          </div>
        </div>
      </div>
      {slide.alt && (
        <div id="slide-description" className="visually-hidden">
          Slide text: {slide.alt}
        </div>
      )}
      <div className="zoom-toolbar no-print" role="group" aria-label="Zoom">
        <button type="button" onClick={() => setZoom(zoomRef.current / ZOOM_STEP)} aria-label="Zoom out" disabled={zoom <= ZOOM_MIN + 0.001}>
          <IconZoomOut />
        </button>
        <output className="mono" aria-live="off" data-testid="zoom-pct">
          {Math.round(zoom * 100)}%
        </output>
        <button type="button" onClick={() => setZoom(zoomRef.current * ZOOM_STEP)} aria-label="Zoom in" disabled={zoom >= ZOOM_MAX - 0.001}>
          <IconZoomIn />
        </button>
        <button type="button" onClick={resetZoom} aria-label="Fit slide to view">
          Fit
        </button>
      </div>
    </main>
  );
}
