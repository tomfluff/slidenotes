import { useEffect, useRef } from 'react';
import { IconClose, IconUpload } from '@/app/icons';
import type { PptxPrompt } from '@/app/store';
import { ENGINE_MB } from './pptx';

interface Props {
  prompt: PptxPrompt | null;
  onClose: () => void;
  onConvert: () => void;
  onChoosePdf: () => void;
}

/**
 * Shown when a PowerPoint file is dropped: convert it here with LibreOffice in
 * WebAssembly (one-time engine download), or export a PDF from the authoring app.
 */
export function PptxDialog({ prompt, onClose, onConvert, onChoosePdf }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const open = prompt !== null;
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog ref={ref} className="help" aria-labelledby="pptx-title" onClose={onClose} onCancel={(e) => { e.preventDefault(); onClose(); }}>
      <div className="dialog-head">
        <h2 id="pptx-title">PowerPoint file</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
          <IconClose />
        </button>
      </div>
      <div className="dialog-body help-body">
        {prompt?.error && (
          <p className="pptx-error" role="alert">
            {prompt.error}
          </p>
        )}
        <p>
          <b>{prompt?.file.name}</b> can be converted to slides right here, or you can export a PDF from PowerPoint
          and load that.
        </p>
        <h3>Convert in this browser</h3>
        <ul className="pptx-facts">
          <li>Uses LibreOffice running inside the page (WebAssembly). Downloaded once, about {ENGINE_MB} MB, from ZetaOffice's servers. The deck itself is never uploaded.</li>
          <li>The page reloads once the first time, to enable the engine.</li>
          <li>Fonts the engine lacks (Segoe UI, Calibri and similar) are substituted, so line breaks can differ from PowerPoint. Layout, images and colours match.</li>
          <li>Needs a desktop browser with about 1 GB of free memory.</li>
        </ul>
        <h3>Or export a PDF yourself</h3>
        <table>
          <tbody>
            <tr><td>PowerPoint (Windows)</td><td>File › Export › Create PDF/XPS</td></tr>
            <tr><td>PowerPoint (Mac)</td><td>File › Export… › File Format: PDF</td></tr>
            <tr><td>Keynote</td><td>File › Export To › PDF…</td></tr>
            <tr><td>Google Slides</td><td>File › Download › PDF Document</td></tr>
          </tbody>
        </table>
      </div>
      <div className="dialog-foot">
        <button type="button" className="btn ghost" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn" onClick={onChoosePdf}>
          <IconUpload /> Load a PDF instead
        </button>
        <button type="button" className="btn primary" onClick={onConvert}>
          Convert in this browser
        </button>
      </div>
    </dialog>
  );
}
