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

/**
 * The ZetaOffice package ships 137 fonts and none of them covers CJK, so Japanese, Korean
 * and Chinese text rendered as nothing. These fonts (SIL OFL, see THIRD_PARTY_NOTICES.md)
 * are written into the engine's font directory before LibreOffice starts, when fontconfig
 * scans it. Only the scripts the deck uses are downloaded.
 */
export type CjkScript = 'ja' | 'ko' | 'zh';
const FONT_SETS: Record<CjkScript, { files: string[]; mb: number }> = {
  ja: { files: ['NotoSansJP-Regular.otf', 'NotoSansJP-Bold.otf'], mb: 9 },
  ko: { files: ['NotoSansKR-Regular.otf', 'NotoSansKR-Bold.otf'], mb: 9 },
  zh: { files: ['NotoSansSC-Regular.otf', 'NotoSansSC-Bold.otf'], mb: 16 },
};
const ALL_SCRIPTS: CjkScript[] = ['ja', 'ko', 'zh'];
export const FONTS_MB_MAX = ALL_SCRIPTS.reduce((n, k) => n + FONT_SETS[k].mb, 0);
const FONT_DIR = '/instdir/share/fonts/truetype';
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

// ---- fonts --------------------------------------------------------------------------

const KANA = /[\u3040-\u30ff\uff66-\uff9f]/;
const HANGUL = /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/;
const HAN = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;

/**
 * Which CJK scripts the slides use, read from the slide XML inside the .pptx. Han characters
 * alone are ambiguous, so the run language tags decide, then kana, then Chinese. Anything
 * that cannot be inspected (a binary .ppt, a damaged zip) gets every font.
 */
export async function detectScripts(file: File): Promise<Set<CjkScript>> {
  try {
    const { default: JSZip } = await import('jszip');
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const names = Object.keys(zip.files).filter((n) => /^ppt\/(slides|slideLayouts|slideMasters)\/[^/]+\.xml$/.test(n));
    if (!names.length) return new Set(ALL_SCRIPTS);
    const xml = (await Promise.all(names.map((n) => zip.file(n)!.async('string')))).join('\n');
    const langs = new Set<string>();
    for (const m of xml.matchAll(/\blang="([a-z]{2})/gi)) langs.add(m[1]!.toLowerCase());
    const out = new Set<CjkScript>();
    if (KANA.test(xml)) out.add('ja');
    if (HANGUL.test(xml)) out.add('ko');
    if (HAN.test(xml)) {
      if (langs.has('ja')) out.add('ja');
      if (langs.has('zh')) out.add('zh');
      if (!langs.has('ja') && !langs.has('zh')) out.add(out.has('ja') ? 'ja' : 'zh');
    }
    return out;
  } catch {
    return new Set(ALL_SCRIPTS);
  }
}

/** Scripts the running engine was started with; fontconfig only scans at start-up. */
let installed: Set<CjkScript> | null = null;
let wanted: Set<CjkScript> = new Set();

export interface FontPlan {
  /** 'restart' when the engine already runs without a font this deck needs. */
  action: 'ok' | 'restart';
  scripts: CjkScript[];
  /** What the first conversion downloads: engine plus the chosen fonts. */
  downloadMb: number;
}

export async function planFonts(file: File): Promise<FontPlan> {
  const needed = await detectScripts(file);
  const scripts = ALL_SCRIPTS.filter((k) => needed.has(k));
  const downloadMb = ENGINE_MB + scripts.reduce((n, k) => n + FONT_SETS[k].mb, 0);
  if (installed && scripts.some((k) => !installed!.has(k))) return { action: 'restart', scripts, downloadMb };
  if (!installed) wanted = new Set([...wanted, ...scripts]);
  return { action: 'ok', scripts, downloadMb };
}

function fetchFonts(scripts: Set<CjkScript>): Promise<Array<[string, Uint8Array]>> {
  const files = [...scripts].flatMap((k) => FONT_SETS[k].files);
  return Promise.all(
    files.map(async (name): Promise<[string, Uint8Array]> => {
      const res = await fetch(`${BASE}fonts/${name}`);
      if (!res.ok) throw new Error(`font ${name}: ${res.status}`);
      return [name, new Uint8Array(await res.arrayBuffer())];
    }),
  );
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
  mkdirTree?: (path: string) => void;
  createPath?: (parent: string, path: string, canRead: boolean, canWrite: boolean) => void;
}
interface EmscriptenModule {
  preRun?: Array<() => void>;
  addRunDependency?: (id: string) => void;
  removeRunDependency?: (id: string) => void;
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
    Module: EmscriptenModule;
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
  installed = new Set(wanted);
  installFonts(helper.Module, fetchFonts(installed));
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

/**
 * Emscripten runs `preRun` after the in-memory filesystem exists and before `main`, which
 * is when LibreOffice initialises fontconfig. A run dependency holds `main` back until the
 * fonts are in place. A failed font download is logged, not fatal: the deck still converts,
 * only CJK text is lost. The filesystem is the global `FS` the non-modular build
 * leaks; reading `Module.FS` trips an "FS was not exported" assertion that aborts the engine.
 */
function installFonts(module: EmscriptenModule, fonts: Promise<Array<[string, Uint8Array]>>): void {
  const w = window as unknown as { FS?: EmscriptenFS };
  module.preRun = [
    ...(module.preRun ?? []),
    () => {
      const fs = w.FS;
      if (!fs || !module.addRunDependency || !module.removeRunDependency) return;
      module.addRunDependency('slidenotes-fonts');
      fonts
        .then((list) => {
          if (fs.mkdirTree) fs.mkdirTree(FONT_DIR);
          else fs.createPath?.('/', FONT_DIR.slice(1), true, true);
          for (const [name, bytes] of list) fs.writeFile(`${FONT_DIR}/${name}`, bytes);
        })
        .catch((err: unknown) => console.warn('SlideNotes: CJK fonts not installed', err))
        .finally(() => module.removeRunDependency?.('slidenotes-fonts'));
    },
  ];
}

function getEngine(onPhase: (p: PptxPhase) => void): Promise<Engine> {
  if (!enginePromise) {
    enginePromise = loadEngine(onPhase).catch((err: unknown) => {
      enginePromise = null;
      installed = null;
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
