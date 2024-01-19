export {
    createEventTree, findSlide, isOverlay,
    runOverlay, zoomSlide
};

import {
    PresentationNode, Slide
} from './types';


import {
    manifest
} from './viewer';

import {
    applyTransform,
    Rect,
} from './transform';

import {
    gsap,
    TimelineMax
} from "gsap";

import { localRect, svgMap, transforms } from './loadSVG';








function isOverlay(event: PresentationNode): boolean {
    return (event.type == 'show' || event.type == 'hide');
}



//do an animated zoom to the slide on the top of the stack
function zoomSlide(node: PresentationNode, mode: 'silent' | 'animated' = 'animated'): void {

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
function runOverlay(overlay: PresentationNode, direction: 'forward' | 'backward', silent: string): void {

    function animate(svg : SVGElement, opacity : number) {
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

    let opacity;
    switch (overlay.type) {
        case 'show':
        case 'hide':
            if ((overlay.type == "show" && direction == 'forward') || (overlay.type == "hide" && direction == 'backward'))
                opacity = 1;

            else
                opacity = 0;

            animate(svgMap.get(overlay),opacity);

            break;
        case 'child':
            if (direction == 'forward') 
                opacity = 1;
            else    
                opacity = 0;

            animate(svgMap.get(overlay),opacity);
            break;
    }


}


//creates the tree of slides and events, without adding the svg objects yet
function createEventTree(): void {

    function makeParents(node: PresentationNode, parent: Slide) {
        node.parent = parent;
        if (node.type == 'child') {
            for (const child of node.children)
                makeParents(child, node);
        }
    }

    makeParents(manifest.tree, undefined);




}


//finds a slide based on its id
function findSlide(id: string): Slide {
    function rec(event: Slide): Slide {
        if (event.id == id)
            return event;
        for (const child of event.children)
            if (child.type == 'child') {
                const retval = rec(child);
                if (retval != undefined)
                    return retval;
            }
        return undefined;
    }
    return rec(manifest.tree);
}






