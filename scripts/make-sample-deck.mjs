// Renders a small synthetic demo deck to public/sample-deck/slide-NN.png with Playwright's
// Chromium. The slides are placeholders written for this repository; nothing unpublished.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUT = path.resolve('public/sample-deck');
const W = 1600;
const H = 900;

const css = `
  *{box-sizing:border-box} body{margin:0;width:${W}px;height:${H}px;overflow:hidden;font-family:"DejaVu Sans","Liberation Sans",Arial,sans-serif;background:#fff;color:#1b1f27}
  .s{width:${W}px;height:${H}px;padding:90px 110px;display:flex;flex-direction:column;gap:28px;position:relative}
  h1{font-size:64px;margin:0;line-height:1.1;letter-spacing:-.01em} h2{font-size:48px;margin:0;line-height:1.15}
  p,li{font-size:30px;line-height:1.45;margin:0} ul{margin:0;padding-left:40px;display:flex;flex-direction:column;gap:14px}
  .muted{color:#5b6675} .foot{position:absolute;left:110px;right:110px;bottom:40px;display:flex;justify-content:space-between;font-size:22px;color:#8a94a3}
  .bar{position:absolute;left:0;top:0;bottom:0;width:26px;background:#7b2cbf}
  .chart{display:flex;align-items:flex-end;gap:36px;height:380px;padding:0 20px;border-bottom:3px solid #c8ced6}
  .chart div{flex:1;background:#7b2cbf;border-radius:8px 8px 0 0;position:relative} .chart div span{position:absolute;top:-40px;left:0;right:0;text-align:center;font-size:24px;color:#5b6675}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:40px;flex:1}
  .card{border:2px solid #d3d8e0;border-radius:18px;padding:34px;display:flex;flex-direction:column;gap:12px}
  .card h3{margin:0;font-size:34px} .card p{font-size:26px}
  .img{background:linear-gradient(135deg,#ece2f7,#cfd6e3);border-radius:18px;flex:1;display:flex;align-items:center;justify-content:center;color:#5b6675;font-size:26px}
  .tiny{font-size:18px;color:#8a94a3}
  .over{font-size:44px;margin-top:-60px}
`;

const slides = [
  `<div class="s"><div class="bar"></div><h1 style="margin-top:160px">Reviewing Slide Decks<br>in the Browser</h1><p class="muted">A synthetic demo deck for Slide Review</p><div class="foot"><span>Demo deck</span><span>1</span></div></div>`,
  `<div class="s"><h2>Motivation</h2><ul><li>Feedback on slides lives in emails, chats and screenshots</li><li>Reviewers point at things: "the title on slide 4", "that chart"</li><li>Authors need the exact place, not a paraphrase</li><li style="font-size:22px">This bullet is much smaller than the others</li></ul><div class="foot"><span>Demo deck</span><span>2</span></div></div>`,
  `<div class="s"><h2>Approach</h2><div class="grid"><div class="card"><h3>Mark a region</h3><p>Drag over any part of a slide. The region gets a number.</p></div><div class="card"><h3>Write the comment</h3><p>Numbers match between slide and list.</p></div><div class="card"><h3>Compile a sheet</h3><p>One block per commented slide.</p></div><div class="card"><h3>Share</h3><p>PDF, HTML, Markdown, or the project file.</p></div></div><div class="foot"><span>Demo deck</span><span>3</span></div></div>`,
  `<div class="s"><h2>Results</h2><div class="chart"><div style="height:40%"><span>Q1</span></div><div style="height:65%"><span>Q2</span></div><div style="height:55%"><span>Q3</span></div><div style="height:90%"><span>Q4</span></div><div style="height:72%"><span>Q5</span></div></div><p class="tiny">Figure 1. Synthetic numbers, no meaning intended. Axis labels are missing on purpose.</p><div class="foot"><span>Demo deck</span><span>4</span></div></div>`,
  `<div class="s"><h2 class="over">A title that runs long and collides with the top edge of the slide</h2><div class="img">Placeholder figure</div><div class="foot"><span>Demo deck</span><span>5</span></div></div>`,
  `<div class="s"><h2>Study design</h2><div class="grid"><div><ul><li>12 participants</li><li>Within-subjects, counterbalanced</li><li>Two conditions, three tasks each</li></ul></div><div class="img" style="min-height:360px">Diagram placeholder</div></div><div class="foot"><span>Demo deck</span><span>6</span></div></div>`,
  `<div class="s"><h2>Limitations</h2><ul><li>Synthetic deck, synthetic findings</li><li>Contrast on this slide is deliberately weak</li><li style="color:#b8bec8">This line is hard to read</li></ul><div class="foot"><span>Demo deck</span><span>7</span></div></div>`,
  `<div class="s"><div class="bar"></div><h1 style="margin-top:200px">Thank you</h1><p class="muted">Questions welcome. Mark anything on these slides to try the tool.</p><div class="foot"><span>Demo deck</span><span>8</span></div></div>`,
];

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
for (const [i, body] of slides.entries()) {
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${body}</body></html>`);
  const png = await page.screenshot({ type: 'png' });
  const name = `slide-${String(i + 1).padStart(2, '0')}.png`;
  await writeFile(path.join(OUT, name), png);
  console.log('wrote', name);
}
await browser.close();
await writeFile(path.join(OUT, 'manifest.json'), JSON.stringify({ name: 'Demo deck', width: W, height: H, count: slides.length }, null, 2));
