import type { NumberedComment } from '@/lib/sort';
import type { Rect } from '@/lib/types';
import { describeRect } from '@/lib/geometry';

export type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
export const HANDLES: HandleId[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

interface Props {
  items: readonly NumberedComment[];
  draft?: Rect | null;
  hotId?: string | null;
  /** The region to pulse: hovered from its comment card and not selected. */
  pulseId?: string | null;
  selectedId?: string | null;
  onHot?: (id: string | null) => void;
  onActivate?: (id: string) => void;
  /** Pointer down on a selected region's body (move) or on a handle (resize). Returns true when it took the pointer. */
  onGrab?: (id: string, handle: HandleId | 'body', e: React.PointerEvent) => boolean;
  /** When false, pins are decorative and the comment list carries the names (sheet, export). */
  interactive?: boolean;
  /** True while Space is held: presses on region controls pan instead of acting. */
  panning?: boolean;
  /** Text describing which slide, for the accessible names. */
  slideLabel: string;
}

/** Corner brackets for the "corners" marker style, as a path in the stretched viewBox. */
function cornersPath(r: Rect): string {
  const lx = Math.min(r.w * 0.28, 6);
  const ly = Math.min(r.h * 0.28, 6);
  const x2 = r.x + r.w;
  const y2 = r.y + r.h;
  return [
    `M${r.x} ${r.y + ly} V${r.y} H${r.x + lx}`,
    `M${x2 - lx} ${r.y} H${x2} V${r.y + ly}`,
    `M${x2} ${y2 - ly} V${y2} H${x2 - lx}`,
    `M${r.x + lx} ${y2} H${r.x} V${y2 - ly}`,
  ].join(' ');
}

/** One region in every style; CSS on <html data-marker-style> decides which parts show. */
export function RegionShape({ rect, className = '', hot = false }: { rect: Rect; className?: string; hot?: boolean }) {
  const attrs = { x: rect.x, y: rect.y, width: rect.w, height: rect.h, vectorEffect: 'non-scaling-stroke' as const };
  const d = cornersPath(rect);
  return (
    <g className={hot ? 'hot' : undefined}>
      <rect className="halo" {...attrs} />
      <rect className={`markrect ${className}`} {...attrs} />
      <path className="markcorners-halo" d={d} vectorEffect="non-scaling-stroke" />
      <path className="markcorners" d={d} vectorEffect="non-scaling-stroke" />
    </g>
  );
}

/**
 * The overlay SVG is stretched (viewBox 0 0 100 100, preserveAspectRatio none) so that
 * percentage rectangles map straight onto the slide. Number badges and resize handles
 * must not live in that space or they render distorted, so they are HTML, sized in
 * pixels or rem and clamped inside the frame.
 */
export function Markers({ items, draft, hotId, pulseId, selectedId, onHot, onActivate, onGrab, interactive = false, panning = false, slideLabel }: Props) {
  return (
    <>
      <svg className="overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        {items.map(({ comment }) =>
          comment.rect ? (
            <RegionShape
              key={comment.id}
              rect={comment.rect}
              hot={pulseId === comment.id}
              className={`${hotId === comment.id ? 'hot' : ''} ${comment.resolved ? 'resolved' : ''} ${selectedId === comment.id ? 'selected' : ''}`}
            />
          ) : null,
        )}
        {draft && <rect className="markrect draft" x={draft.x} y={draft.y} width={draft.w} height={draft.h} vectorEffect="non-scaling-stroke" />}
      </svg>
      <div className="pin-layer">
        {items.map(({ comment, number }) => {
          if (!comment.rect || number === null) return null;
          const r = comment.rect;
          const style = {
            left: `min(${r.x}%, calc(100% - var(--badge) - 6px))`,
            top: `min(${r.y}%, calc(100% - var(--badge) - 6px))`,
          };
          const selected = selectedId === comment.id;
          const cls = `pin mono${hotId === comment.id ? ' hot' : ''}${comment.resolved ? ' resolved' : ''}${selected ? ' selected' : ''}`;
          if (!interactive) {
            return (
              <span key={comment.id} className={cls} style={style} aria-hidden="true">
                {number}
              </span>
            );
          }
          const excerpt = comment.text.length > 80 ? `${comment.text.slice(0, 77)}…` : comment.text;
          return (
            <div key={comment.id} style={{ display: 'contents' }}>
              {selected && (
                <>
                  <button
                    type="button"
                    className="region-body"
                    style={{ left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%` }}
                    aria-label={`Move region ${number}. Arrow keys move, Alt plus arrows resize, Shift for larger steps, Escape deselects.`}
                    onPointerDown={(e) => {
                      if (onGrab?.(comment.id, 'body', e)) e.stopPropagation();
                    }}
                    onDoubleClick={(e) => e.stopPropagation()}
                  />
                  {HANDLES.map((h) => {
                    const hx = h.includes('w') ? r.x : h.includes('e') ? r.x + r.w : r.x + r.w / 2;
                    const hy = h.includes('n') ? r.y : h.includes('s') ? r.y + r.h : r.y + r.h / 2;
                    return (
                      <button
                        key={h}
                        type="button"
                        className={`handle ${h}`}
                        style={{ left: `${hx}%`, top: `${hy}%` }}
                        aria-label={`Resize region ${number}, ${h.toUpperCase()} handle`}
                        onPointerDown={(e) => {
                          if (onGrab?.(comment.id, h, e)) e.stopPropagation();
                        }}
                        onDoubleClick={(e) => e.stopPropagation()}
                      />
                    );
                  })}
                </>
              )}
              <button
                type="button"
                className={cls}
                style={{ ...style, pointerEvents: 'auto', border: 'none' }}
                aria-label={`Region ${number} on ${slideLabel}, ${describeRect(r)}${comment.resolved ? ', resolved' : ''}: ${excerpt}`}
                aria-pressed={selected}
                onMouseEnter={() => onHot?.(comment.id)}
                onMouseLeave={() => onHot?.(null)}
                onFocus={() => onHot?.(comment.id)}
                onBlur={() => onHot?.(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  onActivate?.(comment.id);
                }}
                onPointerDown={(e) => {
                  // Primary-button presses stay on the badge; middle button and space-drag pan.
                  if (e.button === 0 && !panning) e.stopPropagation();
                }}
                onDoubleClick={(e) => e.stopPropagation()}
              >
                {number}
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
