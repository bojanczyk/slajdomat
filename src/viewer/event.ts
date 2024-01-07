export {
    createEventTree,
    zoomSlide,
    isOverlay,
    runOverlay,
    eventDescription,
    findZoomEvent
}

import {
    EventDescription,
    SlideEvent, ZoomEvent
} from './types'



import {
    manifest
} from './viewer'

import {
    applyTransform,
    Rect,
} from './transform'

import {
    TimelineMax, gsap
} from "gsap";
import {OverlayStep, Step, zoomsIn, ZoomStep } from './timeline'
import { localRect, transforms, svgMap } from './loadSVG'
import { commentSlide } from './comments';



//this is how we can access variables in the browser console
// (window as any).svgMap = svgMap;






function isOverlay(event: SlideEvent): boolean {
    return (event.type == 'show' || event.type == 'hide');
}



//do an animated zoom to the slide on the top of the stack
function zoomSlide(node: SlideEvent, mode: 'silent' | 'animated' = 'animated'): void {

    commentSlide(node);
    function textRect(rect: Rect) {
        return " " + rect.x + " " + rect.y + " " + rect.width + " " + rect.height;
    }
    const svgDom = document.getElementById("svg") as SVGSVGElement & HTMLElement;

    const viewBox = applyTransform(transforms.get(node), localRect.get(node));

    if (mode == 'silent') {
        svgDom.setAttribute('viewBox', textRect(viewBox));
    }
    else {
        const tla = new TimelineMax({});
        tla.to(svgDom, 1.5, {
            attr: {
                viewBox: textRect(viewBox)
            }
        });
    }
}

//execute an overlay event (for the moment, these are hide or show)
function runOverlay(overlay: SlideEvent, direction: number, silent: string): void {
    let opacity;
    if ((overlay.type == "show" && direction == 1) || (overlay.type == "hide" && direction == -1))
        opacity = 1;

    else
        opacity = 0;

    const svg = svgMap.get(overlay);
    if (svg != undefined) {
        if (silent == 'animated') {
            gsap.to(svg, {
                duration: 0.3,
                opacity: opacity
            });
        }
        else {
            svg.style.opacity = opacity.toString();
        }
    }
}


//creates the tree of slides and events, without adding the svg objects yet
function createEventTree(): void {

    function makeParents(node: SlideEvent, parent: ZoomEvent) {
        node.parent = parent;
        if (node.type == 'child') {
            for (const child of node.children)
                makeParents(child, node);
        }
    }

    makeParents(manifest.tree, undefined);

    

    
}







function eventDescription(step: Step): EventDescription {
    const retval : EventDescription = { 
        type : 'event',
        slideId: undefined as string, eventId: undefined as string };
    if (step instanceof OverlayStep) {
        retval.slideId = step.overlays[0].parent.id;
        retval.eventId = step.overlays[0].eventId;
    }
    else if (step instanceof ZoomStep) {
        retval.slideId = step.source.id;
        if (zoomsIn(step))
            retval.eventId = step.target.eventId;
        else
            retval.eventId = 'finish';
    }
    else {
        //the last step
        retval.slideId = manifest.tree.id;
        retval.eventId = 'finish';
    }
    return retval;
}

function findZoomEvent(id : string ) : ZoomEvent {
    function rec(event : ZoomEvent) : ZoomEvent {
        if (event.id == id)
            return event;
        for (const child of event.children)
            if (child.type == 'child'){
                const retval = rec(child);
                if (retval != undefined)    
                    return retval;
            }
        return undefined;
    }
    return rec(manifest.tree);
}






