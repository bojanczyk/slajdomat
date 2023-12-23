export { exportPdf }


import { allSteps, currentStep, gotoStep, Step, zoomsIn, ZoomStep } from './timeline';
import { MessageToServerPdf } from './types';
import { sendToServer } from './files';
import { manifest } from './viewer';


// send the slides to be converted to pdf. the conversion is done by the app, since the libraries that do this take approximately 3M, thus increasing the size of the webpage from 1M to 4M.


function reduceSvg(svg: SVGElement): void {

  // const viewBox = svg.getAttribute('viewBox').split(' ').map(parseFloat);

  // svg.querySelectorAll('*').forEach(element => {
  //   const bbox = (element as any).getBBox();
  //   if (
  //     bbox.x < viewBox[0] ||
  //     bbox.y < viewBox[1] ||
  //     bbox.x + bbox.width > viewBox[0] + viewBox[2] ||
  //     bbox.y + bbox.height > viewBox[1] + viewBox[3]
  //   ) {
  //     element.remove();
  //   }
  // });
}


async function exportPdf(): Promise<void> {


  const svgElement = document.getElementById('svg') as HTMLElement & SVGSVGElement;
  const viewBox = svgElement.viewBox.baseVal;
  // const viewBox = svgElement.getBoundingClientRect();
  const scale = 1;
  const width = viewBox.width * scale;
  const height = viewBox.height * scale;


  const savedStep = currentStep();


  let all = allSteps();

  const retval: MessageToServerPdf = {
    type: 'toPdf',
    svg: undefined,
    width: width,
    height: height,
    presentation: manifest.presentation,
    maxindex: all.length,
    index: 0
  }

  for (const step of all)
  // if (step instanceof ZoomStep && !zoomsIn(step)) 
  {
    await gotoStep(step, 'silent');
    const clonedSVG = svgElement.cloneNode(true) as SVGElement;
    reduceSvg(clonedSVG);
    retval.svg = new XMLSerializer().serializeToString(clonedSVG);
    retval.index++;
    const response = await sendToServer(retval);
    if (response.status == 'pdf created')
      console.log('succesfully created ' + retval.index + '/' + retval.maxindex);
    else if (response.status == 'error')
      console.log('failed to create pdf', response.explanation);
    else throw 'unexpected response from server';
  }
  gotoStep(savedStep, 'silent');





}

// //this is for debugging purposes
// (window as any).exportPdf = exportPdf;
