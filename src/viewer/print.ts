export { exportPdf }

import { jsPDFOptions, jsPDF } from 'jspdf';
import 'svg2pdf.js'
import { Svg2pdfOptions } from 'svg2pdf.js';

import { allSteps, currentStep, gotoStep, Step, zoomsIn, ZoomStep } from './timeline';


function exportPdf(options :Svg2pdfOptions = undefined): void {

  const svgElement = document.getElementById('svg') as HTMLElement & SVGSVGElement;
  const viewBox = svgElement.viewBox.baseVal;
  // const viewBox = svgElement.getBoundingClientRect();
  const scale = 1;
  const width = viewBox.width * scale;
  const height = viewBox.height * scale;

  const format: jsPDFOptions = {
    orientation: width > height ? "landscape" : "portrait",
    unit: 'pt',
    format: [width, height],
    compress: true
  };
  const pdf = new jsPDF(format);

  if (options == undefined)
    options = {width, height};

  // It seems we cannot generate a pdf page for every slide,
  // as electron will quickly run out of memory. But we can 
  // export a single slide (the current one) at a time.
  pdf.svg(svgElement, options).then(() => pdf.save('printout.pdf'));

  /*
  async function printAll(): Promise<jsPDF> {
    for (const step of allSteps())
      // if (step instanceof ZoomStep && !zoomsIn(step)) 
      {
        await gotoStep(step, 'silent');
        pdf.addPage();
        await pdf.svg(svgElement, options);
      }  
    return pdf;  
  }
  
  const savedStep = currentStep();
  printAll().then((pdf) => { pdf.save('printout.pdf'); gotoStep(savedStep, 'silent') });
  */
}

(window as any).exportPdf = exportPdf;
