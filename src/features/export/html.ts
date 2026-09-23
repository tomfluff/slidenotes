import { escapeHtml, fmtDateTimeLong } from '@/lib/format';
import { blobToDataUrl } from '@/lib/download';
import type { Comment, Deck } from '@/lib/types';
import { buildSheetBlocks, sheetSummary } from './sheetData';
import type { ExportStyle } from './useExport';

export interface HtmlResult {
  blob: Blob;
  failed: string[];
}

/**
 * A single self-contained HTML file: images inlined as data URIs, styles inline, no
 * network requests at all (system fonts), so it opens offline and leaks nothing. Prints cleanly.
 */
export async function buildStandaloneHtml(deck: Deck, comments: readonly Comment[], images: Map<string, Blob>, style: ExportStyle): Promise<HtmlResult> {
  const blocks = buildSheetBlocks(deck, comments);
  const failed: string[] = [];
  const dataUrls = new Map<string, string>();
  await Promise.all(
    blocks.map(async (b) => {
      const blob = images.get(b.slide.id);
      if (!blob) {
        failed.push(b.slide.id);
        return;
      }
      try {
        dataUrls.set(b.slide.id, await blobToDataUrl(blob));
      } catch {
        failed.push(b.slide.id);
      }
    }),
  );

  const sum = sheetSummary(deck, comments);
  const fill = `${style.mark}33`;
  const title = `${escapeHtml(deck.name)}, review notes`;
  const generated = fmtDateTimeLong(Date.now());

  const blocksHtml = blocks
    .map((b) => {
      const src = dataUrls.get(b.slide.id);
      const ratio = `${b.slide.width} / ${b.slide.height}`;
      const rects = b.regions
        .map(({ comment }) => {
          const r = comment.rect!;
          const attrs = `x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" vector-effect="non-scaling-stroke"`;
          if (style.markerStyle === 'corners') {
            const lx = Math.min(r.w * 0.28, 6);
            const ly = Math.min(r.h * 0.28, 6);
            const d = `M${r.x} ${r.y + ly} V${r.y} H${r.x + lx} M${r.x + r.w - lx} ${r.y} H${r.x + r.w} V${r.y + ly} M${r.x + r.w} ${r.y + r.h - ly} V${r.y + r.h} H${r.x + r.w - lx} M${r.x + lx} ${r.y + r.h} H${r.x} V${r.y + r.h - ly}`;
            return `${style.halo ? `<path class="corners-halo" d="${d}" vector-effect="non-scaling-stroke"/>` : ''}<path class="corners" d="${d}" vector-effect="non-scaling-stroke"/>`;
          }
          return `${style.halo ? `<rect class="halo" ${attrs}/>` : ''}<rect class="markrect${style.markerStyle === 'outline' ? ' outline' : ''}" ${attrs}/>`;
        })
        .join('');
      const pins = b.regions
        .map(({ comment, number }) => {
          const r = comment.rect!;
          return `<span class="pin" style="left:min(${r.x}%,calc(100% - 26px));top:min(${r.y}%,calc(100% - 26px))" aria-hidden="true">${number}</span>`;
        })
        .join('');
      const li = (c: Comment, label: string, cls: string) =>
        `<li class="${c.resolved ? 'resolved' : ''}"><span class="badge ${cls}">${label}</span><div><p>${escapeHtml(c.text).replace(/\n/g, '<br>')}</p>${
          c.author ? `<small>${escapeHtml(c.author)}</small>` : ''
        }${c.resolved ? '<small class="res">Resolved</small>' : ''}</div></li>`;
      return `<section class="block">
  <div class="left">
    <h2>Slide ${b.slide.index + 1} <span class="mono">/ ${deck.slides.length}</span></h2>
    <div class="frame" style="aspect-ratio:${ratio}">
      ${src ? `<img src="${src}" alt="Slide ${b.slide.index + 1}">` : `<div class="missing">Slide image unavailable</div>`}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${rects}</svg>
      <div class="pins">${pins}</div>
    </div>
  </div>
  <div class="right">
    ${b.regions.length ? `<ol class="notes">${b.regions.map((i) => li(i.comment, String(i.number), 'region')).join('')}</ol>` : ''}
    ${b.generals.length ? `<h3>General notes</h3><ul class="notes">${b.generals.map((i) => li(i.comment, '•', 'general')).join('')}</ul>` : ''}
  </div>
</section>`;
    })
    .join('\n');

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
:root{--paper:#eef1f4;--surface:#fff;--ink:#14181f;--muted:#55606e;--line:#d3d8e0;--mark:${style.mark};--mark-ink:${style.markInk};--mark-fill:${fill}}
@media (prefers-color-scheme:dark){:root{--paper:#0d0f13;--surface:#171b22;--ink:#f2f4f7;--muted:#a7b0bd;--line:#333a45}}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Hiragino Sans","Noto Sans JP","Yu Gothic",sans-serif;padding:40px 20px 80px}
.mono{font-family:ui-monospace,Menlo,Consolas,monospace;font-variant-numeric:tabular-nums}
main{max-width:880px;margin:0 auto;display:flex;flex-direction:column;gap:28px}
header{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:10px;padding-bottom:16px;border-bottom:2px solid var(--ink)}
h1{font-size:22px;margin:0;letter-spacing:-.01em}
header p{margin:0;font-size:12.5px;color:var(--muted)}
.block{display:grid;grid-template-columns:minmax(220px,340px) 1fr;gap:22px;padding-bottom:24px;border-bottom:1px solid var(--line)}
@media (max-width:680px){.block{grid-template-columns:1fr}}
h2{font-size:13px;margin:0 0 8px;display:flex;gap:8px;align-items:center}
h2 .mono{color:var(--muted);font-weight:500}
h3{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin:14px 0 6px}
.frame{position:relative;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:var(--surface);line-height:0}
.frame img{width:100%;height:100%;display:block;object-fit:contain}
.frame svg{position:absolute;inset:0;width:100%;height:100%}
.missing{display:flex;align-items:center;justify-content:center;height:100%;color:var(--muted);font-size:13px;line-height:1.4}
.markrect{fill:var(--mark-fill);stroke:var(--mark);stroke-width:1.5px;paint-order:stroke}
.markrect.outline{fill:transparent}
.halo{fill:none;stroke:#fff;stroke-width:3.5px;opacity:.9}
.corners{fill:none;stroke:var(--mark);stroke-width:2.5px;stroke-linecap:round}
.corners-halo{fill:none;stroke:#fff;stroke-width:5px;stroke-linecap:round;opacity:.9}
.pins{position:absolute;inset:0;pointer-events:none}
.pin{position:absolute;min-width:20px;height:20px;padding:0 5px;border-radius:99px;background:var(--mark);color:var(--mark-ink);font:700 11px/20px ui-monospace,Menlo,monospace;text-align:center;transform:translate(3px,3px);box-shadow:${style.halo ? '0 0 0 1.5px #fff,' : ''}0 1px 3px rgba(0,0,0,.35)}
.notes{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
.notes li{display:flex;gap:10px;font-size:14px}
.notes li.resolved p{color:var(--muted);text-decoration:line-through}
.notes p{margin:0;white-space:pre-wrap;word-break:break-word}
.notes small{display:block;font-size:11.5px;color:var(--muted);margin-top:2px}
.badge{flex:none;width:20px;height:20px;border-radius:99px;background:var(--mark);color:var(--mark-ink);font:700 11px/20px ui-monospace,Menlo,monospace;text-align:center}
.badge.general{background:var(--muted);color:var(--surface)}
@media print{
  :root{--paper:#fff;--surface:#fff;--ink:#101418;--muted:#55606e;--line:#c8ced6}
  body{padding:0;background:#fff}
  .block{break-inside:avoid}
  .pin,.badge{background:#fff!important;color:var(--mark)!important;border:1.5px solid var(--mark);line-height:17px;box-shadow:none}
  .badge.general{color:var(--muted)!important;border-color:var(--muted)}
}
</style>
</head>
<body>
<main>
<header>
  <h1>${title}</h1>
  <p class="mono">${sum.count} comment${sum.count === 1 ? '' : 's'} across ${sum.slides} slide${sum.slides === 1 ? '' : 's'} · generated ${escapeHtml(generated)}</p>
</header>
${blocksHtml}
</main>
</body>
</html>`;

  return { blob: new Blob([html], { type: 'text/html;charset=utf-8' }), failed };
}
