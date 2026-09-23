import { uid } from '@/lib/id';
import type { IngestedDeck } from './ingest';

interface Manifest {
  name: string;
  width: number;
  height: number;
  count: number;
}

/** Loads the bundled synthetic demo deck from public/sample-deck. */
export async function loadSampleDeck(): Promise<IngestedDeck> {
  const base = import.meta.env.BASE_URL;
  const manifest = (await fetch(`${base}sample-deck/manifest.json`).then((r) => {
    if (!r.ok) throw new Error('sample_missing');
    return r.json();
  })) as Manifest;
  const images = new Map<string, Blob>();
  const slides = [];
  for (let i = 1; i <= manifest.count; i++) {
    const name = `slide-${String(i).padStart(2, '0')}.png`;
    const blob = await fetch(`${base}sample-deck/${name}`).then((r) => {
      if (!r.ok) throw new Error('sample_missing');
      return r.blob();
    });
    const id = uid();
    images.set(id, blob);
    slides.push({ id, index: i - 1, width: manifest.width, height: manifest.height, sourceName: name });
  }
  return { deck: { id: uid(), name: manifest.name, createdAt: Date.now(), slides, sample: true }, images };
}
