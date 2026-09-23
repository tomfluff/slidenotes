import { useEffect, useRef } from 'react';
import { IconClose } from './icons';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function HelpDialog({ open, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog ref={ref} className="help" aria-labelledby="help-title" onClose={onClose} onCancel={(e) => { e.preventDefault(); onClose(); }}>
      <div className="dialog-head">
        <h2 id="help-title">Help</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close help">
          <IconClose />
        </button>
      </div>
      <div className="dialog-body help-body">
        <p>
          Drag a rectangle over anything on a slide to comment on that spot. Click a region to select it, then drag its
          body or handles to adjust it. Everything stays in your browser; save a project file to keep a review.
        </p>
        <h3>Slides</h3>
        <table>
          <tbody>
            <tr><td><kbd>←</kbd> <kbd>→</kbd>, <kbd>PgUp</kbd> <kbd>PgDn</kbd></td><td>Previous or next slide</td></tr>
            <tr><td><kbd>Home</kbd> <kbd>End</kbd></td><td>First or last slide</td></tr>
            <tr><td><kbd>Ctrl</kbd> + scroll, <kbd>+</kbd> <kbd>-</kbd> <kbd>0</kbd></td><td>Zoom in, out, fit. Double-click the slide toggles 2×.</td></tr>
            <tr><td><kbd>Space</kbd> + drag, middle-click drag</td><td>Pan a zoomed slide</td></tr>
          </tbody>
        </table>
        <h3>Comments</h3>
        <table>
          <tbody>
            <tr><td><kbd>N</kbd></td><td>New general note on this slide</td></tr>
            <tr><td><kbd>Ctrl</kbd> + <kbd>Enter</kbd></td><td>Save the comment being written</td></tr>
            <tr><td><kbd>Esc</kbd></td><td>Cancel, or deselect a region</td></tr>
            <tr><td>Drag inside a region</td><td>Move it; drag a handle to resize</td></tr>
            <tr><td>Region selected: arrows, <kbd>Shift</kbd> + arrows</td><td>Move it by 1% or 5%</td></tr>
            <tr><td>Region selected: <kbd>Alt</kbd> + arrows</td><td>Resize it</td></tr>
          </tbody>
        </table>
        <h3>About</h3>
        <p>
          SlideNotes is free software (AGPL-3.0) by Yotam Sechayk. Source and issues:{' '}
          <a href="https://github.com/tomfluff/slidenotes" target="_blank" rel="noreferrer">github.com/tomfluff/slidenotes</a>.
        </p>
      </div>
    </dialog>
  );
}
