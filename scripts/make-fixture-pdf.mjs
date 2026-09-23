// Writes a two-page PDF fixture for the import test. Landscape 16:9 pages with text.
import { jsPDF } from 'jspdf';
import { writeFileSync } from 'node:fs';
const doc = new jsPDF({ unit: 'mm', format: [254, 142.9], orientation: 'landscape' });
doc.setFontSize(32);
doc.text('Fixture slide one', 20, 40);
doc.setFontSize(14);
doc.text('Body text on the first page.', 20, 60);
doc.addPage([254, 142.9], 'landscape');
doc.setFontSize(32);
doc.text('Fixture slide two', 20, 40);
writeFileSync('tests/e2e/fixtures/two-slides.pdf', Buffer.from(doc.output('arraybuffer')));
console.log('wrote tests/e2e/fixtures/two-slides.pdf');
