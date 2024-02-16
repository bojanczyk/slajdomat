export {ModifyingEvents, modifyingEvents, currentParams} 

import { AnimateEvent, AnimationParams, PresentationNode, ShowHideEvent } from "./types";

type ModifyingEvents =
    {
        xy: AnimateEvent | 'original' | 'not modified',
        opacity: ShowHideEvent | 'before first show' | 'before first hide' | 'not modified'
    }



// returns the events that modify the given id, and occur < the given index
// the xy property is modified by animate events, while the opacity property is modified by show/hide events. Evenentually, animate events will also modify the opacity, but this is not implemented yet.
function modifyingEvents(id: string, index: number, events: PresentationNode[]): ModifyingEvents {
    const retval = {
        xy: 'not modified',
        opacity: 'not modified'
    } as ModifyingEvents;

    for (let i = 0; i < events.length; i++) {
        const event = events[i];
        if (event.type == 'animate' && event.id == id) {
            if (i < index)
                retval.xy = event;
            else if (retval.xy == 'not modified')
                retval.xy = 'original';
        }
        if ((event.type == 'show' || event.type == 'hide') && event.id == id) {
            if (i < index)
                retval.opacity = event;
            else if (retval.opacity == 'not modified')
                if (event.type == 'show')
                    retval.opacity = 'before first show';
                else
                    retval.opacity = 'before first hide';
        }
    }
    return retval;
}


// returns the animation parameters, i.e. opacity and xy, for the svg with id id, after executing all overlays with position < index
// if the event is hidden, then the hiddenOpacity is used
// we pass the list of events and the original parameters
function currentParams(id: string, index: number, events: PresentationNode[],
    originalParams: { [id: string]: AnimationParams },
    hiddenOpacity: number): AnimationParams {
    const retval = {} as AnimationParams;

    const modifying = modifyingEvents(id, index, events);


    switch (modifying.xy) {
        case 'not modified':
            break;
        case 'original':
            retval.x = originalParams[id].x;
            retval.y = originalParams[id].y;
            break;
        default:
            retval.x = modifying.xy.params.x;
            retval.y = modifying.xy.params.y;
    }


    let mode: 'visible' | 'hidden';

    switch (modifying.opacity) {
        case 'not modified':
            break;
        case 'before first show':
            mode = 'hidden';
            break;
        case 'before first hide':
            mode = 'visible';
            break;
        default:
            if (modifying.opacity.type == 'show')
                mode = 'visible';
            else
                mode = 'hidden';
    }


    if (mode == 'hidden') {
        retval.opacity = hiddenOpacity;
    }
    if (mode == 'visible') {
        if (originalParams[id] != undefined && originalParams[id].opacity != undefined)
            retval.opacity = originalParams[id].opacity;
        else
            retval.opacity = 1;
    }
    return retval;
}