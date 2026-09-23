import { useRef, useState } from 'react';

interface Props {
  className: string;
  label: string;
  /** Current width in px of the pane this divider controls. */
  value: number;
  min: number;
  max: number;
  /** Which side of the divider the controlled pane is on. */
  side: 'left' | 'right';
  onChange: (px: number) => void;
  onReset: () => void;
}

/**
 * Panel divider: pointer drag plus a keyboard route (arrows 16px, Shift 64px, Home/End
 * to the limits, Enter resets). The pane width is previewed on a CSS variable during
 * the drag and committed once on release.
 */
export function Resizer({ className, label, value, min, max, side, onChange, onReset }: Props) {
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; w: number } | null>(null);
  const clamp = (w: number) => Math.round(Math.min(max, Math.max(min, w)));

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, w: value };
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    onChange(clamp(side === 'left' ? start.current.w + dx : start.current.w - dx));
  };
  const onPointerUp = () => {
    start.current = null;
    setDragging(false);
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const step = e.shiftKey ? 64 : 16;
    const grow = side === 'left' ? 'ArrowRight' : 'ArrowLeft';
    const shrink = side === 'left' ? 'ArrowLeft' : 'ArrowRight';
    if (e.key === grow) onChange(clamp(value + step));
    else if (e.key === shrink) onChange(clamp(value - step));
    else if (e.key === 'Home') onChange(min);
    else if (e.key === 'End') onChange(max);
    else if (e.key === 'Enter') onReset();
    else return;
    e.preventDefault();
  };

  return (
    <button
      type="button"
      className={`resizer ${className}${dragging ? ' dragging' : ''}`}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemin={min}
      aria-valuemax={max}
      title={`${label}. Drag, or use arrow keys; Enter resets.`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
      onDoubleClick={onReset}
    />
  );
}
