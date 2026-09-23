import JSZip from 'jszip';
import { SCHEMA_VERSION, type Comment, type Deck, type Rect, type ReviewProject, type Slide } from '@/lib/types';

/** Serialises a deck, its images and comments into the round-trippable project zip. */
export async function writeProjectZip(deck: Deck, images: Map<string, Blob>, comments: readonly Comment[]): Promise<Blob> {
  const zip = new JSZip();
  const project: ReviewProject = { schemaVersion: SCHEMA_VERSION, deck, comments: [...comments] };
  zip.file('project.json', JSON.stringify(project, null, 2));
  const folder = zip.folder('slides');
  if (!folder) throw new Error('zip_failed');
  for (const slide of deck.slides) {
    const blob = images.get(slide.id);
    if (!blob) continue;
    folder.file(`${slide.id}.${extFor(blob.type)}`, blob);
  }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

export interface LoadedProject {
  deck: Deck;
  comments: Comment[];
  images: Map<string, Blob>;
  /** Slide ids whose image was missing from the archive. */
  missing: string[];
}

export async function readProjectZip(file: Blob): Promise<LoadedProject> {
  const zip = await JSZip.loadAsync(file);
  const entry = zip.file('project.json');
  if (!entry) throw new Error('Not a SlideNotes project: project.json is missing.');
  const raw: unknown = JSON.parse(await entry.async('string'));
  const project = migrateProject(raw);

  const images = new Map<string, Blob>();
  const missing: string[] = [];
  for (const slide of project.deck.slides) {
    const f = zip.file(new RegExp(`^slides/${escapeRe(slide.id)}\\.[a-z]+$`))[0];
    if (!f) {
      missing.push(slide.id);
      continue;
    }
    const ext = f.name.split('.').pop() ?? 'png';
    images.set(slide.id, await f.async('blob').then((b) => new Blob([b], { type: mimeFor(ext) })));
  }
  return { deck: project.deck, comments: project.comments, images, missing };
}

/**
 * The migration switch. Every project file carries a schemaVersion, and this is the
 * only place that is allowed to interpret an older one.
 */
export function migrateProject(raw: unknown): ReviewProject {
  if (!raw || typeof raw !== 'object') throw new Error('Project file is not valid JSON.');
  const obj = raw as Record<string, unknown>;
  const version = typeof obj.schemaVersion === 'number' ? obj.schemaVersion : 0;
  switch (version) {
    case 1:
      return validateV1(obj);
    default:
      throw new Error(`This project was written by a newer version of SlideNotes (schema ${version}).`);
  }
}

/** Strict: a v1 file is accepted as written or rejected with a reason. No silent repair. */
function validateV1(obj: Record<string, unknown>): ReviewProject {
  const deck = obj.deck as Partial<Deck> | undefined;
  if (!deck || typeof deck !== 'object' || !Array.isArray(deck.slides)) throw new Error('Project file has no deck.');
  if (typeof deck.id !== 'string' || !deck.id) throw new Error('Project file: the deck has no id.');
  const slides: Slide[] = deck.slides.map((s, i) => {
    if (!s || typeof s.id !== 'string' || !s.id) throw new Error(`Project file: slide ${i + 1} has no id.`);
    if (typeof s.width !== 'number' || typeof s.height !== 'number' || !(s.width > 0) || !(s.height > 0)) {
      throw new Error(`Project file: slide ${i + 1} has no valid size.`);
    }
    const out: Slide = { id: s.id, index: typeof s.index === 'number' ? s.index : i, width: s.width, height: s.height };
    if (typeof s.sourceName === 'string') out.sourceName = s.sourceName;
    if (typeof s.alt === 'string') out.alt = s.alt;
    return out;
  });
  const ids = new Set<string>();
  for (const s of slides) {
    if (ids.has(s.id)) throw new Error(`Project file: duplicate slide id ${s.id}.`);
    ids.add(s.id);
  }
  slides.sort((a, b) => a.index - b.index).forEach((s, i) => (s.index = i));

  const rawComments = Array.isArray(obj.comments) ? (obj.comments as Partial<Comment>[]) : [];
  const cids = new Set<string>();
  const comments: Comment[] = [];
  for (const [i, c] of rawComments.entries()) {
    if (!c || typeof c.id !== 'string' || !c.id) throw new Error(`Project file: comment ${i + 1} has no id.`);
    if (cids.has(c.id)) throw new Error(`Project file: duplicate comment id ${c.id}.`);
    cids.add(c.id);
    if (typeof c.slideId !== 'string' || !ids.has(c.slideId)) throw new Error(`Project file: comment ${i + 1} points at a slide that is not in the deck.`);
    if (typeof c.text !== 'string') throw new Error(`Project file: comment ${i + 1} has no text.`);
    if (c.rect !== null && c.rect !== undefined && !isRect(c.rect)) throw new Error(`Project file: comment ${i + 1} has an invalid region.`);
    if (typeof c.createdAt !== 'number' || !Number.isFinite(c.createdAt)) throw new Error(`Project file: comment ${i + 1} has no valid timestamp.`);
    const out: Comment = { id: c.id, slideId: c.slideId, rect: c.rect ?? null, text: c.text, createdAt: c.createdAt };
    if (typeof c.author === 'string' && c.author) out.author = c.author;
    if (typeof c.updatedAt === 'number' && Number.isFinite(c.updatedAt)) out.updatedAt = c.updatedAt;
    if (typeof c.resolved === 'boolean') out.resolved = c.resolved;
    comments.push(out);
  }
  const out: Deck = {
    id: deck.id,
    name: typeof deck.name === 'string' && deck.name ? deck.name : 'Untitled deck',
    createdAt: typeof deck.createdAt === 'number' ? deck.createdAt : Date.now(),
    slides,
  };
  return { schemaVersion: 1, deck: out, comments };
}

function isRect(r: unknown): r is Rect {
  if (!r || typeof r !== 'object') return false;
  const o = r as Record<string, unknown>;
  const num = (k: string) => typeof o[k] === 'number' && Number.isFinite(o[k] as number);
  if (!['x', 'y', 'w', 'h'].every(num)) return false;
  const { x, y, w, h } = o as unknown as Rect;
  return x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= 100.01 && y + h <= 100.01;
}

function extFor(mime: string): string {
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/svg+xml') return 'svg';
  return 'png';
}
function mimeFor(ext: string): string {
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'svg') return 'image/svg+xml';
  return 'image/png';
}
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
