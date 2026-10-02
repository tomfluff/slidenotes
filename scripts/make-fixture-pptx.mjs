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

const cjk = new pptxgen();
cjk.layout = 'LAYOUT_16x9';
const k1 = cjk.addSlide();
k1.addText('한국어 슬라이드', { x: 0.5, y: 0.8, w: 9, h: 1, fontSize: 40, bold: true, lang: 'ko-KR' });
k1.addText('접근성은 모두가 함께 만드는 것입니다.', { x: 0.5, y: 2, w: 9, h: 0.8, fontSize: 20, lang: 'ko-KR' });
const c1 = cjk.addSlide();
c1.addText('简体中文幻灯片', { x: 0.5, y: 0.8, w: 9, h: 1, fontSize: 40, bold: true, lang: 'zh-CN' });
c1.addText('无障碍是大家共同努力的事情。', { x: 0.5, y: 2, w: 9, h: 0.8, fontSize: 20, lang: 'zh-CN' });
await cjk.writeFile({ fileName: 'tests/e2e/fixtures/korean-chinese.pptx' });
console.log('wrote tests/e2e/fixtures/korean-chinese.pptx');
