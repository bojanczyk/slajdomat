export {
    createEventTree,
    eventIndex,
    parentEvent,
    zoomSlide,
    isOverlay,
    runOverlay
}

import {
    SlideEvent
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
import { createTimeline} from './timeline'
import { localRect, transforms, svgMap } from './loadSVG'
import { initSoundTimeline } from './sound'










//this is how we can access variables in the browser console
// (window as any).svgMap = svgMap;


const parentMap: Map<SlideEvent, SlideEvent> = new Map();
function parentEvent(event: SlideEvent): SlideEvent {
    return parentMap.get(event);
}


function isOverlay(event: SlideEvent): boolean {
    return (event.type == 'show' || event.type == 'hide');
}



//do an animated zoom to the slide on the top of the stack
function zoomSlide(node: SlideEvent, duration = 1.5): void {    
    function textRect(rect: Rect) {
        return " " + rect.x + " " + rect.y + " " + rect.width + " " + rect.height;
    }
    const svgDom = document.getElementById("svg");
    const viewBox = applyTransform(transforms.get(node), localRect.get(node));
    const tla = new TimelineMax({});
    tla.to(svgDom, duration, {
        attr: {
            viewBox: textRect(viewBox)
        }
    });
}

//execute an overlay event (for the moment, these are hide or show)
function runOverlay(overlay: SlideEvent, direction: number, silent: string) : void {
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
    function makeParents(node : SlideEvent, parent : SlideEvent) 
    {
        parentMap.set(node,parent);

        //this is probably due to some old format
        if (node.children == undefined)
            node.children = [];

        for (const child of node.children)
            makeParents(child,node);
    }


    makeParents(manifest.tree, undefined);
    createTreeHTML();
    createTimeline();
    initSoundTimeline();
    //creates the timeline html at the bottom of the screen
    timelineHTML();
}


//stores for each slide event its index relative to its parent, so that it does not need to be recomputed
const cacheIndex: Map<SlideEvent, number> = new Map();

//returns the index of an event inside its parent.
function eventIndex(node: SlideEvent): number {
    if (cacheIndex.get(node) != undefined) {
        return cacheIndex.get(node)
    } else
        try {
            for (let i = 0; i < parentEvent(node).children.length; i++)
                if (parentEvent(node).children[i] == node) {
                    cacheIndex.set(node, i);
                    return i;
                }
        } catch (exception) {
            return null;
        }
}







