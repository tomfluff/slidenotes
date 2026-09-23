import { describe, expect, it } from 'vitest';
import { migrateProject } from '@/features/export/project';

type Raw = { schemaVersion: number; deck: { id: string; name: string; createdAt: number; slides: Record<string, unknown>[] }; comments: Record<string, unknown>[] };
const base = (): Raw => ({
  schemaVersion: 1,
  deck: { id: 'd', name: 'Deck', createdAt: 1, slides: [{ id: 'b', index: 1, width: 10, height: 5 }, { id: 'a', index: 0, width: 10, height: 5, alt: 'Title' }] },
  comments: [
    { id: 'c1', slideId: 'a', rect: { x: 1, y: 2, w: 3, h: 4 }, text: 'ok', createdAt: 5 },
    { id: 'c2', slideId: 'b', rect: null, text: 'general', createdAt: 6, resolved: true, author: 'Y' },
  ],
});

describe('project schema', () => {
  it('accepts a valid v1 project, orders slides by index and keeps optional fields', () => {
    const p = migrateProject(base());
    expect(p.deck.slides.map((s) => s.id)).toEqual(['a', 'b']);
    expect(p.deck.slides.map((s) => s.index)).toEqual([0, 1]);
    expect(p.deck.slides[0]?.alt).toBe('Title');
    expect(p.comments.map((c) => c.id)).toEqual(['c1', 'c2']);
    expect(p.comments[1]).toMatchObject({ rect: null, resolved: true, author: 'Y' });
  });
  it('rejects a v1 file with structural defects instead of repairing it', () => {
    const orphan = base();
    orphan.comments.push({ id: 'c3', slideId: 'zzz', rect: null, text: 'orphan', createdAt: 6 });
    expect(() => migrateProject(orphan)).toThrow(/slide that is not in the deck/);

    const dup = base();
    dup.comments.push({ ...dup.comments[0] });
    expect(() => migrateProject(dup)).toThrow(/duplicate comment id/);

    const badRect = base();
    badRect.comments[0]!['rect'] = { x: 90, y: 0, w: 20, h: 5 };
    expect(() => migrateProject(badRect)).toThrow(/invalid region/);

    const noSize = base();
    noSize.deck.slides[0]!['width'] = undefined;
    expect(() => migrateProject(noSize)).toThrow(/valid size/);

    const dupSlide = base();
    dupSlide.deck.slides[1]!['id'] = 'b';
    expect(() => migrateProject(dupSlide)).toThrow(/duplicate slide id/);
  });
  it('refuses unknown schema versions instead of reinterpreting them', () => {
    expect(() => migrateProject({ schemaVersion: 2, deck: { slides: [] } })).toThrow(/newer version/);
    expect(() => migrateProject({ deck: { slides: [] } })).toThrow();
    expect(() => migrateProject('nope')).toThrow();
  });
});
