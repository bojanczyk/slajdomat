export {
    getManifest, manifest, nextButton, playButton, prevButton, serverConnected,
    userAgent
}

import './css/left-panel.css'
import './css/progress.css'
import './css/sketch.css'
import './css/viewer.css'

import {
    createEventTree
} from "./event"


import {
    initPanels, userAlert
} from "./html"

import {
    fetchJSON,
    presentationDir,
    sendToServer
} from './files'

import { timerStart, userDefinedKeys } from './presenter-tools'
import {
    toggleSketchpad
} from "./sketchpad"
import { canPlaySound, endRecording, playAudio, soundAdvance, soundIcon, soundState, startRecording, stopSound } from './sound'
import { createTimeline, gotoIndex, gotoState, moveHead, timeline } from './timeline'
import {
    Manifest,
    State,
    TimelineJSON
} from "../common/types"




let manifest: Manifest;

//check the user agent for chrome
//at the moment, this is not used
function userAgent(): string {
    if (navigator.userAgent.indexOf("Chrome") !== -1) {
        return "Chrome";
    }
    if (navigator.userAgent.indexOf("Firefox") !== -1) {
        return "Firefox";
    }
    if (navigator.userAgent.indexOf("Safari") !== -1) {
        return "Safari";
    }
    return null;
}

//what happens when the sound play button or the space bar are pressed
function playButton(): void {
    const audio = timeline.frames[timeline.current].audio;

    switch (soundState) {
        case 'playing':
            playAudio(audio, 'pause');
            break;
        case 'none':
            if (canPlaySound(timeline.current))
                playAudio(audio, 'play')
            break;
        case 'recording':
            break;
    }
    soundIcon();
}


//what happens when the prev button or left arrow are pressed
async function nextOrPrevButton(direction: -1 | 1): Promise<void> {
    switch (soundState) {
        case 'playing':
        case 'none':
            if (canPlaySound(timeline.current)) {
                // if there is sound, then we move by 5 seconds
                const where = soundAdvance(5 * direction);
                await gotoIndex(where.frame, 'animated', where.time);
            }
            else {
                await moveHead(direction);
                if (!canPlaySound(timeline.current))
                    stopSound();
            }
            break;
        case 'recording':
            await moveHead(direction);
            break;
    }
    soundIcon();
}


async function nextButton(): Promise<void> {
    await nextOrPrevButton(1);
}

async function prevButton(): Promise<void> {
    await nextOrPrevButton(-1);
}


async function recordButton(): Promise<void> {
    switch (soundState) {
        case 'playing':
            stopSound();
            break;
        case 'recording':
            stopSound();
            break;
        case 'none':
            //this needs to wait, because the media stream is not available immediately
            await startRecording();
            break;
    }
    soundIcon();
}




// the main event dispatcher
function keyListener(event: KeyboardEvent) {

    const tagName = ((event.target) as HTMLElement).tagName;
    if (tagName != 'INPUT' && tagName != 'TEXTAREA') {

        switch (event.key) {
            case 'ArrowRight':
            case 'PageDown':
                // the next slide option was selected
                nextButton();
                break;

            case 'ArrowLeft':
            case 'PageUp': //this is for some clickers
                prevButton()
                break;


            case 'a':
                userAlert('mikli');
                break;

            case ' ':
                playButton();
                break;

            case 'd':
                toggleSketchpad();
                break;

            case 'r':
                recordButton();
                break;

            case 't':
                timerStart();

            default:
                if (event.key in userDefinedKeys)
                    userDefinedKeys[event.key]();


        }
    }
}



// the url might have an index of the state to go to
function getStateFromURL(): State {
    const searchParams = (new URL(window.location.href)).searchParams;
    //we try to return the state, but several things could go wrong: (a) the state parameter is undefined or not a number; (b) the number is out of bounds

    const index = parseInt(searchParams.get('step'));
    if (isNaN(index) || index < 0 || index >= timeline.frames.length)
        return timeline.frames[0].state
    else
        return timeline.frames[index].state;

}


async function getManifest(): Promise<Manifest> {
    const j = await fetchJSON(presentationDir() + '/manifest.json')
    if (j == null)
        throw "The manifest is missing for the presentation"
    return j as Manifest
}


let serverConnectedVar = false;

function serverConnected(): boolean {
    return serverConnectedVar;
}

//adapt the view depending on whether or not we are a tablet, or connected to the server
function checkFeatures() {
    async function ifServerConnected() {
        const response = await sendToServer({ type: 'probe' });
        if (response.status == 'server working') {
            serverConnectedVar = true;
            document.getElementById('author-tab').classList.remove('hidden');
            document.getElementById('author-tab-head').classList.remove('hidden');
        }
    }
    ifServerConnected();

    //if a tablet is used, then we enable the tablet style, which makes the play buttons bigger
    if (('ontouchstart' in window) ||
        (navigator.maxTouchPoints > 0)) // obsolete?:  || (navigator.msMaxTouchPoints > 0))
        document.body.classList.add('tablet');
}



//this function will be executed if the viewer is opened from the App
//currently, there is no need for that
function runFromApp(): void {

    //we don't use such code for the moment, since we try to communicate with the server as much as possible.

}
(window as any).runFromApp = runFromApp;





function getRecordedSteps(): TimelineJSON {
    // throw 'Not implemented yet';
    const searchParams = (new URL(window.location.href)).searchParams;
    try {
        const i = parseInt(searchParams.get('live'));
        throw 'Not implemented yet';
        // return manifest.live[i];
    } catch (e) {
        return undefined;
    }
}



async function onLoadWindow(): Promise<void> {
    //the opacity is set to 0 for elements of the page, so that it is not display while the styles are loading. Once the document has loaded, we can set the opacity to normal.
    (document.getElementById('upper-panel') as HTMLDivElement).style.visibility = 'visible';
    (document.getElementById('progress-panel') as HTMLDivElement).style.visibility = 'visible';

    checkFeatures();

    manifest = await getManifest();

    document.title = manifest.presentation;

    //sets up the event tree, currently this just means defining the parent properties
    createEventTree();

    //if the url had a live timeline, then get it
    const recorded = getRecordedSteps();
    //initialize the steps in the timeline
    createTimeline(recorded);

    //set up the left and bottom html panels
    initPanels();
    //event listener for keys
    document.addEventListener("keydown", keyListener);

    //start the presentation, using the step from the url, or the first step by default 
    const state = getStateFromURL();

    await gotoState(state, 'silent');

    document.getElementById('alert-box').classList.remove('visible');
    (document.getElementById('svg') as HTMLDivElement).style.opacity = '1'

}

//startup code
//it reads the manifest, which contains the root slide, the number of slides, the sounds, and then it loads the first slide
window.onload = onLoadWindow;