
/*
this code receives svg files from the viewer, and creates a pdf out of them
*/

export { exportPdf };

// variant one
import PDFDocument from 'pdfkit';
import svgToPdf from 'svg-to-pdfkit';



import * as fs from 'fs';
import * as path from 'path';
import { toAlphaNumeric } from '../common/helper';
import { MessageToServerPdf, ServerResponse } from "../common/messages-viewer-server";
import { presentationDir, readManifest, writeManifest } from './main-files';


let pdfDoc: PDFKit.PDFDocument;
let writeStream: fs.WriteStream;
let fileName: string;


//when exporting to pdf, the svg's are sent one by one by the viewer. Otherwise, the messages might be too large and an exception will be raised
async function exportPdf(msg: MessageToServerPdf): Promise<ServerResponse> {

  try {
    if (msg.index == 1) {
      pdfDoc = new PDFDocument({ size: [msg.width, msg.height] });
      const dirName = presentationDir(msg.presentation);
      fileName = toAlphaNumeric(msg.presentation) + '.pdf';
      writeStream = fs.createWriteStream(path.join(dirName, fileName));
      pdfDoc.pipe(writeStream);
    }

    const options = { width: msg.width, height: msg.height, assumePt: true };
    svgToPdf(pdfDoc, msg.svg, 0, 0, options);
    pdfDoc.addPage();

    if (msg.index == msg.maxindex) {
      pdfDoc.end();
      const promise = new Promise((resolve) => {
        writeStream.on('finish', () => {
          resolve('finished');
        });
      });
      await promise;
      const manifest = readManifest(msg.presentation);
      manifest.pdfFile = fileName;
      writeManifest(manifest);  
    }
  }
  catch (e) {
    return { status: 'error', explanation: 'could not create pdf file' }
  }

  // gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPtreeETTINGS=/ebook -dNOPAUSE -dQUIET -dBATCH -sOutputFile=output.pdf input.pdf

  return { status: 'pdf created' };

}

