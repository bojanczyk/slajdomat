export {
    audioPlaying, initPanels, markDisabled, markSeen, openPanelTree,
    openPanelTreeRec,
    removeLoading, soundIcon, timelineHTML, timelineSeen, updatePageNumber, updateTimelineDisplay, userAlert, userDefinedKeys
};




    import {
        manifest,
        nextButton,
        playButton,
        prevButton
    } from './viewer';

import {
    SoundState,
    endOfSound,
    gotoAudio,
    playbackRateChange,
    soundState,
    sounds,
    stepAudio,
    totalSoundDuration
} from './sound';

import {
    initSearch
} from './search';

import {
    gsap
} from "gsap";


import { exportPdf } from './client-print';
import { initComments } from './comments';
import { currentTool, toggleSketchpad } from './sketchpad';
import { OverlayStep, Step, ZoomStep, allSteps, currentStep, gotoEvent, gotoStep, timeline, zoomsIn } from './timeline';
import { SlideEvent, ZoomEvent } from './types';







//these dictionaries store, for each slide event, the corresponding div and subtreeDiv in the tree panel. The div is the name of the event, while the subtreeDiv is defined only for child events, and it is the subtree.
const divCache: Map<SlideEvent, HTMLDivElement> = new Map();
const subtreeDivCache: Map<SlideEvent, HTMLDivElement> = new Map();
//this is a link to the progress item in the progress bar at the bottom
const progressCache: Map<Step, HTMLDivElement> = new Map();

//this dictionary tells you if the div, for a child event, is open (the tree is unfolded
const divOpen: Map<SlideEvent, boolean> = new Map();



//create the tree list of the slides and event that is in the unfolding side panel on the left
function createTreeHTML(): void {

    function createTreeHTMLRec(event: SlideEvent) {

        function eventClicked(e: MouseEvent) //what happens when an event is clicked in the control panel
        {
            if ((e.target as Element).nodeName == 'I') {
                //the icon was clicked
                if (event.type == 'child') // for child events, we fold/unfold the list of child events
                {
                    const open = !divOpen.get(event);
                    divOpen.set(event, open);
                    openPanelTree(event, open);
                }
            } else {
                //the name of the event was clicked
                gotoEvent(event);
            }
        }
        divOpen.set(event, false);
        if (event.parent == undefined) {
            subtreeDivCache.set(event, document.getElementById('slide-stack') as HTMLDivElement);
        } else if (event.merged && event.type != 'child') {
            //merged events get no items in the tree view
        } else {
            const parentDiv = subtreeDivCache.get(event.parent);
            const div = document.createElement("div");
            divCache.set(event, div);
            div.classList.add("tree-view-item");
            div.classList.add("tree-view-item-loading");

            let icon;


            if (event.type == "show")
                icon = "visibility";
            if (event.type == "hide")
                icon = "visibility_off";
            if (event.type == "child") {
                icon = "chevron_right";
            }

            div.innerHTML = "<i class=\"material-icons\">" + icon + "</i> " + event.name;

            div.addEventListener('click', eventClicked);
            parentDiv.appendChild(div);


            if (event.type == 'child') {
                const subdiv = document.createElement("div");
                subdiv.classList.add("slide-stack");
                subdiv.classList.add("slide-stack-hidden");
                parentDiv.appendChild(subdiv);
                subtreeDivCache.set(event, subdiv);
            }
        }

        //recursively call for all children
        if (event.type == 'child') {
            for (const child of event.children)
                createTreeHTMLRec(child)
        }
    }
    createTreeHTMLRec(manifest.tree);

}

function timelineHTML(): void {

    progressCache.clear();




    const timelineDIV = document.getElementById('progress-line');
    timelineDIV.innerHTML = '';
    for (const step of allSteps()) {
        const big = document.createElement('div');
        const small = document.createElement('div');
        small.classList.add('progress-filler');
        small.style.width = '0%';
        big.appendChild(small);
        timelineDIV.appendChild(big);
        big.addEventListener('click', function (e) {
            timelineClicked(step, e);
        })

        const sound = sounds.get(step);

        if (sound != undefined) {
            big.classList.remove('nosound');
            big.style.flexGrow = sound.duration.toString();
        }
        else {
            big.classList.add('nosound');
            big.style.flexGrow = '10';
        }

        progressCache.set(step, big);
        timelineSeen(step, timeline.past.includes(step));
    }
}


//the timeline for an event was clicked; with the ratio being the indicating the click position inside the timeline
function timelineClicked(step: Step, e: MouseEvent): void {


    const a: number = e.offsetX;
    const b: number = progressCache.get(step).offsetWidth;
    if (step == currentStep()) {
        gotoAudio(a / b);
    } else {
        gotoStep(step)
    }
}


function timelineSeen(step: Step, seen: boolean): void {
    const div = progressCache.get(step);
    if (div != undefined)
        if (seen) {
            const firstChild = div.firstChild as HTMLElement;
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
function markSeen(step: Step, direction: -1 | 1): void {
    let div: HTMLElement;

    if (step instanceof OverlayStep)
        div = divCache.get(step.overlays[0]);
    if (step instanceof ZoomStep && zoomsIn(step))
        div = divCache.get(step.target)

    const timelineDIV = progressCache.get(step);
    if (direction == 1) {

        if (div != undefined) //final events have no div
            div.classList.add('tree-view-item-seen');

        timelineSeen(step, true);


    } else {

        if (div != undefined) //final events have no div
            div.classList.remove('tree-view-item-seen');

        if (timelineDIV != undefined)
            timelineSeen(step, false);
    }
}

//mark an event as disabled in the tree view
function markDisabled(node: SlideEvent): void {
    const div = divCache.get(node);
    if (div != undefined) {
        div.classList.add("disabled-event");
        div.classList.remove("tree-view-item-loading");
    }
}


//opens or closes the tree view corresponding to a child event
function openPanelTree(event: SlideEvent, open: boolean): void {
    const icon = divCache.get(event).childNodes[0] as HTMLElement;
    if (open) {
        subtreeDivCache.get(event).classList.remove('slide-stack-hidden');
        icon.innerHTML = 'expand_more';
    } else {
        subtreeDivCache.get(event).classList.add('slide-stack-hidden');
        icon.innerHTML = 'chevron_right';
    }
}

//unfolds the tree in the left panel for this event and its parents
function openPanelTreeRec(event: SlideEvent): void {
    if (event.parent == undefined)
        return;
    if (event.type == 'child') {
        openPanelTree(event, true);
    }
    openPanelTreeRec(event.parent);
}


//remove the 'loading' class from the corresponding elements in the slide panel
function removeLoading(node: ZoomEvent): void {
    if (divCache.get(node) != undefined) {
        divCache.get(node).classList.remove("tree-view-item-loading");
    }
    for (const child of node.children)
        if (child.type == 'show' || child.type == 'hide') {
            if (divCache.get(child) != undefined)
                divCache.get(child).classList.remove("tree-view-item-loading");
        }
}


//inputs number of seconds and formats it in mm:ss format
function formatTime(time: number): string {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time) % 60;
    if (seconds < 10)
        return minutes + ':0' + seconds
    else
        return minutes + ':' + seconds;
}

//this function is called periodically when the audio is playing, and it updates the position of the slider
function audioPlaying(audio: HTMLAudioElement): void {

    try {
        const curAudio = stepAudio(currentStep());
        if (audio == curAudio) {
            const currentTime = audio.currentTime;
            const duration = audio.duration;
            const curTime = currentTime + sounds.get(currentStep()).previousDuration;
            document.getElementById('time-elapsed').innerHTML = formatTime(curTime) + '/' + formatTime(totalSoundDuration);
            (progressCache.get(currentStep()).firstChild as HTMLElement).style.width = (100 * currentTime / duration) + '%'
        }
    }
    catch (e) {
        console.log('tried to play illegally')
    }

}

// the timeline uses two kinds of display, depending on the whether the sound is playing, or not
function updateTimelineDisplay(): void {
    if (soundState == SoundState.Play) {
        document.getElementById('progress-panel').classList.add('playing');
    } else {
        document.getElementById('progress-panel').classList.remove('playing');
    }
}

//choose the right button for playing sound
function soundIcon(): void {
    const playButton = document.getElementById("play-button");

    if (endOfSound())
        playButton.style.opacity = '0';
    else
        playButton.style.opacity = '1';

    if (soundState != SoundState.None) {
        //we need to make space for the sound buttons, in case this is the first sound that is added
        document.body.classList.add('has-sound');
    }

    switch (soundState) {
        case SoundState.Play:
            playButton.style.color = 'black'
            playButton.innerHTML = "pause"
            break;
        case SoundState.None:
            {
                playButton.style.color = 'black'
                const sound = sounds.get(currentStep());
                if (sound == undefined)
                    playButton.innerHTML = "play_disabled";
                else {
                    if (sound.audio != undefined)
                        playButton.innerHTML = "play_arrow"
                    else
                        playButton.innerHTML = 'cached';
                }

                for (const step of allSteps()) {
                    progressCache.get(step).classList.remove('recording');
                }
                break;
            }
        case SoundState.Recording:
            playButton.style.color = 'black'
            playButton.innerHTML = "mic"
            progressCache.get(currentStep()).classList.add('recording');
            break;
        case SoundState.Live:
            playButton.style.color = 'red'
            playButton.innerHTML = "mic_none"

            break;
    }

    updateTimelineDisplay();
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

let mostRecentlyPressed = undefined as string;
const userDefinedKeys: { [key: string]: () => void } = {};

//switch a tab in the left panel. 
function switchLeftPanelTab(tab: string) {

    // activate the current tab head
    document.getElementById('tab-heads').querySelectorAll('*').forEach(child => child.classList.remove('active'));
    document.getElementById(tab + '-tab-head').classList.add('active');

    // activate the current tab contents
    document.getElementById('tab-contents').querySelectorAll('*').forEach(child => child.classList.remove('active'));
    document.getElementById(tab + '-tab').classList.add('active');


}

//display the pdf links if the files exist
async function pdfLinks() {
    if (manifest.pdfFile != undefined) {
        const theLink = document.getElementById('link-to-pdf');
        theLink.classList.remove('hidden');
    }

}

//add event listeners for the left panel. 
function initLeftPanel(): void {

    pdfLinks();
    function listUserDefinedKeys() {
        let list = '';
        document.getElementById('list-of-key-bindings').innerHTML = '';
        for (let key in userDefinedKeys) {
            if (userDefinedKeys[key] == prevButton)
                list = list + key + ': previous slide <br>';
            if (userDefinedKeys[key] == nextButton)
                list = list + key + ': next slide <br>';
        }
        document.getElementById('list-of-key-bindings').innerHTML = list;
    }

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

    //scans most recently pressed key to display in the non-standard next/previous key selection from presenter tab
    document.addEventListener("keydown", setMostRecentlyPressed);



    for (const button of document.querySelectorAll('span')) {

        switch (button.id) {
            case 'new-prev-key':
                button.addEventListener('click', event => {
                    if (mostRecentlyPressed != undefined)
                        userDefinedKeys[mostRecentlyPressed] = prevButton;
                    listUserDefinedKeys();
                })
                break;
            case 'new-next-key':
                button.addEventListener('click', event => {
                    const target = event.target as HTMLElement;
                    if (mostRecentlyPressed != undefined)
                        userDefinedKeys[mostRecentlyPressed] = nextButton;
                    listUserDefinedKeys();
                })
                break;
            case 'pdf-print-button':
                button.addEventListener('click', event => {
                    exportPdf()
                })
                break;
            case 'link-to-pdf':
                button.addEventListener('click', event => {
                    window.open(manifest.pdfFile, 'open');
                })
                break;
        }
    }


}

function setMostRecentlyPressed(event: KeyboardEvent): void {
    for (const button of document.querySelectorAll('.key-binding'))
        button.classList.remove('disabled');

    mostRecentlyPressed = event.key
    for (const span of document.querySelectorAll('.most-recently-pressed-key'))
        span.innerHTML = mostRecentlyPressed;
}

//initialize the left panel and the timeline, adding event listeners to the buttons. The actual content of these will be added later
function initPanels(): void {

    document.getElementById('svg').addEventListener('touchstart', touchStart)
    document.getElementById('open-menu').addEventListener('click', togglePanel);
    document.getElementById('prev-event').addEventListener('click', prevButton);
    document.getElementById('next-event').addEventListener('click', nextButton);
    document.getElementById('play-button').addEventListener('click', playButton);
    document.getElementById('sound-speed').addEventListener('click',
        playbackRateChange);


    createTreeHTML();
    //creates the timeline html at the bottom of the screen
    timelineHTML();

    initSearch();
    initComments();

    //if there is at least one sound, then we display the sound controls (play button, and speed button)
    if (Object.keys(manifest.soundDict).length > 0) {
        document.body.classList.add('has-sound');
    }
    soundIcon();
    initLeftPanel();

}



//displays a panel for a short time
function shortDisplay(panel: HTMLElement): void {
    const tl = gsap.timeline();
    panel.style.display = 'inherit';
    tl.to(panel, {
        opacity: "100%",
        duration: 0.1
    }).to(panel, {
        duration: 2
    }).to(panel, {
        opacity: "0",
        duration: 1
    });
    tl.eventCallback("onComplete", function () {
        panel.style.display = 'none';
    });
}

// //displays the help
// function helpPanel() : void {
//     shortDisplay(document.getElementById("help-panel"));
// }

//displays an alert for the user at the bottom of the screen
function userAlert(text: string): void {
    document.getElementById("text-alert").innerHTML = text;
    shortDisplay(document.getElementById("text-alert-box"));
}

//update the page number in the corner, and put the step number in the url
function updatePageNumber(): void {

    function updateURL() {
        const searchParams = (new URL(window.location.href)).searchParams;
        let paramString = '?';
        for (const param of searchParams.keys())
            if (param != 'step')
                paramString += `${param}=${searchParams.get(param)}&`

        if (searchParams.keys())
            history.pushState({}, null, paramString + 'step=' + timeline.past.length.toString());

    }

    updateURL();

    document.getElementById("page-count-enumerator").innerHTML = currentStep().pageNumber.toString();

    document.getElementById("page-count-denominator").innerHTML = " / " +
        timeline.lastStep.pageNumber.toString();


    // the "previous" arrow should be invisible at the first event of the first slide
    // analogously for the "next" arrow
    if (timeline.past.length == 0)
        document.getElementById("prev-event").style.visibility = "hidden";
    else
        document.getElementById("prev-event").style.visibility = "visible";

    if (timeline.future.length == 0)
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