
export { exportPdf }

// variant one
import PDFDocument from 'pdfkit'
import svgToPdf from 'svg-to-pdfkit'



import * as fs from 'fs';
import * as path from 'path';
import { MessageToServerPdf, ServerResponse } from "../viewer/types";
import { sendStatus } from './main';
import { readManifest, writeManifest, presentationDir } from './main-files';
import { sanitize } from '../common/helper';


let pdfDoc: PDFKit.PDFDocument;
let writeStream: fs.WriteStream;
let fileName: string;


//when exporting to pdf, the svg's are sent one by one by the viewer. This is because each
async function exportPdf(msg: MessageToServerPdf): Promise<ServerResponse> {

  try {
    if (msg.index == 1) {
      pdfDoc = new PDFDocument({ size: [msg.width, msg.height] });
      const dirName = presentationDir(msg.presentation);
      fileName = sanitize(msg.presentation) + '.pdf';
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

  // gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/ebook -dNOPAUSE -dQUIET -dBATCH -sOutputFile=output.pdf input.pdf

  return { status: 'pdf created' };

}



/*
// variant two
import { jsPDFOptions, jsPDF } from 'jspdf';
import 'svg2pdf.js'
import { Svg2pdfOptions } from 'svg2pdf.js';

    // // variant two 

    // const format: jsPDFOptions = {
    //     orientation: msg.width > msg.gheight ? "landscape" : "portrait",
    //     unit: 'pt',
    //     format: [msg.width, msg.height],
    //     compress: true
    // };

    // const options : Svg2pdfOptions = {width : msg.width, height : msg.height};


    // for (const svgContent of msg.svgs) {
    //     const pdf = new jsPDF(format);
    //     await pdf.svg(svgContent, options);
    //         // pdfList.push(pdf);
    // }
    // let index = 0;
    // for (const step of allSteps())
    // // if (step instanceof ZoomStep && !zoomsIn(step)) 
    // {
    //     index++;
    //     if (index < 50) {
    //         await gotoStep(step, 'silent');
    //         retval.svgs.push(new XMLSerializer().serializeToString(svgElement));
    //         // const pdf = new jsPDF(format);
    //         // await pdf.svg(svgElement, options);
    //         // pdfList.push(pdf);
    //     }
    // }

    // console.log(msg);

    */