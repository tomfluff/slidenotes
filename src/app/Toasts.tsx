import { useEffect, useRef } from 'react';
import { useStore, type Toast } from '@/app/store';

const LIFETIME: Record<Toast['kind'], number> = { info: 5000, ok: 5000, err: 12000 };

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const announcement = useStore((s) => s.announcement);
  const errors = toasts.filter((t) => t.kind === 'err');
  const others = toasts.filter((t) => t.kind !== 'err');
  return (
    <>
      <div className="visually-hidden" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
      <div className="toasts">
        {/* Errors are assertive; everything else is polite. Both lists are separate live regions. */}
        <div role="alert" aria-live="assertive" className="toast-group">
          {errors.map((t) => (
            <ToastItem key={t.id} toast={t} />
          ))}
        </div>
        <div role="status" aria-live="polite" className="toast-group">
          {others.map((t) => (
            <ToastItem key={t.id} toast={t} />
          ))}
        </div>
      </div>
    </>
  );
}

/** Expires on a timer that pauses while hovered or focused, so a focused dismiss button never vanishes. */
function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useStore((s) => s.dismissToast);
  const ref = useRef<HTMLDivElement>(null);
  const remaining = useRef(LIFETIME[toast.kind]);
  const started = useRef(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const start = () => {
      started.current = Date.now();
      timer.current = window.setTimeout(() => dismiss(toast.id), remaining.current);
    };
    const pause = () => {
      if (timer.current === null) return;
      window.clearTimeout(timer.current);
      timer.current = null;
      remaining.current = Math.max(1500, remaining.current - (Date.now() - started.current));
    };
    const resume = () => {
      if (timer.current === null && !el.matches(':hover') && !el.contains(document.activeElement)) start();
    };
    start();
    el.addEventListener('mouseenter', pause);
    el.addEventListener('focusin', pause);
    el.addEventListener('mouseleave', resume);
    el.addEventListener('focusout', resume);
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      el.removeEventListener('mouseenter', pause);
      el.removeEventListener('focusin', pause);
      el.removeEventListener('mouseleave', resume);
      el.removeEventListener('focusout', resume);
    };
  }, [toast.id, dismiss]);

  return (
    <div ref={ref} className={`toast ${toast.kind}`}>
      <span>{toast.text}</span>
      <button type="button" onClick={() => dismiss(toast.id)} aria-label="Dismiss message">
        ×
      </button>
    </div>
  );
}
