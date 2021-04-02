
export { addToQueue, svgMap, localRect, transforms }
import { isOverlay, parentEvent, zoomSlide } from './event';
import { fileName } from './files';
import { markDisabled, removeLoading, userAlert } from './html';
import { futureSlide } from './timeline';
import { applyTransform, getBoundRect, getTransform, idTransform, Transform, transformToString } from './transform';
import {
    SlideEvent
} from './types'
import { updatePageNumber } from './viewer';


const loadStruct = {
    //the queue of slides waiting to be loaded. We assume that for each slide x in the queue, either the parent of x is in the queue, or already loaded
    waiting: new Set() as Set<SlideEvent>,
    //the queue of slides that have already started downloading their svg
    loading: new Set() as Set<SlideEvent>,
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
                let ancestor = slide;
                while (ancestor != undefined && svgMap.get(ancestor) == undefined) {
                    if (!loadStruct.waiting.has(ancestor) && !loadStruct.loading.has(ancestor))
                        loadStruct.waiting.add(slide);
                    ancestor = parentEvent(ancestor);
                }
            }
        }
        processQueue();
    })

}

function processQueue() {
    const newWaiting = new Set() as Set<SlideEvent>
    for (const slide of loadStruct.waiting) {
        //we start loading those slides which are either the root, or have a loaded parent
        if (parentEvent(slide) == undefined || svgMap.get(parentEvent(slide)) != undefined) {
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
function finishedLoading(slide: SlideEvent, object: HTMLObjectElement) {


    try {
        let svg;

        //We first find the appropriate svg element. In principle, the right element should be the first child, but Marek Sokołowski mentioned that expressVPN changes inserts some wrong children, hence the following code
        for (const child of object.contentDocument.firstElementChild.children) {
            if (child.nodeName == 'g')
                svg = child as SVGElement;
            //the svg has also some definitions, which will contain images
            if (child.nodeName == 'defs') {
                const defs = child as SVGDefsElement;
                svgdefs.set(slide, defs);
                cleanDefs(defs) // this function is a hack, it removes clip masks from the definitions
            }
        }

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
        const future = futureSlide(slide);

        for (const svgChild of svgChildren) {
            if (future) {
                //if the slide is in the future, then an overlay should be made invisible if its first event is show
                for (const eventChild of slide.children)
                if (svgChild.id == eventChild.id && eventChild.type == 'show') {
                    svgChild.style.opacity = '0';
                    break;
                } 
            }
            else {
                //if the slide is in the past, then an overlay should be made invisible if its last event is hide
                for (const eventChild of slide.children.slice().reverse())
                if (svgChild.id == eventChild.id && eventChild.type == 'hide') {
                    svgChild.style.opacity = '0';
                    break;
                }
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


//attaches the svg for a node to the main svg of the presentation. The node's svg is attached as a direct child of the main svg (not as a descendant in the tree structure), with a suitably computed transformation.
function attachSVG(node: SlideEvent) {

    const svg = svgMap.get(node);
    localRect.set(node, getBoundRect(svg));
    //compute the transformation with respect to the local coordinates of the parent
    if (parentEvent(node) == undefined) {
        transforms.set(node, idTransform());
    } else {
        let placeholder: Rect;
        for (const s of svgMap.get(parentEvent(node)).children)
            if (s.id == node.id) {
                //s is the child link. This could be a group, or a rectangle. We find the dimensions by searching for a rectangle, which could be s or one of its children (the latter happens when s is a group that contains other stuff).
                let rect: SVGRectElement = null;
                if (s.nodeName == 'rect')
                    rect = (s as unknown) as SVGRectElement;
                else
                    for (const c of s.children) {
                        if (c.nodeName == 'rect')
                            rect = (c as unknown) as SVGRectElement;
                    }
                placeholder = {
                    x: (rect.x as SVGAnimatedLength).baseVal.value,
                    y: (rect.y as SVGAnimatedLength).baseVal.value,
                    width: (rect.width as SVGAnimatedLength).baseVal.value,
                    height: (rect.height as SVGAnimatedLength).baseVal.value
                };
            }

        const target = applyTransform(transforms.get(parentEvent(node)), placeholder);
        const transform = getTransform(localRect.get(node), target);
        transforms.set(node, transform);
    }
    svg.setAttribute("transform", transformToString(transforms.get(node)));
    document.getElementById("svg").appendChild(svg);
    if (svgdefs.get(node) != undefined)
        document.getElementById("svg").appendChild(svgdefs.get(node));
    
    //after loading the root of the event tree, we zoom to the right place immediately, without animation
    if (parentEvent(node)== undefined) 
        {zoomSlide(node,0);
        updatePageNumber()}

}


//this function is an ugly hack. In the current situation, clip masks are mis-applied. This could be because their coordinates are not localized, but for the moment I just delete all clip masks
function cleanDefs(svg: SVGElement): void {
    for (const c of svg.childNodes) {
        if (c.nodeName == 'clipPath')
            c.remove();
    }
}
