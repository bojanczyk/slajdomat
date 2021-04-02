export { createTimeline, moveHead, timeline, Step, OverlayStep, ZoomStep, zoomsIn, currentStep, gotoEvent, gotoStep, futureSlide, getStepFromURL, stepInURL, numberOfPages, stepSoundIndex , allSteps}

import { isOverlay, parentEvent, runOverlay, zoomSlide, } from "./event";
import { SlideEvent} from "./types";

import { markSeen, openPanelTree, openPanelTreeRec } from "./html";
import { manifest, updatePageNumber } from "./viewer";
import { loadSound, soundIcon} from "./sound";
import { addToQueue } from "./loadSVG";



let numberOfPages = 0;

//the index of the event corresponding to a step, relative to its parent event. This is used to compute the sound files
const stepSoundIndex: Map<Step, number> = new Map();

//the presentation is a sequence of timeline events. Each such event is either a zoom transition from a source slide to a target slide, or an overlay
class Step {
    // subtype: StepSubtype,
    pageNumber: number
}

class OverlayStep extends Step {
    overlays: SlideEvent[]
}

class ZoomStep extends Step {
    source: SlideEvent;
    target: SlideEvent
}



// type StepSubtype = { type: 'overlay', overlays: SlideEvent[] } | { type: 'zoom', source: SlideEvent, target: SlideEvent } | { type: 'finish' }


type Timeline = {
    past: Step[],
    future: Step[],
    lastStep?: Step //sound played after last step
}

const timeline: Timeline = {
    past: [] as Step[],
    future: [] as Step[]
}

//the step that is about to be executed, i.e. the first step in the future
function currentStep(): Step {
    if (timeline.future.length > 0)
        return timeline.future[timeline.future.length - 1]
    else 
        return timeline.lastStep;
}


/*
//returns the step after the current one
function afterCurrent() {
    if (timeline.future.length >1)
        return timeline.future[timeline.future.length - 2];
    if (timeline.future.length == 1)
        return timeline.lastProgress;
    return undefined;
}
*/



//creates the sequence of events to be played in the presentation, by doing a traversal of the event tree. The logic is complicated a bit by the presence of merges.
function createTimeline(): void {



    //should be called only for child events, not overlays
    function createTimelineRec(event: SlideEvent) {
        //add a step to the timeline

        type AddStep = { type: 'zoom', source: SlideEvent, target: SlideEvent } | { type: 'overlay', overlays: SlideEvent[] }
        function addStep(subtype: AddStep) {
            let step: Step;

            if (subtype.type == 'zoom') {
                const retval = new ZoomStep;
                retval.source = subtype.source;
                retval.target = subtype.target;
                step = retval;

            }
            if (subtype.type == 'overlay')
            {
                const retval = new OverlayStep;
                retval.overlays = subtype.overlays;
                step = retval;
            }
            step.pageNumber = numberOfPages;
            timeline.past.push(step);
        }

        numberOfPages++;

        //we group the child events into blocks according to the merged bit
        const mergedBlocks = [] as SlideEvent[][];
        for (const child of event.children) {
            if (child.type != 'finish') {
                if (child.merged) {
                    const currentBlock = mergedBlocks.pop();
                    currentBlock.push(child);
                    mergedBlocks.push(currentBlock);
                }
                else {
                    mergedBlocks.push([child]);
                }
            }
        }


        //we create the timeline events for the blocks
        for (const block of mergedBlocks) {

            //all events in a block should have same overlay/non-overlay type, hence it is enough to test the first one
            if (isOverlay(block[0])) {
                //a block of overlay events
                addStep({ type: 'overlay', overlays: block });
            }
            else {
                //a block of zoom events

                //we first zoom from the current to the first in the block
                addStep({ type: 'zoom', source: event, target: block[0] });

                //next, we recursively call for all children, and between each of them we do a direct zoom from i-1 to i
                createTimelineRec(block[0]);
                for (let i = 1; i < block.length; i++) {
                    addStep({ type: 'zoom', source: block[i - 1], target: block[i] });
                    createTimelineRec(block[i]);
                }
                //finally, we zoom out from the last event in the block to the current
                addStep({ type: 'zoom', source: block[block.length - 1], target: event });
            }
        }
    }


    createTimelineRec(manifest.tree);

    //it was more convenient to create the past of the timeline, because we could append by doing push(). However, the timeline should begin with all steps in the future.
    resetTimeline();

}

//is this a future slide
function futureSlide(event: SlideEvent): boolean {
    const step = eventToStep(event);
    return timeline.future.includes(step);
}


//the  first step where this event is used
function eventToStep(event: SlideEvent): Step {

    const allSteps = timeline.past.concat(timeline.future);
    for (const step of allSteps) {
        if (step instanceof ZoomStep) {
            if (step.target == event)
                return step;
        }
        if (step instanceof OverlayStep) {
            if (step.overlays.includes(event))
                return step;
        }
    }
    throw 'Could not find step'
}

//says if the step is an overlay that is zooming in
function zoomsIn(step: Step): boolean {
    if (step instanceof ZoomStep) {
        return step.source == parentEvent(step.target);
    }
    else
        return false;
}

//perform an overlay event
function doOverlayStep(step: Step, direction: -1 | 1, silent: 'silent' | 'animated' = 'silent'): void {
    if (step instanceof OverlayStep)
        for (const overlay of step.overlays) {
            runOverlay(overlay, direction, silent);
        }
}



//move to the next or previous event in the timeline
function moveHead(direction: -1 | 1): void {
    let source, target: Step[];

    


    //depending on the direction, we will shift an event from future to past or in the other direction
    if (direction == 1) {
        source = timeline.future;
        target = timeline.past;
    }
    else {
        source = timeline.past;
        target = timeline.future;
    }

    if (source.length == 0) {
        console.log('cannot fall off the tape')
        return;
    }

    //move the step from the source to target
    const step = source.pop();
    target.push(step);

    markSeen(step, direction);

    //execute the step
    if (step instanceof OverlayStep) {
        // this is an overlay step
        doOverlayStep(step, direction)
    }
    else if (step instanceof ZoomStep) {
        // this is a zoom step

        let source, target: SlideEvent;
        if (direction == 1) {
            source = step.source;
            target = step.target;
        }
        else {
            target = step.source;
            source = step.target;
        }

        addToQueue(target.children);
        zoomSlide(target, 1.5);

        //we open or close the suitable subtree in the left panel, 
        if (parentEvent(target) != undefined)
            openPanelTree(target, true);
        if (source != parentEvent(target))
            openPanelTree(source, false);

    }
    
    loadNearbySounds();
    updatePageNumber();
}


//moves all the timeline to the future, i.e. we go to the first step
function resetTimeline() {
    while (timeline.past.length > 0) {
        const step = timeline.past.pop();
        timeline.future.push(step);
    }
}


//goes to a given step, after loading enough svg files to make this possible
async function gotoStep(targetStep: Step): Promise<void> {
    let slide: SlideEvent;
    if (targetStep instanceof OverlayStep) { slide = targetStep.overlays[0]; }
    else if (targetStep instanceof ZoomStep) { slide = targetStep.target; }
    else {
        if (targetStep instanceof OverlayStep)
            console.log('strange');
        console.log(targetStep);
        throw 'Can only go to overlays or zoom step'
    }


    //we load the slide of the step, plus its ancestors, and their children
    let slidesToLoad: SlideEvent[] = [];
    let ancestor = slide;
    while (ancestor != undefined) {
        slidesToLoad.push(ancestor);
        slidesToLoad = slidesToLoad.concat(ancestor.children);
        ancestor = parentEvent(ancestor);
    }

    await addToQueue(slidesToLoad);
    openPanelTreeRec(slide);
    resetTimeline();
    //the events before the step need to be executed and marked as seen
    while (currentStep() != targetStep) {
        const step = timeline.future.pop();
        doOverlayStep(step, 1, 'silent');
        markSeen(step, 1);
        timeline.past.push(step);
    }
    //the opposite needs to be done for the remaining events
    for (const step_3 of timeline.future) {
        markSeen(step_3, -1);
        doOverlayStep(step_3, -1, 'silent');
    }
    let zoom = slide;
    if (slide.type != 'child')
        zoom = parentEvent(slide);
    zoomSlide(zoom);
    loadNearbySounds();
    soundIcon();

}

//goes to the first step after the event becomes visible
function gotoEvent(event: SlideEvent): void {
    const step = eventToStep(event);
    if (event.type == 'show')
        gotoStep(step).then(() => moveHead(1));
    else
        gotoStep(step);
}


//the path is an array of numbers, which indicates the path in the event tree to the current event 
function getStepFromURL(): Step {
    return currentStep();
    /*
    const path = [];
    try {
        const pathString = (new URL(window.location.href)).searchParams.get('path').split('/');
        while (pathString.length > 0) {
            const index = pathString.pop();
            if (index != '')
                path.push(parseInt(index));
        }
        return path;

    } catch (e) {
        return [0]; // default path is the first event of the root
    }*/
}


function stepInURL(): void //puts the current path into the url
{
    /*
    const path = getPath(event);
    let string = '';
    while (path.length > 0) {
        string += path.pop() + '/';
    }
    if (string == '0/')
    //the argument 0/ is default, so it need not be used
        history.pushState({}, null);
    else 
        history.pushState({}, null, '?path=' + string);
        */
}

function loadNearbySounds() {
    loadSound(currentStep());
    //load sound for previous step, which could be useful when moving to the left on the timelines
    if (timeline.past.length > 0)
        loadSound(timeline.past[timeline.past.length -1]);

    //load sound for the next step, which might be the special last step
    if (timeline.future.length > 1)
        loadSound(timeline.future[timeline.future.length - 2]);
    if (timeline.future.length == 1)
        loadSound(timeline.lastStep);
}

function allSteps() : Step[] {
    const retval = timeline.past.slice().concat(timeline.future.slice().reverse());

      //if there is at least one sound, then there is also an item for the last event, which is only for its sound
      if (Object.keys(manifest.soundDict).length > 0) {
        retval.push(timeline.lastStep);        
    }
    return retval;
}
