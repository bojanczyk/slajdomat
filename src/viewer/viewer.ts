export {
    manifest,
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
    updatePageNumber
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
    cacheFlush
} from "./sound"

import {
    fetchJSON,
    presentationDir
} from './files'

import {
    Manifest,
    SoundState
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
        case SoundState.Record:
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
            case SoundState.Record:
                moveHead(1);
                soundRecord();
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

            case SoundState.Record:
                soundStop();
                break;

            case SoundState.None:
                if (soundPaused())
                    resetSound();
                else
                    moveHead(-1);

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
                if (soundState == SoundState.Record)
                    soundStop();
                else {
                    soundStop();
                    soundRecord();
                }
                break;

            /*case 'p':
                exportPdf(); */
        }
    }
}

//the path is an array of numbers, which indicates the path in the event tree to the current event 
function getStepFromURL(): Step {
    const searchParams = (new URL(window.location.href)).searchParams;

    //this makes sure that the cache is ignored when downloading sounds, if a nocache string is present in the url
    if (searchParams.get('nocache') != undefined)
        cacheFlush();

    //we try to return the step, but several things could go wrong: (a) the step parameter is undefined or not a number; (b) the number is out of bounds
    try {
        return currentStep(parseInt(searchParams.get('step')));
    } catch (e) {
        //otherwise return the first step
        return currentStep();
    }
}



//startup code
//it reads the manifest, which contains the root slide, the number of slides, the sounds, and then it loads the first slide
window.onload = function (): void {

    //the opacity is set to 0 for elements of the page, so that it is not display while the styles are loading. Once the document has loaded, we can set the opacity to normal.
    (document.getElementById('loader-text') as HTMLDivElement).remove();
    (document.getElementById('upper-panel') as HTMLDivElement).style.opacity = '';
    (document.getElementById('progress-panel') as HTMLDivElement).style.opacity = '';

    fetchJSON(presentationDir() + '/manifest.json').then(j => {
        if (j == null)
            throw "The manifest is missing for the presentation"
        manifest = j as Manifest;
        document.title = manifest.presentation;
        createEventTree();
        document.addEventListener("keydown", keyListener);
        initPanels();
        const step = getStepFromURL();
        gotoStep(step);
    }) //.catch((e) => userAlert(e))
}
