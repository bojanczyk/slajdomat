export {
    createEventTree,
    parentEvent,
    zoomSlide,
    isOverlay,
    runOverlay
}

import {
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
    TimelineMax
} from "gsap";
import { createTimeline } from './timeline'
import { localRect, transforms, svgMap } from './loadSVG'
import { initSoundTimeline } from './sound'


//this is how we can access variables in the browser console
// (window as any).svgMap = svgMap;


const parentMap: Map<SlideEvent, ZoomEvent> = new Map();
function parentEvent(event: SlideEvent): ZoomEvent {
    return parentMap.get(event);
}


function isOverlay(event: SlideEvent): boolean {
    return (event.type == 'show' || event.type == 'hide');
}



//do an animated zoom to the slide on the top of the stack
function zoomSlide(node: SlideEvent, mode: 'immediate' = undefined): void {
    function textRect(rect: Rect) {
        return " " + rect.x + " " + rect.y + " " + rect.width + " " + rect.height;
    }
    const svgDom = document.getElementById("svg") as SVGSVGElement & HTMLElement;
    const viewBox = applyTransform(transforms.get(node), localRect.get(node));

    if (mode == 'immediate') {
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
        parentMap.set(node, parent);
        if (node.type == 'child')
            for (const child of node.children)
                makeParents(child, node);
    }


    makeParents(manifest.tree, undefined);
    createTreeHTML();
    createTimeline();
    initSoundTimeline();
    //creates the timeline html at the bottom of the screen
    timelineHTML();
}






