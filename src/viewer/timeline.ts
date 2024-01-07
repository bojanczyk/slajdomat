export { OverlayStep, Step, ZoomStep, allSteps, createTimeline, currentStep, futureSlide, gotoEvent, gotoStep, loadNearbySounds, moveHead, timeline, zoomsIn, eventToStep };

import { findZoomEvent, isOverlay, runOverlay, zoomSlide, } from "./event";
import { LiveRecording, OverlayEvent, SlideEvent, StepDescription, ZoomEvent } from "./types";


import { markSeen, openPanelTree, openPanelTreeRec, soundIcon, timelineSeen } from "./html";
import { addToQueue } from "./loadSVG";
import { endRecording, loadSound } from "./sound";
import { manifest, updatePageNumber } from "./viewer";






//the presentation is a sequence of timeline events. Each such event is either a zoom transition from a source slide to a target slide, or an overlay
class Step {
    // subtype: StepSubtype,
    constructor() {
        //
    }
    event(): SlideEvent { return manifest.tree }
    description(): StepDescription { return { type: 'last', page: this.pageNumber } }
    reverse(): Step { return new Step() }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    run(mode: 'silent' | 'animated'): void {
        //
    }
    pageNumber: number
}

function reverseDir(dir: -1 | 1): -1 | 1 {
    if (dir == 1) { return -1 } else { return 1 }
}

class OverlayStep extends Step {
    overlays: OverlayEvent[];
    direction: -1 | 1;
    constructor(overlays: OverlayEvent[], direction: -1 | 1) {
        super();
        this.direction = direction;
        this.overlays = overlays;
    }
    event(): OverlayEvent { return this.overlays[0]; }
    description(): StepDescription {
        return { type: 'overlays', page: this.pageNumber, slide: this.overlays[0].parent.id, direction: this.direction, overlays: this.overlays.map((o => o.eventId)) }
    }
    reverse(): Step {
        return new OverlayStep(this.overlays, reverseDir(this.direction));
    }
    run(mode: 'silent' | 'animated'): void {
        //perform an overlay event
        for (const overlay of this.overlays) {
            runOverlay(overlay, this.direction, mode);
        }
    }
}


class ZoomStep extends Step {
    source: ZoomEvent;
    target: ZoomEvent;
    constructor(source: ZoomEvent, target: ZoomEvent) {
        super();
        this.source = source;
        this.target = target;
    }
    reverse(): Step {
        return new ZoomStep(this.target, this.source)
    }
    event(): SlideEvent {
        return this.source;
    }
    description(): StepDescription {
        return { type: 'zoom', page: this.pageNumber, source: this.source.id, target: this.target.id }
    }
    run(mode: 'silent' | 'animated'): void {
        addToQueue(this.target.children);
        zoomSlide(this.target, mode);

        //we open or close the suitable subtree in the left panel, 
        if (this.target.parent != undefined)
            openPanelTree(this.target, true);
        if (this.source != this.target.parent)
            openPanelTree(this.source, false);
    }
}





interface Timeline {
    type: 'recorded' | 'default',
    past: Step[],
    future: Step[],
    lastStep: Step //sound played after last step
}

const timeline: Timeline = {
    type: undefined,
    past: [] as Step[],
    future: [] as Step[],
    lastStep: new Step()
}

//the step that is about to be executed, i.e. the offset-th in the future
function currentStep(offset = 0): Step {
    if (timeline.future.length > offset)
        return timeline.future[timeline.future.length - 1 - offset]
    else if (timeline.future.length == offset)
        return timeline.lastStep
    else throw 'tried to access step that does not exist'
}





//creates the sequence of events to be played in the presentation, based on a recorded sequence of steps. If we are not given a recorded sequence of steps, then we default to a traversal of the event tree. 
function createTimeline(recorded: LiveRecording): void {




    //creates the timeline based on the recorded sequence of steps
    function createTimelineFromRecording() {
        timeline.type = 'recorded';
        for (const description of recorded.steps) {
            let step: Step;
            switch (description.step.type) {
                case 'zoom':
                    step = new ZoomStep(findZoomEvent(description.step.source), findZoomEvent(description.step.target));
                    break;
                case 'overlays':
                    {
                        const overlays: OverlayEvent[] = [];
                        const event = findZoomEvent(description.step.slide);
                        for (const overlay of description.step.overlays) {
                            for (const child of event.children)
                                if (child.type != 'child' && child.eventId == overlay)
                                    overlays.push(child);
                        }
                        step = new OverlayStep(overlays, description.step.direction);
                        break;
                    }
                case 'last':
                    step = new Step();
            }
            step.pageNumber = description.step.page;
            timeline.past.push(step);
        }
        timeline.lastStep = timeline.past.pop();
    }

    //creates a timeline using a traversal of the event tree. The logic is complicated a bit by the presence of merges.
    function createTimelineFromEvents(event: ZoomEvent) {

        timeline.type = 'default';
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
                timeline.past.push(new OverlayStep(block as OverlayEvent[], 1));
            }
            else {
                //a block of zoom events, so we can type it better
                const zoomBlock = block as ZoomEvent[];

                //we first zoom from the current to the first in the block
                timeline.past.push(new ZoomStep(event, zoomBlock[0]));

                //next, we recursively call for all children, and between each of them we do a direct zoom from i-1 to i
                createTimelineFromEvents(zoomBlock[0]);
                for (let i = 1; i < zoomBlock.length; i++) {
                    timeline.past.push(new ZoomStep(zoomBlock[i - 1], zoomBlock[i]));
                    createTimelineFromEvents(zoomBlock[i]);
                }
                //finally, we zoom out from the last event in the block to the current
                timeline.past.push(new ZoomStep(zoomBlock[zoomBlock.length - 1], event));

            }
        }
    }


    if (recorded == undefined) {
        createTimelineFromEvents(manifest.tree);
    }
    else
        createTimelineFromRecording()

    //it was more convenient to create the past of the timeline, because we could append by doing push(). However, the timeline should begin with all steps in the future.
    resetTimeline();

    if (recorded == undefined) {
        //if we had a live recording, then the page numbers have been loaded from the file. Otherwise, we need to  compute the page numbers. The page number is 1 + the number of distinct targets of preceding zoom events, not counting zooms back to the root

        const seen: Set<ZoomEvent> = new Set();
        let pageCount = 1;
        for (const step of allSteps()) {
            step.pageNumber = pageCount;
            if (step instanceof ZoomStep && !seen.has(step.target) && (step.target.parent != null)) {
                pageCount++;
                seen.add(step.target);
            }
        }
        timeline.lastStep.pageNumber = pageCount;
    }
}

//is this a future slide
function futureSlide(event: SlideEvent): boolean {
    const step = eventToStep(event, 'first');
    return timeline.future.includes(step);
}



function allSteps(): Step[] {
    const retval = timeline.past.slice().concat(timeline.future.slice().reverse());

    //if there is at least one sound, then there is also an item for the last event, which is only for its sound
    if (Object.keys(manifest.soundDict).length > 0) {
        retval.push(timeline.lastStep);
    }
    return retval;
}



//the  first step where this event is used
function eventToStep(event: SlideEvent, type: 'first' | 'last'): Step {

    if (event == manifest.tree)
        return timeline.lastStep;

    const steps = allSteps();

    if (type == 'first') {
        // for type first, we use the first time where the event is used
        if (event.type == 'child')
            for (const step of steps)
                if (step instanceof ZoomStep) {
                    if (step.target == event)
                        return step;
                }

        if (event.type == 'show' || event.type == 'hide')
            for (const step of steps) {
                if (step instanceof OverlayStep) {
                    if (step.overlays.includes(event))
                        return step;
                }
            }
    }
    else 
    {
        //for type last, we only 
        if (event.type != 'child')
            throw 'eventToStep can only be called for slides, not for events';

        let retval : Step = timeline.lastStep;
        for (const step of steps) {
            if (step.event().parent == event)
                retval = step;
        }

        return retval;
    }

    return undefined;
}

//says if the step is an overlay that is zooming in
function zoomsIn(step: Step): boolean {
    if (step instanceof ZoomStep) {
        return step.source == step.target.parent;
    }
    else
        return false;
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

    //if there is a recording going on, it should be stopped
    endRecording(direction);

    //move the step from the source to target
    let step = source.pop();
    target.push(step);

    markSeen(step, direction);

    if (direction == -1)
        step = step.reverse();

    step.run('animated');

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


//goes to a given step (i.e. before the step is executed), after loading enough svg files to make this possible
async function gotoStep(targetStep: Step, mode: 'silent' | 'animated' = 'animated'): Promise<void> {
    let slide: SlideEvent;
    if (targetStep instanceof OverlayStep) { slide = targetStep.overlays[0]; }
    else if (targetStep instanceof ZoomStep) { slide = targetStep.source; }
    else if (targetStep == timeline.lastStep) { slide = manifest.tree }
    else
        throw 'Wanted to go to a step that does not exist'



    //we load the slide of the step, plus its ancestors, and their children
    const slidesToLoad: ZoomEvent[] = [];
    let ancestor: ZoomEvent;
    if (slide.type == 'child')
        ancestor = slide;
    else
        ancestor = slide.parent;
    while (ancestor != undefined) {
        slidesToLoad.push(ancestor);
        for (const cousin of ancestor.children)
            if (cousin.type == 'child')
                slidesToLoad.push(cousin);
        ancestor = ancestor.parent;
    }

    await addToQueue(slidesToLoad);
    openPanelTreeRec(slide);
    resetTimeline();
    //the events before the step need to be executed and marked as seen
    while (currentStep() != targetStep) {
        const step = timeline.future.pop();
        if (step instanceof OverlayStep)
            step.run('silent');
        markSeen(step, 1);
        timeline.past.push(step);
    }
    //the opposite needs to be done for the remaining events
    for (const futureStep of timeline.future) {
        markSeen(futureStep, -1);
        if (futureStep instanceof OverlayStep)
            futureStep.reverse().run('silent');
    }
    if (timeline.lastStep != undefined)
        timelineSeen(timeline.lastStep, false);

    let zoom = slide;
    if (slide.type != 'child')
        zoom = slide.parent;

    if (mode == 'silent')
        zoomSlide(zoom, 'silent')
    else
        zoomSlide(zoom);

    loadNearbySounds();
    soundIcon();
    updatePageNumber();
}



//goes to the first step after the event becomes visible
function gotoEvent(event: SlideEvent): void {
    const step = eventToStep(event, 'first');
    if (step != undefined)
        //goto step goes to before the event, so we need to go one further
        gotoStep(step).then(() => moveHead(1));
    else
        console.log('this event has no associated step', event)
}






function loadNearbySounds(): void {
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
