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
    userAlert
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
    soundLive
} from "./sound"

import {
    fetchJSON,
    presentationDir
} from './files'

import {
    Manifest
} from "./types";
import {
    toggleSketchpad
} from "./sketchpad";
import { currentStep, gotoStep, moveHead, Step, timeline } from './timeline'

// import { exportPdf } from './print'


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
    if (timeline.type == 'default') {
        //the recorded timelines are read-only
        if (soundState == SoundState.Live)
            soundStop()
        else if (soundState == SoundState.None)
            soundLive()
    }
}

//start or stop the usual type of recording
function recordButton() {
    if (timeline.type == 'default') {
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
                nextButton();
                break;

            case 'ArrowLeft':
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

            /*case 'p':
                exportPdf(); */
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


function getManifest(): Promise<Manifest> {
    return fetchJSON(presentationDir() + '/manifest.json').then(j => {
        if (j == null)
            throw "The manifest is missing for the presentation"
        return j as Manifest;
    })
}

//startup code
//it reads the manifest, which contains the root slide, the number of slides, the sounds, and then it loads the first slide
window.onload = function (): void {

    //the opacity is set to 0 for elements of the page, so that it is not display while the styles are loading. Once the document has loaded, we can set the opacity to normal.
    (document.getElementById('loader-text') as HTMLDivElement).remove();
    (document.getElementById('upper-panel') as HTMLDivElement).style.opacity = '';
    (document.getElementById('progress-panel') as HTMLDivElement).style.opacity = '';

    getManifest().then(m => {
        manifest = m;
        document.title = manifest.presentation;
        createEventTree();
        document.addEventListener("keydown", keyListener);
        initPanels();
        const step = getStepFromURL();
        gotoStep(step).then(() => { (document.getElementById('svg') as HTMLDivElement).style.opacity = '1' });
    }).catch((e) => userAlert(e))
}
