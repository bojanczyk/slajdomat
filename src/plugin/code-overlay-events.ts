/* This file contains the code for creating overlay events in a slide. */
export { createOverlayEvent, canBeOverlayTarget }

import { AnimationParams, Database, OverlayEvent } from "../common/types";
import { freshName, freshRect, sanitize } from "../common/helper";
import { allSlides, slideId, state } from "./code";
import { goodName, newEventId, overlayId } from "./code-name-management";
import { loadAnimationParams, saveAnimationParams } from "./code-timeline";


//says if the node is a possible target for a show/hide event
function canBeOverlayTarget(node: SceneNode): boolean {
    if (node.parent != state.currentSlide || node.getPluginData('childLink') != '')
        return false;
    return true;
}

//creates an overlay event in the current slide
function createOverlayEvent(type: 'show' | 'hide' | 'animate'): OverlayEvent[] {

    const retval = [] as OverlayEvent[];
    // we are creating an overlay event

    //we first sort the listed items, in an order that is more convenient for the user
    let sorted: SceneNode[] = [];

    //we look at the set of x values and y values of the selected objects, to determine if this set is more vertical or more horizontal, so that we can determine the sorting order
    const xarray = [] as number[];
    const yarray = [] as number[];

    for (const item of figma.currentPage.selection) {
        if (canBeOverlayTarget(item)) {
            xarray.push(item.x);
            yarray.push(item.y);
            sorted.push(item);
        }
    }
    //dx is the maximal difference between x coordinates, likewise for dy
    const dx = Math.max(...xarray) - Math.min(...xarray);
    const dy = Math.max(...yarray) - Math.min(...yarray);

    //the events are sorted by x or y depending on which of dx, dy is bigger
    const sortIndex = (a: SceneNode) => {
        if (dx > dy)
            return a.x
        else
            return a.y
    };
    //the order of events is so that it progresses in the down-right direction

    sorted = sorted.sort((a, b) => sortIndex(a) - sortIndex(b));


    // for each element in the sorted list of events, we create an overlay event
    for (const item of sorted) {
        let newEvent: OverlayEvent;
        if (item.type === 'GROUP' && item.name.startsWith('Group')) {
            //improve the name
            item.name = goodName(item);
        }

        const id = overlayId(item);


        switch (type) {
            case 'show':
            case 'hide':
                if ('opacity' in item) {
                    if (state.database.originalParams[id] == undefined)
                        state.database.originalParams[id] = { opacity: item.opacity } as AnimationParams;
                    if (state.database.originalParams[id].opacity == undefined) {
                        // this will happen if the object was created with an animate event, and therefore it only had an x/y parameter initially
                        state.database.originalParams[id].opacity = item.opacity;
                    }
                    newEvent =
                    {
                        type: type,
                        id: id,
                        enabled: 'enabled',
                        name: item.name,
                        merged: false,
                        keywords: [],
                        eventId: newEventId()
                    }
                }
                break;

            case 'animate':
                const params = { x: item.x, y: item.y } as AnimationParams;
                if (state.database.originalParams[id] == undefined)
                    state.database.originalParams[id] = {...params};
                if (state.database.originalParams[id].x == undefined)
                    {
                        // this will happen if the object was created with a show/hide event, and therefore it only had an opacity parameter initially
                        state.database.originalParams[id].x = item.x;
                        state.database.originalParams[id].y = item.y;
                    }
                newEvent =
                {
                    type: 'animate',
                    id: id,
                    enabled: 'enabled',
                    name: item.name,
                    merged: false,
                    keywords: [],
                    eventId: newEventId(),
                    params: params
                }
                break;
        }

        retval.push(newEvent);

    }
    return retval;
}
