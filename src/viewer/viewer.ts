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
    createEventTree,
    gotoPath,
    changeEvent
} from "./event"

import {
    initPanels,
    updatePageNumber
} from "./html";

import {
    soundStop,
    soundState,
    soundPlay,
    soundPause,
    soundRecord,
    soundAdvance
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





//the path is an array of numbers, which indicates the path in the event tree to the current event 
function getPathFromURL(): number[] {
    const path = [];
    try {
        const pathString = (new URL(window.location.href)).searchParams.get('path').split('/');
        while (pathString.length > 0) {
            const index = pathString.pop();
            if (index != '')
                path.push(parseInt(index));
        }
        return path;

    } catch (e) {
        return [0]; // default path is the first event of the root
    }
}



function playButton(): void {
    if (soundState == SoundState.Record)
        soundStop();
    else if (soundState == SoundState.Play)
        soundPause();
    else
        soundPlay();
}


function nextButton(): void {
    if (soundState == SoundState.Play) {
        soundAdvance(1);
    } else {
        if (soundState == SoundState.Pause)
            soundStop();
        changeEvent(1);
    }
}

function prevButton(): void {
    if (soundState == SoundState.Play) {
        soundAdvance(-1);
    } else {
        soundStop();
        changeEvent(-1);
    }
}





// the main event dispatcher
function keyListener(event: KeyboardEvent) {

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


//startup code
//it reads the manifest, which contains the root slide, the number of slides, the sounds, and then it loads the first slide
window.onload = function (): void {

    // helpPanel();
    document.addEventListener("keydown", keyListener);
    initPanels();



    fetchJSON(presentationDir() + '/manifest.json').then(j => {
        if (j == null)
            throw "The manifest is missing for the presentation"
        manifest = j as Manifest;
        document.title = manifest.presentation;
        const path = getPathFromURL();
        createEventTree();
        gotoPath(path);
    }) //.catch((e) => userAlert(e))
}