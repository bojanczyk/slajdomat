export { exportPdf }

import { jsPDFOptions, jsPDF } from 'jspdf';
import 'svg2pdf.js'
import { Svg2pdfOptions } from 'svg2pdf.js';
import JSZip from 'jszip';

import { allSteps, currentStep, gotoStep, Step, zoomsIn, ZoomStep } from './timeline';


async function exportPdf(options: Svg2pdfOptions = undefined): Promise<void> {

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

  if (options == undefined)
    options = { width, height };

  // It seems we cannot generate a pdf page for every slide,
  // as electron will quickly run out of memory. But we can 
  // export a single slide (the current one) at a time.
  // await pdf.svg(svgElement, options);
  // pdf.save('printout.pdf');


  const pdfList: jsPDF[] = [];
  const savedStep = currentStep();

  let index = 0;
  for (const step of allSteps())
  // if (step instanceof ZoomStep && !zoomsIn(step)) 
  {
    index++;
    if (index < 50) {
      await gotoStep(step, 'silent');
      const pdf = new jsPDF(format);
      await pdf.svg(svgElement, options);
      pdfList.push(pdf);
    }
  }

  // pdf.save('printout.pdf');
  gotoStep(savedStep, 'silent');


  const zip = new JSZip();

  // Loop through each PDF and add them to the zip file
  pdfList.forEach((pdf, index) => {
    // Convert the PDF content to a data URI
    const pdfContent = pdf.output('blob'); // or 'blob' for blob data

    // Add the PDF content to the zip file
    zip.file(`file${index + 1}.pdf`, pdfContent, { base64: false });
  });

 // Generate the zip file asynchronously
  const content = await zip.generateAsync({ type: 'blob' });
  // Create a download link for the zip file
  const link = document.createElement('a');
  link.href = URL.createObjectURL(content);
  link.download = 'multiple_pdfs.zip'; // Set the desired name for the zip file
  link.click();
}

//this is for debugging purposes
(window as any).exportPdf = exportPdf;
