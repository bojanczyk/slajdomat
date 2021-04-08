export { exportPdf }


import { jsPDFOptions } from 'jspdf';
import { jsPDF } from 'jspdf';
import 'svg2pdf.js'
import { Svg2pdfOptions } from 'svg2pdf.js';

import { allSteps, currentStep, gotoStep, Step, zoomsIn, ZoomStep } from './timeline';

function exportPdf(options :Svg2pdfOptions = undefined): void {



  const svg = document.getElementById('svg') as HTMLElement & SVGSVGElement;

  const viewBox = svg.viewBox.baseVal;


  const scale = 1;
  const width = viewBox.width * scale;
  const height = viewBox.height * scale;


  console.log(viewBox);
  const format: jsPDFOptions = {
    orientation: "landscape",
    unit: 'cm',
    format: [width, height],
    compress: true
  };
  const doc = new jsPDF();

  if (options != undefined)
  {doc.svg(svg, options).then(() => doc.save('my.pdf'));}
  else 
  {doc.svg(svg, {height : height, width : width}).then(() => doc.save('my.pdf'));}

/*
  async function printAll(): Promise<jsPDF> {
    
    for (const step of allSteps())
      // if (step instanceof ZoomStep && !zoomsIn(step)) 
      {
        await gotoStep(step, 'immediate');
        doc.addPage();
        await doc.svg(svg, { height: height, width: width });
      }  
    return doc;  
  }

  
  const savedStep = currentStep();
  printAll().then((doc) => { doc.save('myPDF.pdf'); gotoStep(savedStep) }
  );
*/
  
}

(window as any).exportPdf = exportPdf;