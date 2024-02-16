/* This is code for the plugin backend that manages the timeline of the presentation. It takes care of updating the opacity and xy values of figma elements as the user clicks on the timeline in the plugin.
*/

export { saveAnimationParams, loadAnimationParams }
import { stat } from "original-fs";
import { currentParams, modifyingEvents } from "../common/animate-params";
import { AnimateEvent, AnimationParams, OverlayEvent, PresentationNode, ShowHideEvent } from "../common/types";
import { saveCurrentData, state } from "./code";
import { overlayId } from "./code-name-management";




// the x and y values go to the animate events, and the opacity goes to original parameters
function saveAnimationParams(): void {

    const haveEvents = idsThatHaveEvents();

    // remove the unused keys from the originalParams dictionary
    for (const key of Object.keys(state.database.originalParams)) {
        if (!haveEvents.has(key))
            delete state.database.originalParams[key];
    }

    for (const node of state.currentSlide.children) {
        const id = overlayId(node);
        if (haveEvents.has(id))  {
            // the id has events
            // we need to find the appropriate place to store the animation parameters, which may be an event, or otherwise the originalParams dictionary
            const modifying = modifyingEvents(id, state.database.selected, state.database.events);

            if (modifying.xy != 'not modified' || modifying.opacity != 'not modified') {
                if (state.database.originalParams[id] == undefined)
                    state.database.originalParams[id] = {} as AnimationParams;
            }

            switch (modifying.xy) {
                case 'original':
                    state.database.originalParams[id].x = node.x;
                    state.database.originalParams[id].y = node.y;
                    break;
                case 'not modified':
                    break;
                default:
                    modifying.xy.params.x = node.x;
                    modifying.xy.params.y = node.y;
            }

            // the opacity is saved to the original parameters if it is modified, and the last show/hide event is not hide
            if ('opacity' in node) {
                switch (modifying.opacity) {
                    case 'not modified':
                    case 'before first show':
                        break;
                    default:
                        if (modifying.opacity == 'before first hide' || modifying.opacity.type == 'show') {
                            state.database.originalParams[id].opacity = node.opacity;
                        }
                }
            }
        }
    }
}



function idsThatHaveEvents(): Set<string> {
    const idsThatHaveEvents = new Set<string>();
    for (const event of state.database.events) {
        if (event.type != 'child')
            idsThatHaveEvents.add(event.id);
    }
    return idsThatHaveEvents;
}

// the opposite of the previous function
function loadAnimationParams(): void {

    // a little optimization, not sure if necessary: we will only look at ids of objects that have some overlay associated to them
    const haveEvents = idsThatHaveEvents();

    for (const id of haveEvents) {
        for (const node of state.currentSlide.children) {
            if (overlayId(node) == id) {
                // the last argument is 0.1, since we want hidden events to be a bit visible
                const params = currentParams(id, state.database.selected, state.database.events, state.database.originalParams, 0.1);
                if ('x' in params) {
                    node.x = params.x;
                    node.y = params.y;
                }
                if (params.opacity != undefined && 'opacity' in node) {
                    node.opacity = params.opacity;
                }
            }
        }
    }
}

