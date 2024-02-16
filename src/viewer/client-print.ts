export { exportPdf, initPdf };



import { sendToServer } from './files';
import { currentState, gotoIndex, statesInPresentation, timeline } from './timeline';
import { MessageToServerPdf} from '../common/messages-viewer-server';
import { State} from '../common/types';
import { manifest } from './viewer';


// send the slides to be converted to pdf. the conversion is done by the app, since the libraries that do this take approximately 3M, thus increasing the size of the webpage from 1M to 4M.


//display the pdf links if the files exist
function initPdf() {

  for (const button of document.querySelectorAll('span')) {

      switch (button.id) {
          case 'pdf-print-button':
              button.addEventListener('click', event => {
                  exportPdf()
              })
              break;
          case 'link-to-pdf':
              button.addEventListener('click', event => {
                  window.open(manifest.pdfFile, 'open');
              })
              break;
      }
  }
  if (manifest.pdfFile != undefined) {
      const theLink = document.getElementById('link-to-pdf');
      theLink.classList.remove('hidden');
  }

}


function reduceSvg(svg: SVGElement & SVGSVGElement): void {


  document.body.appendChild(svg);
  const viewBox = svg.getBoundingClientRect();


  svg.querySelectorAll('*').forEach(element => {
    const bbox = (element as any).getBoundingClientRect();
    if (
      bbox.x + bbox.width < viewBox.x ||
      bbox.y + bbox.height < viewBox.y ||
      bbox.x > viewBox.x + viewBox.width ||
      bbox.y > viewBox.y + viewBox.height
    ) {
      element.remove();
    }
  });


  document.body.removeChild(svg);
}



async function exportPdf(): Promise<void> {


  const svgElement = document.getElementById('svg') as HTMLElement & SVGSVGElement;
  const viewBox = svgElement.viewBox.baseVal;
  // const viewBox = svgElement.getBoundingClientRect();
  const scale = 1;
  const width = viewBox.width * scale;
  const height = viewBox.height * scale;


  const savedState = timeline.current

  const retval: MessageToServerPdf = {
    type: 'toPdf',
    svg: undefined,
    width: width,
    height: height,
    presentation: manifest.presentation,
    maxindex: 0,
    index: 0
  }

  //which steps should make it to the pdf
  function useIndex(index: number) {
    return true;
    //we can later imrove this logic so that only some events are exported, such as the following (which does not work, but appeals to the right methods)
    //  return step instanceof ZoomStep && !zoomsIn(step);
  }

  //count how many steps will be used
  const statesToPdf: number[] = [];
  for (let i = 0; i < timeline.frames.length; i++) {
    if (useIndex(i)) {
      statesToPdf.push(i);
    }
  }

  retval.maxindex = statesToPdf.length;
  const status = document.querySelector('#pdf-export-status');

  try {

    for (const i of statesToPdf) {
      await gotoIndex(i, 'silent',0);
      const clonedSVG = svgElement.cloneNode(true) as HTMLElement & SVGSVGElement;


      reduceSvg(clonedSVG);
      retval.svg = new XMLSerializer().serializeToString(clonedSVG);
      retval.index++;
      const response = await sendToServer(retval);
      if (response.status == 'pdf created') {
        status.innerHTML = 'Exporting slide ' + retval.index + '/' + retval.maxindex;
      }
      else
        if (response.status == 'error') {
          throw (response.explanation);
        }
        else throw 'unexpected response from server';
    }
    status.innerHTML = 'Successfully exported pdf.';

    //show a little animation that draws attention to the pdf icon
    const icon = document.querySelector('#link-to-pdf');
    icon.classList.add('growAndShrink');
    icon.classList.remove('hidden');
    setTimeout(() => {
      icon.classList.remove('growAndShrink')
    }, 3000);

  }
  catch (e) {
    status.innerHTML = 'Failed to export:' + e
  }
  gotoIndex(savedState, 'silent',0);
}

// //this is for debugging purposes
// (window as any).exportPdf = exportPdf;
