export {
    manifest,
    getManifest,
    updatePageNumber,
    userAgent,
    nextButton,
    prevButton,
    playButton
}

import './css/viewer.css'
import './css/left-panel.css'
import './css/progress.css'
import './css/sketch.css'

import {
    createEventTree
} from "./event"


import {
    initPanels,
    updatePageNumber,
    userAlert,
    userDefinedKeys
} from "./html";

import {
    soundStop,
    soundState,
    soundPlay,
    soundRecord,
    soundAdvance,
    resetSound,
    soundPaused,
    endOfSound,
    SoundState,
    soundLive,
    initSoundTimeline
} from "./sound"

import {
    fetchJSON,
    presentationDir,
    probeServer,
    sendToServer
} from './files'

import {
    LiveRecording,
    Manifest
} from "./types";
import {
    toggleSketchpad
} from "./sketchpad";
import { createTimeline, currentStep, gotoStep, moveHead, Step, timeline } from './timeline'

import { exportPdf } from './client-print'


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
    switch (soundState) {
        case SoundState.Play:
            soundStop();
            break;
        case SoundState.Recording:
        case SoundState.Live:
            soundStop();
            break;
        case SoundState.None:
            if (!endOfSound())
                soundPlay();
            break;
    }
}

//what happens when the next button or right arrow are pressed
function nextButton(): void {
    if (timeline.future.length > 0) {
        switch (soundState) {
            case SoundState.Play:
                soundAdvance(1);
                break;
            case SoundState.Recording:
            case SoundState.Live:
                moveHead(1);
                if (soundState == SoundState.Live)
                    soundRecord('live');
                else
                    soundRecord('event');
                break;
            case SoundState.None:
                resetSound();
                moveHead(1);
        }
    }
}

//what happens when the prev button or left arrow are pressed
function prevButton(): void {
    if (timeline.past.length > 0) {
        switch (soundState) {
            case SoundState.Play:
                soundAdvance(-1);
                break;

            case SoundState.Recording:
                soundStop();
                break;
            case SoundState.Live:
                moveHead(-1);
                soundRecord('live');
                break;

            case SoundState.None:
                if (soundPaused())
                    resetSound();
                else
                    moveHead(-1);

        }
    }
}

//start or stop a live recording
function liveButton() {
    if (timeline.type == 'default' && serverConnected()) {
        //the recorded timelines are read-only
        if (soundState == SoundState.Live)
            soundStop()
        else if (soundState == SoundState.None)
            soundLive()
    }
}

//start or stop the usual type of recording
function recordButton() {
    if (timeline.type == 'default' && serverConnected()) {
        //the recorded timelines are read-only
        if (soundState == SoundState.Recording) {
            soundStop()
        }
        else {
            soundStop()
            soundRecord('event')
        }
    }
}



// the main event dispatcher
function keyListener(event: KeyboardEvent) {

    if (event.target != document.getElementById('search-input')) {

        switch (event.key) {
            case 'ArrowRight':
            case 'PageDown': //this is for some clickers
                nextButton();
                break;

            case 'ArrowLeft':
            case 'PageUp': //this is for some clickers
                prevButton();
                break;

            case ' ':
                playButton();
                break;

            case 'd':
                toggleSketchpad();
                break;

            case 'r':
                recordButton()
                break;

            case 'l':
                liveButton()
                break;

            default:
                if (event.key in userDefinedKeys)
                    userDefinedKeys[event.key]();


        }
    }
}



//the path is an array of numbers, which indicates the path in the event tree to the current event 
function getStepFromURL(): Step {
    const searchParams = (new URL(window.location.href)).searchParams;
    //we try to return the step, but several things could go wrong: (a) the step parameter is undefined or not a number; (b) the number is out of bounds
    try {
        return currentStep(parseInt(searchParams.get('step')));
    } catch (e) {
        //otherwise return the first step
        return currentStep();
    }
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
function runFromApp() : void {

}





function getRecordedSteps(): LiveRecording {
    const searchParams = (new URL(window.location.href)).searchParams;
    try {
        const i = parseInt(searchParams.get('live'));
        return manifest.live[i];
    } catch (e) {
        return undefined;
    }
}

//startup code
//it reads the manifest, which contains the root slide, the number of slides, the sounds, and then it loads the first slide
window.onload = function (): void {


    //the opacity is set to 0 for elements of the page, so that it is not display while the styles are loading. Once the document has loaded, we can set the opacity to normal.
    (document.getElementById('loader-text') as HTMLDivElement).remove();
    (document.getElementById('upper-panel') as HTMLDivElement).style.opacity = '';
    (document.getElementById('progress-panel') as HTMLDivElement).style.opacity = '';

    checkFeatures();

    getManifest().then(m => {
        manifest = m;
        document.title = manifest.presentation;

        //sets up the event tree, currently this just means defining the parent properties
        createEventTree();

        //if the url had a live timeline, then get it
        const recorded = getRecordedSteps();
        //initialize the steps in the timeline
        createTimeline(recorded);
        //add the sound data, especially durations
        initSoundTimeline(recorded);

        //set up the left and bottom html panels
        initPanels();
        //event listener for keys
        document.addEventListener("keydown", keyListener);

        //start the presentation, using the step from the url, or the first step by default 
        const step = getStepFromURL();
        gotoStep(step).then(() => { (document.getElementById('svg') as HTMLDivElement).style.opacity = '1' });
    }).catch((e) => userAlert(e))
}
