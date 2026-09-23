// Writes a two-slide PowerPoint fixture for the opt-in conversion test.
import pptxgen from 'pptxgenjs';
const pres = new pptxgen();
pres.layout = 'LAYOUT_16x9';
const s1 = pres.addSlide();
s1.addText('Fixture slide one', { x: 0.5, y: 0.8, w: 9, h: 1, fontSize: 36, bold: true });
s1.addText('Body text on the first page.', { x: 0.5, y: 2, w: 9, h: 0.6, fontSize: 18 });
const s2 = pres.addSlide();
s2.addText('Fixture slide two', { x: 0.5, y: 0.8, w: 9, h: 1, fontSize: 36, bold: true });
await pres.writeFile({ fileName: 'tests/e2e/fixtures/two-slides.pptx' });
console.log('wrote tests/e2e/fixtures/two-slides.pptx');
