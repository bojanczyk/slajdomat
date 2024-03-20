export {
    createEventTree, findSlide, isOverlay,
    runOverlay, zoomSlide
};

import { AnimationParams, PresentationNode, Slide } from '../common/types';
import { gsap } from "gsap";
import { afterParams, beforeParams, localRect, svgMap, transforms } from './loadSVG';
import { applyTransform, Rect, } from './transform';
import { manifest } from './viewer';






function isOverlay(event: PresentationNode): boolean {
    return (event.type == 'show' || event.type == 'hide' || event.type == 'animate');
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

        // use gsap to animate a change in the viewBox
        gsap.to(svgDom, {
            duration: 1.5,
            attr: {
                viewBox: textRect(viewBox)
            }
        });
    }
}

const startedAnimations = new Map<SVGElement, AnimationParams>;

//execute an overlay event (for the moment, these are hide or show)
function runOverlay(overlay: PresentationNode, direction: 'forward' | 'backward', silent: 'silent' | 'animated'): void {


    let animationParams: AnimationParams;
    let duration: number;

    const svg = svgMap.get(overlay);
    if (svg == undefined)
        return;

    switch (overlay.type) {
        case 'show':
        case 'hide':
        case 'animate':
            if (direction == 'forward')
                animationParams = afterParams.get(overlay);
            else
                animationParams = beforeParams.get(overlay);
            duration = 1;
            break;

        case 'child':
            duration = 0.3;
            if (direction == 'forward')
                animationParams = { opacity: 1 };
            else
                animationParams = { opacity: 0 };
            break;
    }

    if (silent == 'silent') 
        duration = 0;

    

    function complete() {
        startedAnimations.delete(svg);
        // counter the number of started animations
        // console.log('uncompleted animations: ' + startedAnimations.size);
    }

    startedAnimations.set(svg, animationParams);
    let target = { ...{ duration: duration }, ...animationParams, onComplete : complete };
    gsap.to(svg, target);


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






