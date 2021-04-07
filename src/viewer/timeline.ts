export { createTimeline, moveHead, timeline, Step, OverlayStep, ZoomStep, zoomsIn, currentStep, gotoEvent, gotoStep, futureSlide, numberOfPages, allSteps }

import { isOverlay, parentEvent, runOverlay, zoomSlide, } from "./event";
import { OverlayEvent, SlideEvent, ZoomEvent } from "./types";

import { markSeen, openPanelTree, openPanelTreeRec, soundIcon, timelineSeen } from "./html";
import { manifest, updatePageNumber } from "./viewer";
import { loadSound } from "./sound";
import { addToQueue } from "./loadSVG";



let numberOfPages = 0;

//the presentation is a sequence of timeline events. Each such event is either a zoom transition from a source slide to a target slide, or an overlay
class Step {
    // subtype: StepSubtype,
    pageNumber: number
}

class OverlayStep extends Step {
    overlays: OverlayEvent[]
}

class ZoomStep extends Step {
    source: ZoomEvent;
    target: ZoomEvent
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

//the step that is about to be executed, i.e. the offset-th in the future
function currentStep(offset = 0): Step {
    if (timeline.future.length > offset)
        return timeline.future[timeline.future.length - 1 - offset]
    else if (timeline.future.length == offset)
        return timeline.lastStep
    else throw 'tried to access step that does not exist'
}





//creates the sequence of events to be played in the presentation, by doing a traversal of the event tree. The logic is complicated a bit by the presence of merges.
function createTimeline(): void {



    //should be called only for child events, not overlays
    function createTimelineRec(event: ZoomEvent) {
        //add a step to the timeline

        type AddStep = { type: 'zoom', source: ZoomEvent, target: ZoomEvent } | { type: 'overlay', overlays: OverlayEvent[] }
        function addStep(subtype: AddStep) {
            let step: Step;

            if (subtype.type == 'zoom') {
                const retval = new ZoomStep;
                retval.source = subtype.source;
                retval.target = subtype.target;
                step = retval;

            }
            if (subtype.type == 'overlay') {
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

            if (child.merged) {
                const currentBlock = mergedBlocks.pop();
                currentBlock.push(child);
                mergedBlocks.push(currentBlock);
            }
            else {
                mergedBlocks.push([child]);

            }
        }


        //we create the timeline events for the blocks
        for (const block of mergedBlocks) {

            //all events in a block should have same overlay/non-overlay type, hence it is enough to test the first one
            if (isOverlay(block[0])) {
                //a block of overlay events
                addStep({ type: 'overlay', overlays: block as OverlayEvent[] });
            }
            else {
                //a block of zoom events, so we can type it better
                const zoomBlock = block as ZoomEvent[];

                //we first zoom from the current to the first in the block
                addStep({ type: 'zoom', source: event, target: zoomBlock[0] });

                //next, we recursively call for all children, and between each of them we do a direct zoom from i-1 to i
                createTimelineRec(zoomBlock[0]);
                for (let i = 1; i < zoomBlock.length; i++) {
                    addStep({ type: 'zoom', source: zoomBlock[i - 1], target: zoomBlock[i] });
                    createTimelineRec(zoomBlock[i]);
                }
                //finally, we zoom out from the last event in the block to the current
                addStep({ type: 'zoom', source: zoomBlock[zoomBlock.length - 1], target: event });
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

    if (event == manifest.tree)
        return timeline.lastStep;

    const allSteps = timeline.past.concat(timeline.future);

    if (event.type == 'child')
        for (const step of allSteps)
            if (step instanceof ZoomStep) {
                if (step.target == event)
                    return step;
            }

    if (event.type == 'show' || event.type == 'hide')
        for (const step of allSteps) {
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
        zoomSlide(target);

        //we open or close the suitable subtree in the left panel, 
        if (parentEvent(target) != undefined)
            openPanelTree(target, true);
        if (source != parentEvent(target))
            openPanelTree(source, false);

    }

    loadNearbySounds();
    soundIcon();
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
async function gotoStep(targetStep: Step, mode: 'immediate' = undefined): Promise<void> {
    let slide: SlideEvent;
    if (targetStep instanceof OverlayStep) { slide = targetStep.overlays[0]; }
    else if (targetStep instanceof ZoomStep) { slide = targetStep.target; }
    else if (targetStep == timeline.lastStep) { slide = manifest.tree }
    else
        throw 'Wanted to go to a step that does not exist'



    //we load the slide of the step, plus its ancestors, and their children
    const slidesToLoad: ZoomEvent[] = [];
    let ancestor : ZoomEvent;
    if (slide.type == 'child')
        ancestor = slide;
    else
        ancestor = parentEvent(slide);
    while (ancestor != undefined) {
        slidesToLoad.push(ancestor);
        for (const cousin of ancestor.children)
            if (cousin.type == 'child')
                slidesToLoad.push(cousin);
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
    if (timeline.lastStep != undefined)
        timelineSeen(timeline.lastStep, false);

    let zoom = slide;
    if (slide.type != 'child')
        zoom = parentEvent(slide);

    if (mode == 'immediate')
        zoomSlide(zoom, 'immediate')
    else
        zoomSlide(zoom);

    loadNearbySounds();
    soundIcon();
    updatePageNumber();
}

//goes to the first step after the event becomes visible
function gotoEvent(event: SlideEvent): void {
    const step = eventToStep(event);
    if (event.type == 'show')
        gotoStep(step).then(() => moveHead(1));
    else
        gotoStep(step);
}






function loadNearbySounds() {
    loadSound(currentStep());
    //load sound for previous step, which could be useful when moving to the left on the timelines
    if (timeline.past.length > 0)
        loadSound(timeline.past[timeline.past.length - 1]);

    //load sound for the next step, which might be the special last step
    if (timeline.future.length > 1)
        loadSound(timeline.future[timeline.future.length - 2]);
    if (timeline.future.length == 1)
        loadSound(timeline.lastStep);
}

function allSteps(): Step[] {
    const retval = timeline.past.slice().concat(timeline.future.slice().reverse());

    //if there is at least one sound, then there is also an item for the last event, which is only for its sound
    if (Object.keys(manifest.soundDict).length > 0) {
        retval.push(timeline.lastStep);
    }
    return retval;
}
