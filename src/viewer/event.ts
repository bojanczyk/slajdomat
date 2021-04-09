export {
    createEventTree,
    parentEvent,
    zoomSlide,
    isOverlay,
    runOverlay,
    eventDescription,
    pageNumbers,
    findZoomEvent
}

import {
    EventDescription,
    LiveRecording,
    SlideEvent, ZoomEvent
} from './types'

import {
    createTreeHTML, timelineHTML
} from './html'

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
import { createTimeline, OverlayStep, Step, zoomsIn, ZoomStep } from './timeline'
import { localRect, transforms, svgMap } from './loadSVG'
import { initSoundTimeline } from './sound'


//this is how we can access variables in the browser console
// (window as any).svgMap = svgMap;


const pageNumbers: Map<SlideEvent, number> = new Map();

const parentMap: Map<SlideEvent, ZoomEvent> = new Map();
function parentEvent(event: SlideEvent): ZoomEvent {
    return parentMap.get(event);
}




function isOverlay(event: SlideEvent): boolean {
    return (event.type == 'show' || event.type == 'hide');
}



//do an animated zoom to the slide on the top of the stack
function zoomSlide(node: SlideEvent, mode: 'silent' | 'animated' = 'animated'): void {
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


//creates the tree of slides and events, without adding the svg objects yet, and initalises page numbers
function createEventTree(): void {
    let totalNumberOfPages = 0;

    function makeParents(node: SlideEvent, parent: ZoomEvent) {
        parentMap.set(node, parent);
        pageNumbers.set(node, totalNumberOfPages);
        if (node.type == 'child') {
            totalNumberOfPages ++;
            for (const child of node.children)
                makeParents(child, node);
        }
    }

    makeParents(manifest.tree, undefined);

    //the page number for the root is special, it is the total number of pages
    pageNumbers.set(manifest.tree, totalNumberOfPages);
    createTreeHTML();

    const recorded = getRecordedSteps();
    createTimeline(recorded);
    initSoundTimeline(recorded);

    //creates the timeline html at the bottom of the screen
    timelineHTML();
}



function getRecordedSteps() : LiveRecording {
    const searchParams = (new URL(window.location.href)).searchParams;    
    try {
        const i = parseInt(searchParams.get('live'));
        return manifest.live[i];
    } catch (e) {
        return undefined;
    }
}



function eventDescription(step: Step): EventDescription {
    const retval : EventDescription = { 
        type : 'event',
        slideId: undefined as string, eventId: undefined as string };
    if (step instanceof OverlayStep) {
        retval.slideId = parentEvent(step.overlays[0]).id;
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






