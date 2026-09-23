// Runs inside the ZetaOffice (LibreOffice WebAssembly) worker thread. Adapted from the
// zetajs "convertpdf" example (MIT, allotropia software GmbH). It receives a file path in
// the in-memory filesystem, opens it hidden, and stores it as PDF with the Impress filter.
import { ZetaHelperThread } from './vendor/zetajs/zetaHelper.js';

const zHT = new ZetaHelperThread();
const zetajs = zHT.zetajs;
const css = zHT.css;
let xModel;
const beanHidden = new css.beans.PropertyValue({ Name: 'Hidden', Value: true });
const beanOverwrite = new css.beans.PropertyValue({ Name: 'Overwrite', Value: true });

zHT.thrPort.onmessage = (e) => {
  if (e.data.cmd !== 'convert') return;
  try {
    if (xModel !== undefined && xModel.queryInterface(zetajs.type.interface(css.util.XCloseable))) xModel.close(false);
    xModel = zHT.desktop.loadComponentFromURL('file://' + e.data.from, '_blank', 0, [beanHidden]);
    const filter = new css.beans.PropertyValue({ Name: 'FilterName', Value: e.data.filter || 'impress_pdf_Export' });
    xModel.storeToURL('file://' + e.data.to, [beanOverwrite, filter]);
    zetajs.mainPort.postMessage({ cmd: 'converted', id: e.data.id, from: e.data.from, to: e.data.to });
  } catch (err) {
    let message;
    try {
      const exc = zetajs.catchUnoException(err);
      message = String(zetajs.getAnyType(exc)) + ': ' + exc.Message;
    } catch {
      message = String((err && err.message) || err);
    }
    zetajs.mainPort.postMessage({ cmd: 'error', id: e.data.id, message });
  }
};
zHT.thrPort.postMessage({ cmd: 'start' });
