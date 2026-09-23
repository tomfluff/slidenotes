import { storage } from '@/lib/db';

/**
 * PowerPoint support: the deck is converted to PDF inside the browser by LibreOffice
 * compiled to WebAssembly (ZetaOffice, driven by the MIT zetajs wrapper). The engine is
 * downloaded once from ZetaOffice's CDN; the deck itself never leaves the machine.
 *
 * The engine uses threads, so the page must be cross-origin isolated. GitHub Pages cannot
 * set the headers, so a service worker adds them; registering it reloads the page once.
 * The dropped file is parked in IndexedDB across that reload.
 */

export const ENGINE_MB = 52;
const BASE = import.meta.env.BASE_URL;
const PENDING_KEY = 'pendingPptx';
const READY_TIMEOUT = 5 * 60_000;
const CONVERT_TIMEOUT = 3 * 60_000;

export type PptxPhase = 'download' | 'start' | 'convert';

export const isPptxFile = (f: File): boolean => /\.pptx?$/i.test(f.name);

export function isIsolated(): boolean {
  return typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated === true;
}

export function serviceWorkersAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator && window.isSecureContext;
}

interface Pending {
  name: string;
  type: string;
  lastModified: number;
  blob: Blob;
}

export async function stashPending(file: File): Promise<void> {
  const rec: Pending = { name: file.name, type: file.type, lastModified: file.lastModified, blob: file };
  await storage.setMeta(PENDING_KEY, rec);
}

/** Returns and clears the file parked before the isolation reload, if any. */
export async function takePending(): Promise<File | null> {
  const rec = await storage.getMeta<Pending>(PENDING_KEY);
  if (!rec) return null;
  await storage.setMeta(PENDING_KEY, null);
  return new File([rec.blob], rec.name, { type: rec.type, lastModified: rec.lastModified });
}

/**
 * Registers the header-injecting service worker; the script reloads the page itself once
 * the worker controls it. Resolves only if no reload happened within the grace period,
 * which means registration failed (private mode, blocked workers).
 */
export function requestIsolation(): Promise<'failed'> {
  return new Promise((resolve) => {
    (window as unknown as { coi: unknown }).coi = { quiet: true, doReload: () => window.location.reload() };
    const s = document.createElement('script');
    s.src = `${BASE}coi-serviceworker.js`;
    s.onerror = () => resolve('failed');
    document.head.appendChild(s);
    window.setTimeout(() => resolve('failed'), 8000);
  });
}

// ---- engine -------------------------------------------------------------------------

interface ThreadPort {
  postMessage: (m: unknown) => void;
  onmessage: ((e: MessageEvent) => void) | null;
}
interface EmscriptenFS {
  writeFile: (path: string, data: Uint8Array) => void;
  readFile: (path: string) => Uint8Array;
  unlink: (path: string) => void;
}
interface Engine {
  port: ThreadPort;
  fs: EmscriptenFS;
}
interface ZetaHelperMainCtor {
  new (threadJs: string, options: { threadJsType: 'module' | 'classic'; blockPageScroll?: boolean }): {
    start: (init: () => void) => void;
    thrPort: ThreadPort;
    FS: EmscriptenFS;
  };
}

let enginePromise: Promise<Engine> | null = null;
let queue: Promise<unknown> = Promise.resolve();

async function loadEngine(onPhase: (p: PptxPhase) => void): Promise<Engine> {
  if (!isIsolated()) throw new Error('not_isolated');
  if (!document.getElementById('qtcanvas')) {
    // zetaHelper insists on a canvas; it stays hidden, nothing is drawn for a conversion.
    const c = document.createElement('canvas');
    c.id = 'qtcanvas';
    c.setAttribute('aria-hidden', 'true');
    c.style.cssText = 'position:fixed;width:1px;height:1px;left:-10px;top:-10px;opacity:0;pointer-events:none';
    document.body.appendChild(c);
  }
  onPhase('download');
  const mod = (await import(/* @vite-ignore */ `${BASE}vendor/zetajs/zetaHelper.js`)) as { ZetaHelperMain: ZetaHelperMainCtor };
  const helper = new mod.ZetaHelperMain(`${BASE}office_thread.js`, { threadJsType: 'module', blockPageScroll: false });
  return new Promise<Engine>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('engine_timeout')), READY_TIMEOUT);
    try {
      helper.start(() => {
        onPhase('start');
        helper.thrPort.onmessage = (e: MessageEvent) => {
          if ((e.data as { cmd?: string })?.cmd === 'start') {
            window.clearTimeout(timer);
            const fs = (window as unknown as { FS?: EmscriptenFS }).FS ?? helper.FS;
            resolve({ port: helper.thrPort, fs });
          }
        };
      });
    } catch (err) {
      window.clearTimeout(timer);
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

function getEngine(onPhase: (p: PptxPhase) => void): Promise<Engine> {
  if (!enginePromise) {
    enginePromise = loadEngine(onPhase).catch((err: unknown) => {
      enginePromise = null;
      throw err;
    });
  }
  return enginePromise;
}

let seq = 0;

/** Converts a .pptx (or .ppt) File to a PDF File, one conversion at a time. */
export function convertPptxToPdf(file: File, onPhase: (p: PptxPhase) => void): Promise<File> {
  const run = async (): Promise<File> => {
    const engine = await getEngine(onPhase);
    onPhase('convert');
    const id = ++seq;
    const from = `/tmp/input-${id}.pptx`;
    const to = `/tmp/output-${id}.pdf`;
    engine.fs.writeFile(from, new Uint8Array(await file.arrayBuffer()));
    const bytes = await new Promise<Uint8Array>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('convert_timeout')), CONVERT_TIMEOUT);
      engine.port.onmessage = (e: MessageEvent) => {
        const d = e.data as { cmd?: string; id?: number; message?: string };
        if (d?.id !== id) return;
        window.clearTimeout(timer);
        if (d.cmd === 'converted') {
          try {
            resolve(engine.fs.readFile(to));
          } catch (err) {
            reject(err instanceof Error ? err : new Error(String(err)));
          }
        } else if (d.cmd === 'error') reject(new Error(d.message ?? 'convert_failed'));
      };
      engine.port.postMessage({ cmd: 'convert', id, from, to, filter: 'impress_pdf_Export' });
    }).finally(() => {
      try {
        engine.fs.unlink(from);
        engine.fs.unlink(to);
      } catch {
        /* the in-memory files may already be gone */
      }
    });
    return new File([bytes as BlobPart], file.name.replace(/\.pptx?$/i, '') + '.pdf', { type: 'application/pdf' });
  };
  const p = queue.then(run, run);
  queue = p.catch(() => undefined);
  return p;
}
