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
    soundIcon
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
import { getStepFromURL, gotoStep, moveHead, timeline } from './timeline'


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




/*
if (soundPaused())
        {
            console.log('not going back');
            resetSound();
            if (direction == -1)
                return;
        }
        */


function playButton(): void {
    switch (soundState) {
        case SoundState.Play:
            soundStop();
            break;
        case SoundState.Record:
            soundStop();
            break;
        case SoundState.None:
            soundPlay();
            break;
    }
    soundIcon();
}


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
        soundIcon();
    }
}

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
        soundIcon();
    }
}





// the main event dispatcher
function keyListener(event: KeyboardEvent) {

    if (event.target != document.getElementById('search-input')) {
        if (event.key == 'ArrowRight') {
            nextButton();

        }
        if (event.key == 'ArrowLeft') {
            prevButton();
        }

        if (event.key == ' ') {
            playButton();
        }

        if (event.key == 'd') {
            toggleSketchpad();
        }

        if (event.key == 'r') {
            if (soundState == SoundState.Record)
                soundStop();
            else {
                soundStop();
                soundRecord();
            }
        }
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
