export {
    initPanels, markDisabled, markSeen, openPanelTree,
    openPanelTreeRec, progressCache,
    removeLoading, timelineHTML, timelineRecording, timelineSeen, updateTimeCounter, updateTimeLineForCurrent, userAlert, timelineFailedLoad
};

import { gsap } from "gsap";
import { Slide, State } from '../common/types';
import { initPdf } from './client-print';
import { initComments } from './comments';
import { formatTime, initPresenterTools } from './presenter-tools';
import { initSearch } from './search';
import { currentTool, toggleSketchpad } from './sketchpad';
import { canPlaySound, initSoundHTML, loadSound } from './sound';
import { StateMap, afterEventState, currentState, gotoIndex, gotoState, pageNumber, slideStartState, timeline } from './timeline';
import { manifest, nextButton, playButton, prevButton } from './viewer';



//these dictionaries store, for each slide event, the corresponding div and subtreeDiv in the tree panel. The div is the name of the event, while the subtreeDiv is defined only for child events, and it is the subtree.
const treeViewCache: StateMap<HTMLDivElement> = new StateMap();
const subtreeDivCache: Map<Slide, HTMLDivElement> = new Map();
//this is a link to the progress item in the progress bar at the bottom
let progressCache: HTMLDivElement[];;




//create the tree list of the slides and event that is in the unfolding side panel on the left
function createTreeHTML(): void {

    function createTreeHTMLRec(node: Slide, parentDiv: HTMLDivElement) {



        function createDiv(state: State): HTMLDivElement {
            let icon: string;

            let name: string
            if (state.type == 'start') {
                if (state.slide.parent == undefined)
                    name = manifest.presentation;
                else
                    name = state.slide.name;
                icon = "chevron_right";
            }
            else {
                name = state.event.name;
                const event = state.event;
                switch (event.type) {
                    case "show":
                        icon = "visibility";
                        break;
                    case "hide":
                        icon = "visibility_off";
                        break;
                    case "child":
                        icon = "keyboard_return";
                        break;
                    case 'animate':
                        icon = "animation";
                        break;
                }
            }

            const div = document.createElement("div");
            div.classList.add("tree-view-item");
            div.classList.add("tree-view-item-loading");
            div.innerHTML = "<i class=\"material-icons\">" + icon + "</i> " + name;

            div.addEventListener('click', (e) => {
                {
                    if ((state.type == 'start') && ((e.target as Element).nodeName == 'I')) {
                        //the icon was clicked for a slide start event
                        const open = !subtreeOpen(state.slide);
                        openPanelTree(state.slide, open);

                    } else {
                        gotoState(state);
                    }
                }
            });
            return div;
        }


        //this is an item in the tree view that contains the name of the slide
        const startState = slideStartState(node);
        const div = createDiv(startState);
        treeViewCache.set(startState, div);
        parentDiv.appendChild(div);

        //the div in the tree view to store the children of this node
        const subdiv = document.createElement("div");
        subdiv.classList.add("slide-stack");
        subdiv.classList.add("slide-stack-hidden");
        parentDiv.appendChild(subdiv);
        subtreeDivCache.set(node, subdiv);

        for (const child of node.children) {
            if (child.type == 'child')
                createTreeHTMLRec(child, subdiv);

            if (!child.merged) {
                const after = afterEventState(child);
                const childDiv = createDiv(after);
                treeViewCache.set(after, childDiv);
                subdiv.appendChild(childDiv);
            }
        }
    }
    createTreeHTMLRec(manifest.tree, document.getElementById('slide-stack-container') as HTMLDivElement);
}


// creates the timeline at the bottom of the screen, where each rectangle corresponds to a state, and the width of the rectangle is proportiatial to the duration of the sound (and fixed if there is no sound)

function timelineHTML(): void {

    //the timeline for an event was clicked; with the ratio being the indicating the click position inside the timeline
    function timelineClicked(index: number, e: MouseEvent): void {

        const duration = timeline.frames[index].soundDuration;
        if (duration == undefined)
            gotoIndex(index, 'animated', 0);
        else {
            const a: number = e.offsetX;
            const b: number = progressCache[index].offsetWidth;
            gotoIndex(index, 'animated', a * duration / b);
        }
    }

    progressCache = [];

    const timelineDIV = document.getElementById('progress-line');
    timelineDIV.innerHTML = '';


    for (let i = 0; i < timeline.frames.length; i++) {
        const event = timeline.frames[i];
        const big = document.createElement('div');
        const small = document.createElement('div');
        small.classList.add('progress-filler');
        small.style.width = '0%';
        big.appendChild(small);
        timelineDIV.appendChild(big);
        big.addEventListener('click', function (e) {
            timelineClicked(i, e);
        })

        if (event.soundDuration != undefined) {
            big.classList.add('sound');
            big.style.flexGrow = event.soundDuration.toString();
        }
        else {
            big.classList.add('nosound');
            if (i == 0)
                big.style.flexGrow = '0';
            else
                big.style.flexGrow = '2';
        }

        progressCache[i] = big;

        const index = timeline.frames.findIndex((s) => s == event);
        timelineSeen(i);
    }


    //if there is at least one sound, then we display the sound controls (play button, and speed button)
    if (Object.keys(manifest.dfsTimeLine).length > 0) {
        document.body.classList.add('has-sound');
    }
}


function timelineRecording(frame: number, status: 'recording' | 'not recording'): void {
    const div = progressCache[frame];
    if (status == 'not recording')
        div.classList.remove('recording');
    else {
        div.classList.remove('nosound');
        div.classList.add('recording');
    }
}

function timelineFailedLoad(frame: number): void {
    const div = progressCache[frame];
    div.classList.add('nosound');
}



//colours the timeline rectangle corresponding to an event, depending on whether it has been seen or not
function timelineSeen(index: number): void {
    const div = progressCache[index];
    if (div != undefined)
        if (index <= timeline.current) {
            const firstChild = div.firstChild as HTMLElement;
            if (index == timeline.current) {
                if (timeline.frames[index].soundDuration != undefined)
                    firstChild.style.width = "0%";
                else
                    firstChild.style.width = "100%";
            }
            else
                firstChild.style.width = "100%";
            div.classList.add('seen');
        }
        else {
            const firstChild = div.firstChild as HTMLElement;
            firstChild.style.width = "0%";
            div.classList.remove('seen');
        }
}

//update the html (both left panel and progress bar) after a step has been processed in either direction
function markSeen(state: State, direction: 'forward' | 'backward'): void {
    const treeViewDIV = treeViewCache.get(state);

    if (direction == 'forward') {
        if (treeViewDIV != undefined)
            treeViewDIV.classList.add('tree-view-item-seen');
    } else {
        if (treeViewDIV != undefined)
            treeViewDIV.classList.remove('tree-view-item-seen');
    }
}

//mark an event as disabled in the tree view
function markDisabled(state: State): void {
    const div = treeViewCache.get(state);
    if (div != undefined) {
        div.classList.add("disabled-event");
        div.classList.remove("tree-view-item-loading");
    }
}


// tells whether a subtree is open or closed in the left panel
function subtreeOpen(node: Slide): boolean {
    const div = subtreeDivCache.get(node);
    if (div != undefined) {
        return !div.classList.contains('slide-stack-hidden');
    }
}

//opens or closes the tree view corresponding to a child event
function openPanelTree(node: Slide, open: boolean): void {
    const icon = treeViewCache.get(slideStartState(node)).childNodes[0] as HTMLElement;
    if (open) {
        subtreeDivCache.get(node).classList.remove('slide-stack-hidden');
        icon.innerHTML = 'expand_more';
    } else {
        subtreeDivCache.get(node).classList.add('slide-stack-hidden');
        icon.innerHTML = 'chevron_right';
    }
}

//unfolds the tree in the left panel for this event and its parents
function openPanelTreeRec(slide: Slide): void {
    openPanelTree(slide, true);
    if (slide.parent != undefined) {
        openPanelTreeRec(slide.parent);
    }
}


//remove the 'loading' class from the corresponding elements in the slide panel
function removeLoading(node: Slide): void {


    const nodeState = slideStartState(node);

    if (treeViewCache.get(nodeState) != undefined) {
        treeViewCache.get(nodeState).classList.remove("tree-view-item-loading");
    }

    for (const child of node.children) {

        const childState = afterEventState(child);
        if (treeViewCache.get(childState) != undefined)
            treeViewCache.get(childState).classList.remove("tree-view-item-loading");
    }
}



//toggles the side panel on the left with the list of slides
function showPanel(visible: boolean): void {
    const leftPanel = document.getElementById('left-panel');

    if (visible) {
        gsap.to(leftPanel, {
            width: '30%',
            duration: 0.3
        });
    } else {
        // savedPanelWidth =  leftPanel.clientWidth;
        gsap.to(leftPanel, {
            width: 0,
            duration: 0.3
        });
    }
}

function togglePanel(): void {

    if ((document.getElementById('left-panel') as HTMLDivElement).clientWidth > 0)
        showPanel(false)
    else
        showPanel(true);
}



//switch a tab in the left panel. 
function switchLeftPanelTab(tab: string) {

    // activate the current tab head
    document.getElementById('tab-heads').querySelectorAll('*').forEach(child => child.classList.remove('active'));
    document.getElementById(tab + '-tab-head').classList.add('active');

    // activate the current tab contents
    document.getElementById('tab-contents').querySelectorAll('*').forEach(child => child.classList.remove('active'));
    document.getElementById(tab + '-tab').classList.add('active');


}


//add event listeners for the left panel. 
function initLeftPanel(): void {

    initPdf();
    initPresenterTools();

    //switch tabs in the left panel
    document.getElementById('tab-heads').addEventListener('click', event => {
        const target = event.target as HTMLElement;
        if (target.id.endsWith('tab-head')) {
            switchLeftPanelTab(target.id.slice(0, -9));
        }
    })

    //sketchpad checkbox in the presenter tab
    document.getElementById('drawing-tools-checkbox').addEventListener('change', event => {
        toggleSketchpad();
    });






}


//initialize the left panel and the timeline, adding event listeners to the buttons. The actual content of these will be added later
function initPanels(): void {

    document.getElementById('svg').addEventListener('touchstart', touchStart)
    document.getElementById('open-menu').addEventListener('click', togglePanel);
    document.getElementById('prev-event').addEventListener('click', prevButton);
    document.getElementById('next-event').addEventListener('click', nextButton);
    document.getElementById('play-button').addEventListener('click', playButton);

    createTreeHTML();
    timelineHTML();
    initSearch();
    initComments();
    initLeftPanel();
    initSoundHTML();

    // for testing 
    togglePanel();
    switchLeftPanelTab('author');
}






//displays an alert for the user for a short time
function userAlert(text: string): void {
    const alert = document.getElementById('alert-box');
    alert.style.transition = 'opacity 1s ease-in-out';
    alert.firstElementChild.textContent = text;
    alert.classList.add('visible');
    setTimeout(() => {
        alert.classList.remove('visible');
    }, 3000);
}




async function updateTimeCounter() {

    const audio = await loadSound(timeline.current);
    if (audio != undefined) {
        const currentTime = audio.currentTime;
        const duration = audio.duration;
        const curTime = currentTime + timeline.frames[timeline.current].previousDuration;
        const lastStep = timeline.frames[timeline.frames.length - 1];
        let totalSoundDuration = lastStep.previousDuration;
        if (lastStep.soundDuration != undefined)
            totalSoundDuration += lastStep.soundDuration;

        const timeString = formatTime(curTime) + '/' + formatTime(totalSoundDuration);
        document.getElementById('time-elapsed').innerHTML = timeString
        const div = progressCache[timeline.current].firstChild as HTMLDivElement;
        div.style.width = (100 * currentTime / duration) + '%'
    }
}

function updatePageNumber() {
    document.getElementById("page-count-enumerator").innerHTML = pageNumber(currentState()).toString();
    //the last page number is that of the last state 
    document.getElementById("page-count-denominator").innerHTML = " / " +
        pageNumber(timeline.frames[timeline.frames.length - 1].state).toString();

}

//  number in the corner, and put the step number in the url
function updateTimeLineForCurrent(): void {
    const url = new URL(window.location.href);
    const searchParams = url.searchParams;

    // Set the 'step' parameter
    searchParams.set('step', timeline.current.toString());
    url.search = searchParams.toString();
    window.history.replaceState({}, '', url.toString());



    if (canPlaySound(timeline.current)) {
        document.getElementById('progress-panel').classList.add('playing');
        updateTimeCounter();
    }
    else {
        updatePageNumber();
        document.getElementById('progress-panel').classList.remove('playing');

    }

    // the "previous" arrow should be invisible at the first event of the first slide
    // analogously for the "next" arrow
    if (timeline.current == 0)
        document.getElementById("prev-event").style.visibility = "hidden";
    else
        document.getElementById("prev-event").style.visibility = "visible";

    if (timeline.current == timeline.frames.length - 1)
        document.getElementById("next-event").style.visibility = "hidden";
    else
        document.getElementById("next-event").style.visibility = "visible";
}


function touchStart(event: TouchEvent) {
    if (event.touches.length == 1 && currentTool == 'none') {
        //if the user single-touches on the left or right part of the slide, we do a previous/next slide transition
        const rect = (document.getElementById('svg') as HTMLDivElement).getBoundingClientRect();
        //this is the relative position of the touch inside the slide panel, ranging from 0 to 1.
        const fraction = (event.touches[0].clientX - rect.x) / rect.width;
        if (fraction > 0.9)
            nextButton();
        if (fraction < 0.1)
            prevButton();
    }

    if (event.touches.length == 2) {
        //if the user double-touches, then we display the drawing panel
        toggleSketchpad();

    }
}