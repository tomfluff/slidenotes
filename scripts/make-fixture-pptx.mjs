// Writes the PowerPoint fixtures for the opt-in conversion test: a two-slide Latin deck and
// a Japanese deck, which only converts legibly when the CJK fonts reach the engine.
import pptxgen from 'pptxgenjs';

const latin = new pptxgen();
latin.layout = 'LAYOUT_16x9';
const s1 = latin.addSlide();
s1.addText('Fixture slide one', { x: 0.5, y: 0.8, w: 9, h: 1, fontSize: 36, bold: true });
s1.addText('Body text on the first page.', { x: 0.5, y: 2, w: 9, h: 0.6, fontSize: 18 });
const s2 = latin.addSlide();
s2.addText('Fixture slide two', { x: 0.5, y: 0.8, w: 9, h: 1, fontSize: 36, bold: true });
await latin.writeFile({ fileName: 'tests/e2e/fixtures/two-slides.pptx' });
console.log('wrote tests/e2e/fixtures/two-slides.pptx');

const ja = new pptxgen();
ja.layout = 'LAYOUT_16x9';
const j1 = ja.addSlide();
j1.addText('日本語のスライド', { x: 0.5, y: 0.8, w: 9, h: 1, fontSize: 40, bold: true, fontFace: 'Meiryo' });
j1.addText('アクセシビリティは、みんなで取り組むものです。漢字・ひらがな・カタカナ。', { x: 0.5, y: 2, w: 9, h: 1, fontSize: 20, fontFace: 'Yu Gothic' });
j1.addText('Mixed: English and 日本語 on one line.', { x: 0.5, y: 3.2, w: 9, h: 0.6, fontSize: 18 });
await ja.writeFile({ fileName: 'tests/e2e/fixtures/japanese.pptx' });
console.log('wrote tests/e2e/fixtures/japanese.pptx');
