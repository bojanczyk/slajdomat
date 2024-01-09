
export { addToQueue, svgMap, localRect, transforms }
import { isOverlay, zoomSlide } from './event';
import { fileName } from './files';
import { markDisabled, removeLoading, userAlert } from './html';
import { allSteps, futureSlide, OverlayStep } from './timeline';
import { applyTransform, getBoundRect, getTransform, idTransform, Transform, transformToString } from './transform';
import {
    SlideEvent, ZoomEvent
} from './types'
import { updatePageNumber } from './viewer';


const loadStruct = {
    //the queue of slides waiting to be loaded. We assume that for each slide x in the queue, either the parent of x is in the queue, or already loaded
    waiting: new Set() as Set<ZoomEvent>,
    //the queue of slides that have already started downloading their svg
    loading: new Set() as Set<ZoomEvent>,
    //the functions to be called once no more slides are in the waiting and loading queues
    onceEmpty: [] as (() => void)[],
    //the functions to be called if there is an error in loading the slides
    onError: [] as (() => void)[]

}

const transforms: Map<SlideEvent, Transform> = new Map();
const svgMap: Map<SlideEvent, SVGElement> = new Map();
const svgdefs: Map<SlideEvent, SVGDefsElement> = new Map();

const localRect: Map<SlideEvent, Rect> = new Map();

//add all slides on the list of loading queue, including all ancestors of these slides. Also, add the callback function to the list of functions to execute once the queue is empty
function addToQueue(slides: SlideEvent[]): Promise<void> {


    return new Promise((resolve, reject) => {
        loadStruct.onceEmpty.push(resolve);
        loadStruct.onError.push(reject);
        for (const slide of slides) {
            if (slide.type == 'child') {
                let ancestor: SlideEvent = slide;
                while (ancestor != undefined && svgMap.get(ancestor) == undefined) {
                    if (!loadStruct.waiting.has(ancestor) && !loadStruct.loading.has(ancestor))
                        loadStruct.waiting.add(slide);
                    ancestor = ancestor.parent;
                }
            }
        }
        processQueue();
    })

}

function processQueue() {
    const newWaiting = new Set() as Set<ZoomEvent>
    for (const slide of loadStruct.waiting) {
        //we start loading those slides which are either the root, or have a loaded parent
        if (slide.parent == undefined || svgMap.get(slide.parent) != undefined) {
            //ready to load svg
            const ob = document.createElement("object");
            const file = fileName(slide.id, 'image.svg');
            ob.setAttribute("data", file);
            ob.setAttribute("type", "image/svg+xml");
            ob.classList.add("hidden-svg");
            document.body.appendChild(ob);
            ob.onload = function () { finishedLoading(slide, ob); }
            loadStruct.loading.add(slide);
        }
        else {
            //otherwise, this node will still be waiting
            newWaiting.add(slide);
        }
    }
    loadStruct.waiting = newWaiting;

    //if everything is completely loaded, then we use the callback functions
    if (loadStruct.waiting.size == 0 && loadStruct.loading.size == 0) {
        for (const f of loadStruct.onceEmpty)
            f();
        loadStruct.onceEmpty = [];
        loadStruct.onError = [];
    }
}

//will be called if there is any error while loading any svg
function queueError() {
    console.log('error');
    for (const f of loadStruct.onError)
        f();
    loadStruct.onceEmpty = [];
    loadStruct.onError = [];
}



//function that is called once the svg for a slide finishes loading. The function extracts the svg from the loaded object, attaches the svg to the event and its overlays, and sets the initial visibility of overlays accordingly. Finally, the svg of the slide is attached to the main svg, using a separate function.
function finishedLoading(slide: ZoomEvent, object: HTMLObjectElement) {

    try {

        // We first find the appropriate svg element. In principle, the right element should be the first child, but Marek Sokołowski mentioned that expressVPN inserts some wrong children, hence the following code
        let svg;
        for (const child of object.contentDocument.firstElementChild.children) {
            if (child.nodeName == 'g') {
                svg = child as SVGElement;
                break;
            }
        }
        if (svg == null)
            throw new Error("No apppropriate svg element found.");

        // We then find the definitions, which contain images as patterns
        // If an image is used, then its id needs to be changed (the reason for this is explained in the comments for cleanDefs, see below)
        let defs;
        for (const child of object.contentDocument.firstElementChild.children) {
            if (child.nodeName == 'defs') {
                defs = child as SVGDefsElement;
                svgdefs.set(slide, defs);
                cleanDefs(defs, slide); // this function is a hack, it removes clip masks from the definitions
                break;
            }
        }

        //we also change the code of some rectangles, such as those which store pictures, see comments for CleanRect below.
        for (const r of svg.querySelectorAll('rect'))
            cleanRect(r, slide, defs);



        // we also need to fix a bug related to SVG <a href=...> nodes:
        // the export function of Figma unfortunately detaches those nodes 
        // from their clicable content (usually a <g> node that is the left sibling of the <a> node...)
        // To avoid messing with the document structure, we simply reposition the content of the <a> node
        // following the bounding box of the corresponding <g> node
        for (const a of svg.querySelectorAll('a')) {
            let child = a.firstElementChild as SVGGraphicsElement;
            let prev_sibling = a.previousElementSibling as SVGGraphicsElement;
            if ((prev_sibling != null) && (child != null)) {
                let bbox = prev_sibling.getBBox() as SVGRect;
                const x = bbox.x || 0 as Number;
                const y = bbox.y || 0 as Number;
                child.setAttribute('x', x.toString());
                child.setAttribute('y', y.toString());
            }
        }

        // we continue by attaching the svg to the slide
        svgMap.set(slide, svg);
        const svgChildren = svg.children as unknown as SVGElement[];

        //in the following code, I loop several times over svgChildren, which is sub-optimal but makes the code more readable.

        //attach each overlay event to its corresponding svg element (for child events we the svg element is the slide itself, so the placeholder will be recomputed)
        for (const event of slide.children) {
            if (isOverlay(event))
                for (const child of svgChildren) {
                    if (child.id == event.id) {
                        svgMap.set(event, child);
                    }
                }
        }

        //hide objects that are  a placeholder rectangle
        for (const svgChild of svgChildren)
            for (const event of slide.children)
                if (event.type == 'child' && event.id == svgChild.id)
                    svgChild.style.opacity = '0';



        //set initial visibility of overlays, which is done differently depending on whether the slide is in the past or in the future
        if (!futureSlide(slide)) {
            for (const step of allSteps()) {
                if (step instanceof OverlayStep &&
                    step.event().parent == slide)
                    step.run('silent');
            }
        }
        else {
            for (const step of allSteps().reverse()) {
                if (step instanceof OverlayStep &&
                    step.event().parent == slide)
                    step.reverse().run('silent');
            }
        }


        //remove the loading style (red) from the tree view
        removeLoading(slide);
        attachSVG(slide);

    } catch (exception) {
        queueError();
        // this means that the svg failed to load correctly
        markDisabled(slide);
        userAlert("Failed to load svg for " + slide.name);
        console.log(exception);
    }

    //remove the slide from the loading queue
    loadStruct.loading.delete(slide);
    processQueue();


}



//each slide has its definitions, but they use the same id's, e.g. 'image0' is used in every slide that has an image. As a result all images would point to the last occurrence of image0 in the document. Probably there is a namespace way to fix this, but since I do not understand namespaces, I simply prepend the slide id to every id in the definitions. 
function cleanDefs(svg: SVGElement, slide: ZoomEvent): void {
    for (const c of svg.childNodes) {
        let child = c as SVGElement;
        child.id = slide.id + child.id;

        //the following two lines might not make sense any more, I forgot why they were needed
        if (child.nodeName == 'clipPath')
            child.remove();

        //As far as I know, the id's in the defs are references in two places: inside the defs in a 'use' tag, which is fixed below, and inside rects in the slide itself, which is treated earlier. 
        if (child.nodeName == 'pattern') {

            for (const use of child.getElementsByTagName('use')) {
                const oldLink = use.getAttribute('xlink:href');
                const newLink = '#' + slide.id + oldLink.slice(1);
                use.setAttribute('xlink:href', newLink);
            }
        }


    }
}



//This code looks at rectangles that store pictures, or have patterns, and modifies their code so that it displays correctly. These are hacks that are used to overcome incompatibilities between Figma's export and the way that browsers display images inside svg's.

function cleanRect(r: SVGRectElement, slide: ZoomEvent, defs: SVGDefsElement) {


    // We replace every rect filled with an image pattern by the original image definition
    // Besides simplifying the document structure, this enables animated images 
    // (e.g. [A]PNG) on all browsers, not just Firefox!
    // This piece of code basically overcomes a problem with animations embedded in svg patterns,
    // which are currently poorly supported in Chrome and Safari.
    //if the rectangle has a fill with an url, then this needs to be prepended with the slide id
    let fill = r.getAttribute('fill'); // should start with "url(#pattern..."
    if ((fill != null) && (fill.startsWith('url(#'))) {
        fill = 'url(#' + slide.id + fill.slice(5);
        r.setAttribute('fill', fill);
    }
    else
        fill = null;
    //find pattern and corresponding use and image referenced by rectangle fill url 
    let pattern: SVGPatternElement;
    if ((defs != null) && (fill != null)) {
        let patternId = fill.slice(5).slice(0, -1);
        for (const p of defs.childNodes) {
            if (p.nodeName == 'pattern') {
                const pat = p as SVGPatternElement;
                if (pat.id == patternId)
                    pattern = pat;
            }
        }
    }
    if (pattern != null) {
        for (const u of pattern.childNodes) {
            if (u.nodeName == 'use') {
                const use = u as SVGUseElement;
                let xlink = use.getAttribute('xlink:href'); // should start with "#<slideId>image...
                let image;
                if (xlink != null) {
                    for (const i of defs.childNodes) {
                        if (i.nodeName == 'image') {
                            const img = i as SVGImageElement;
                            if (img.id == xlink.slice(1))
                                image = img;
                        }
                    }
                }
                if (image != null) {
                    // now, the relevant objects are nested as follows:
                    //    <rect id="..." x="..." y="..." ...>
                    //       <use xlink:href="..." transform="..." ...>
                    //          <image id="..." width="..." height="..." ...>
                    // we need to replace <rect> by <g>, but for this we need to
                    // turn x,y,width,height attributes into a transform attribute
                    let rectG = document.createElementNS("http://www.w3.org/2000/svg", 'g') as SVGGElement;

                    const imgW = parseFloat(image.getAttribute('width') || '1');
                    const imgH = parseFloat(image.getAttribute('height') || '1');
                    const w = parseFloat(r.getAttribute('width') || '1');
                    const h = parseFloat(r.getAttribute('height') || '1');
                    let scaleX = w / imgW;
                    let scaleY = h / imgH;



                    let transformMatrix: number[];

                    //in the examples that I have, either there are x and y attributes, or otherwise (in  case of a reflection), there is a transform that hides them 
                    if (r.hasAttribute('x') && (r.hasAttribute('y'))) {
                        const x = parseFloat(r.getAttribute('x') || '0');
                        const y = parseFloat(r.getAttribute('y') || '0');
                        transformMatrix = [scaleX, 0, 0, scaleY, x, y];
                    }
                    else if (r.hasAttribute('transform')) {
                        //in the examples that I have, the value of the transform attribute will be something like matrix(-1 0 0 1 757 41), where -1 indicates horizontal reflection, 1 indicates vertical non-reflection, and x=757 and  y=41

                        function composeMatrices(m1 : number[], m2 : number[]) {
                            return [
                            m2[0] * m1[0] + m2[2] * m1[1],
                            m2[1] * m1[0] + m2[3] * m1[1],
                            m2[0] * m1[2] + m2[2] * m1[3],
                            m2[1] * m1[2] + m2[3] * m1[3],
                            m2[0] * m1[4] + m2[2] * m1[5] + m2[4],
                            m2[1] * m1[4] + m2[3] * m1[5] + m2[5]
                            ]
                          }
                        const firstMatrix = [scaleX, 0, 0, scaleY, 0 ,0];
                        const secondMatrix = r.getAttribute('transform').slice(7, -1).split(' ').map(parseFloat);
                        transformMatrix = composeMatrices(firstMatrix,secondMatrix);
                    }
                    else throw ('unknown type of rect with image')

                    const transformMatrixString = transformMatrix.map(String).join(' ');
                    rectG.setAttribute('transform', 'matrix(' + transformMatrixString + ')');


                    rectG.id = r.id;

                    let imageClone = image.cloneNode(true) as SVGImageElement;
                    let parent = r.parentNode;
                    parent.insertBefore(rectG, r);
                    rectG.appendChild(imageClone);
                    parent.removeChild(r);
                    pattern.remove();
                    // stop looking for use
                    break;
                }
            }
        }
    }
}



//attaches the svg for a node to the main svg of the presentation. The node's svg is attached as a direct child of the main svg (not as a descendant in the tree structure), with a suitably computed transformation.
function attachSVG(node: SlideEvent) {

    const svg = svgMap.get(node);
    localRect.set(node, getBoundRect(svg));
    //compute the transformation with respect to the local coordinates of the parent
    if (node.parent == undefined) {
        transforms.set(node, idTransform());
    } else {
        let placeholder: Rect;
        for (const s of svgMap.get(node.parent).children)
            if (s.id == node.id) {



                //s is the child link. This could be a group, or a rectangle. We find the dimensions by searching for a rectangle, which could be s or one of its children (the latter happens when s is a group that contains other stuff).
                let rect: SVGRectElement;
                if (s.nodeName == 'rect')
                    rect = (s as unknown) as SVGRectElement;
                else {
                    //querySelectorAll does not count the root element, so the above branch, when s is 'rect', is needed
                    const possibleRects = s.querySelectorAll('rect');
                    if (possibleRects.length == 0)
                        throw ('found no rectangles')
                    else
                        rect = possibleRects[0];
                }


                placeholder = {
                    x: (rect.x as SVGAnimatedLength).baseVal.value,
                    y: (rect.y as SVGAnimatedLength).baseVal.value,
                    width: (rect.width as SVGAnimatedLength).baseVal.value,
                    height: (rect.height as SVGAnimatedLength).baseVal.value
                };
            }

        const target = applyTransform(transforms.get(node.parent), placeholder);
        const transform = getTransform(localRect.get(node), target);
        transforms.set(node, transform);
    }
    svg.setAttribute("transform", transformToString(transforms.get(node)));
    document.getElementById("svg").appendChild(svg);
    if (svgdefs.get(node) != undefined)
        document.getElementById("svg").appendChild(svgdefs.get(node));

    //after loading the root of the event tree, we zoom to the right place immediately, without animation
    if (node.parent == undefined) {
        zoomSlide(node, 'silent');
        updatePageNumber()
    }

}
