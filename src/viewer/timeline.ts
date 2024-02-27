export { StateMap, afterEventState, createTimeline, currentState, decodeState, encodeState, futureSlide, gotoIndex, gotoState, moveHead, pageNumber, sameState, slideStartState, statesInPresentation, timeline, changeTimelineMode };

import { findSlide, isOverlay, runOverlay, zoomSlide } from "./event";
import { PresentationNode, Slide, State, StateJSON, Frame, TimelineJSON } from "../common/types";


import { markSeen, openPanelTree, timelineHTML, timelineSeen, updateTimeLineForCurrent } from "./html";
import { addToQueue } from "./loadSVG";
// import { loadSound } from "./sound";
import { endRecording, initSoundTimeline, loadNearbySounds, loadSound, playAudio, soundState, startRecording } from "./sound";
import { manifest } from "./viewer";




function reverseDir(dir: -1 | 1): -1 | 1 {
    if (dir == 1) { return -1 } else { return 1 }
}



let timeline = {
    frames: undefined as Frame[],
    current: undefined as number
}



function afterEventState(node: PresentationNode): State {
    if (node.parent == undefined) {
        console.log('cannot create state after event for root node');
        return slideStartState(node as Slide);
        throw 'cannot create state after event for root node';
        //show the call stack

    }
    else
        return {
            type: 'afterEvent',
            event: node
        }
}

function slideStartState(slide: Slide): State {
    return {
        type: 'start',
        slide: slide
    }
}


// I need my own map because the default map does not work with objects as keys, due to the fact that objects are compared by reference, not by value
class StateMap<T> {
    private keys: State[] = [];
    private values: T[] = [];


    clear() {
        this.keys = [];
        this.values = [];
    }

    set(key: State, value: T) {
        const existingIndex = this.keys.findIndex((k) => sameState(k, key));
        if (existingIndex > -1) {
            this.values[existingIndex] = value;
        } else {
            this.keys.push(key);
            this.values.push(value);
        }
    }

    get(key: State) {
        const index = this.keys.findIndex((k) => sameState(k, key));
        return index > -1 ? this.values[index] : undefined;
    }
}



function sameState(state1: State, state2: State): boolean {
    if (state1 == undefined || state2 == undefined)
        return false;
    if (state1.type != state2.type)
        return false;
    if (state1.type == 'start' && state2.type == 'start')
        return state1.slide == state2.slide;
    else if (state1.type == 'afterEvent' && state2.type == 'afterEvent')
        return state1.event == state2.event;
}


//gets the page number of a given state, which is the number of slides seen up to and including that state 
function pageNumber(state: State): number {

    const seen: Set<Slide> = new Set();
    for (const other of statesInPresentation) {
        if (other.type == 'start')
            seen.add(other.slide);
        if (sameState(state, other))
            return seen.size;

    }
    throw new Error('state not found in presentation');
}


//these are all states in the presentation, whether or not they are marked as merged
let statesInPresentation: State[];



//creates the sequence of events to be played in the presentation, based on a recorded sequence of steps. If we are not given a recorded sequence of steps, then we default to a traversal of the event tree. 
function createTimeline(mode: 'chronicle' | 'tree'): void {
    statesInPresentation = [];
    timeline.frames = [];



    function createTimelineFromEvents(slide: Slide) {
        function timelineItem(state: State) {
            return {
                state: state,
                soundFile: undefined as string,
                soundDuration: undefined as number,
                audio: undefined as HTMLAudioElement,
                previousDuration: undefined as number
            }
        }

        const startState = slideStartState(slide);
        timeline.frames.push(timelineItem(startState));
        statesInPresentation.push(startState);

        for (let i = 0; i < slide.children.length; i++) {
            const child = slide.children[i];
            const nextChild = slide.children[i + 1];

            if (child.type == 'child') {
                createTimelineFromEvents(child);
            }

            const afterEvent = afterEventState(child);
            statesInPresentation.push(afterEvent);
            if ((nextChild == undefined) || !(nextChild.merged)) {
                timeline.frames.push(timelineItem(afterEvent));
            }
        }
    }



    if (mode == 'chronicle') {
        for (const item of manifest.chronicleTimeLine) {
            const state = decodeState(item.state);
            statesInPresentation.push(state);
            timeline.frames.push({
                state: state,
                soundFile: item.soundFile,
                soundDuration: item.soundDuration,
                audio: undefined,
                previousDuration: undefined
            });
        }
        initSoundTimeline('live');

    }
    else {
        createTimelineFromEvents(manifest.tree);
        initSoundTimeline('tree');
    }
}


async function changeTimelineMode(mode: 'tree' | 'chronicle') {

    const url = new URL(window.location.href);
    const searchParams = url.searchParams;

    if (mode == 'chronicle') {
        if (manifest.chronicleTimeLine.length > 0) {
            const firstState = manifest.chronicleTimeLine[0].state;
            await gotoState(decodeState(firstState));
            createTimeline('chronicle');
            timelineHTML();


            // Set the 'step' parameter
            searchParams.set('mode', 'chronicle');

        }
    }
    else {
        const state = currentState();
        createTimeline('tree');
        timelineHTML();
        await gotoState(state);
        searchParams.delete('mode');
    }

    url.search = searchParams.toString();
    window.history.replaceState({}, '', url.toString());

}

//is this a future slide
function futureSlide(event: Slide): boolean {
    if (timeline.current == undefined)
        return true;

    const state = slideStartState(event);
    const index = findStateIndex(state);
    return index > timeline.current;
}


//the slide which contains the state 
function containingSlide(state: State): Slide {
    if (state == undefined)
        return undefined;
    else
        if (state.type == 'start')
            return state.slide;
        else
            return state.event.parent;
}


function currentState(): State {
    if (timeline.current == undefined)
        return undefined;
    else
        return timeline.frames[timeline.current].state;
}

async function moveHead(dir: -1 | 1): Promise<void> {
    if (timeline.current == undefined)
        return;
    if (timeline.current + dir < 0 || timeline.current + dir >= timeline.frames.length)
        return;
    await gotoIndex(timeline.current + dir, 'animated', 0);
}

async function gotoIndex(index: number, mode: 'silent' | 'animated' = 'animated', soundTime: number): Promise<void> {
    const audio = await loadSound(index);

    if (audio != undefined) {
        audio.currentTime = soundTime;
    }


    if (soundState == 'playing') {
        playAudio(timeline.frames[timeline.current].audio, 'pause');
        playAudio(timeline.frames[index].audio, 'play');
    }
    else if (soundState == 'recording') {
        endRecording();
    }


    if (index < 0 || index >= timeline.frames.length)
        throw 'index out of bounds';
    if (index != timeline.current) {
        //the frame has changed, so we need to load the slide

        const sourceState = currentState();
        const targetState = timeline.frames[index].state;
        //we load the slide of the step, plus its ancestors, and their children
        const slidesToLoad: Slide[] = [];
        const targetSlide = containingSlide(targetState);

        let ancestor = targetSlide;
        while (ancestor != undefined) {
            slidesToLoad.push(ancestor);
            for (const cousin of ancestor.children)
                if (cousin.type == 'child')
                    slidesToLoad.push(cousin);
            ancestor = ancestor.parent;
        }

        await addToQueue(slidesToLoad);
        // openPanelTreeRec(targetSlide);


        function runState(state: State, direction: 'forward' | 'backward') {

            if (state.type == 'start') {
                openPanelTree(state.slide, direction == 'forward');
                runOverlay(state.slide, direction, mode);
            }
            if (state.type == 'afterEvent' && state.event.type == 'child')
                openPanelTree(state.event, direction == 'backward');
            if ((state.type == 'afterEvent') && (state.event.type != 'child'))
                runOverlay(state.event, direction, mode);

            markSeen(state, direction);

        }

        let source = timeline.current;
        timeline.current = index;


        for (let i = 0; i < timeline.frames.length; i++)
            timelineSeen(i);

        //we need to run the overlays for all states that are in between the source and target state, in the entire presentation
        if (index > source || source == undefined) {


            //we run the overlays in the forward direction. The source state is not included, but the target state is
            let inRange = false;
            if (source == undefined)
                inRange = true;
            for (const state of statesInPresentation) {
                if (inRange)
                    runState(state, 'forward');
                if (sameState(state, sourceState))
                    inRange = true;
                if (sameState(state, targetState))
                    inRange = false;

            }
        }
        else {
            //we run the overlays in the backward direction. The source state is included, but the target state is not
            let inRange = false;
            for (const state of statesInPresentation.slice().reverse()) {
                if (sameState(state, sourceState))
                    inRange = true;
                if (sameState(state, targetState))
                    inRange = false;

                if (inRange)
                    runState(state, 'backward');


            }
        }



        if ((source == undefined) || (containingSlide(timeline.frames[source].state) != targetSlide))
            zoomSlide(targetSlide, mode);

        loadNearbySounds();
    }

    // resume recording from new state
    if (soundState == 'recording') {
        startRecording();
    }

    updateTimeLineForCurrent();
}

function findStateIndex(state: State): number {
    return timeline.frames.findIndex((s) => sameState(s.state, state));
}
async function gotoState(state: State, mode: 'silent' | 'animated' = 'animated'): Promise<void> {
    const index = findStateIndex(state);
    await gotoIndex(index, mode, 0);
}


//write a state to a string representation that can be saved to disk
function encodeState(state: State): StateJSON {
    if (state.type == 'start') {
        return { type: 'start', slideId: state.slide.id };
    } else {
        return { type: 'afterEvent', slideId: state.event.parent.id, eventId: state.event.id };
    }
}

//read a state from a string representation that has been loaded from disk
function decodeState(state: StateJSON): State {
    try {
        if (state.type == 'start') {
            return slideStartState(findSlide(state.slideId));
        } else {
            const slide = findSlide(state.slideId);
            const event = slide.children.find((e) => e.id == state.eventId);
            return afterEventState(event);
        }
    } catch (e) {
        // this can happen if the slide or event has been deleted, or if the state is otherwise invalid
        return undefined
    }
}


