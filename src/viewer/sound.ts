export {
    soundStop,
    soundPlay,
    soundIcon,
    soundRecord,
    loadSound,
    soundState,
    playbackRateChange,
    gotoAudio,
    soundAdvance,
    sounds,
    totalSoundDuration,
    initSoundTimeline,
    resetSound,
    soundPaused
}

import {
    SoundState,
    SlideEvent,
    MessageToServerSound
} from './types'

import {
    manifest,
    userAgent
} from './viewer'

import {
    fileName,
    sendToServer
} from './files'

import {
    parentEvent,
} from "./event"

import {
    audioPlaying,
    timelineButtons as updateTimelineDisplay,
    timelineHTML,
    userAlert
} from "./html"
import { allSteps, currentStep, moveHead, OverlayStep, Step,  zoomsIn, ZoomStep } from './timeline'








//there are four possible states for the sound
//"recording" means that we are recording sound
//"play" means that we are playing sound
//"pause" means that we have paused playing sound
//null means none of the above



let soundState: SoundState = SoundState.None;
let globalAudio: HTMLAudioElement;

let totalSoundDuration = 0; //duration of sounds so far

type SoundInfo = {
    filename: string,
    duration: number,
    previousDuration: number,
    audio: HTMLAudioElement
}

const sounds: Map<Step, SoundInfo> = new Map();

function soundPaused() : boolean {
    console.log(globalAudio.currentTime);
    if (globalAudio != undefined && globalAudio.currentTime > 0)
        return true;
    else 
        return false;
}


//stop playing or recording, thus making the sound state none
function soundStop(): void {
    if (soundState == SoundState.Play) {
        globalAudio.pause();
        audioPlaying(globalAudio); //updates the timeline
    }

    if (soundState == SoundState.Record) {
        soundState = SoundState.None;
        mediaRecorder.stop();
    }

    soundState = SoundState.None;
    soundIcon();
    updateTimelineDisplay();
}





//start recording sound
function soundRecord(): void {
    recordSound(currentStep()).then(() => {
        soundState = SoundState.Record;
        soundIcon();
        updateTimelineDisplay();
    }).catch((error) => {
        soundState = SoundState.None;
        soundIcon();
        if (userAgent() == "Safari") {
            userAlert("To enable Mediarecorder  in Safari, use Develop/Experimental features");
        } else
            userAlert(error)
        updateTimelineDisplay();

    })
}






//set 
function soundIcon(): void {
    const playButton = document.getElementById("play-button");

    if (soundState != SoundState.None) {
        //we need to make space for the sound buttons, in case this is the first sound that is added
        document.body.classList.add('has-sound');
    }

    switch (soundState) {
        case SoundState.Play:
            playButton.innerHTML = "pause"
            break;
        case SoundState.None:
            {
                const sound = sounds.get(currentStep());
                if (sound == undefined)
                    playButton.innerHTML = "play_disabled";
                else {
                    if (sound.audio != undefined)
                        playButton.innerHTML = "play_arrow"
                    else
                        playButton.innerHTML = 'cached';
                }

                break;
            }
        case SoundState.Record:
            playButton.innerHTML = "mic"
            break;
    }
}


let mediaRecorder: MediaRecorder;

async function recordSound(step: Step): Promise<void> {


    if (mediaRecorder != null) {
        if (mediaRecorder.state == "recording")
            mediaRecorder.stop();
    }

    const stream = await navigator.mediaDevices.getUserMedia({
        audio: true
    })
    mediaRecorder = new MediaRecorder(stream)
    mediaRecorder.start()
    const audioChunks: Blob[] = []
    mediaRecorder.addEventListener("dataavailable", event => {
        audioChunks.push(event.data)
    })
    mediaRecorder.addEventListener("stop", () => {
        const audioBlob = new Blob(audioChunks)
        const audioURL = window.URL.createObjectURL(audioBlob)
        const audio = new Audio(audioURL)
        audio.addEventListener('ended', function () {
            moveHead(1)
        })

        const where = whereToSave.get(step);
        
        
        const fr = new FileReader()
        fr.onload = function (e) {
            const target = e.target as FileReader
            const x = target.result as ArrayBuffer
            const y = new Uint8Array(x)
            const retmsg: MessageToServerSound = {
                presentation: undefined,
                type: 'wav',
                slideId: where.id,
                index: where.index,
                name: where.index.toString(),
                file: Array.from(y)
            }
            sendToServer(retmsg)
                .then(r => r.json())
                .then(r_1 => {
                    if (r_1.status != 'Sound recorded successfully')
                        throw r_1.status;
                }).catch((e) => {
                    console.log(e);
                    userAlert("Failed to record sound.")
                })

        }
        fr.readAsArrayBuffer(audioBlob)
    })
}


const playbackRates = [1, 1.5, 2, 0.7];
let playbackRateIndex = 0;
//the possible values are 1, 1.5, 2
function playbackRateChange(): void {

    playbackRateIndex = (playbackRateIndex + 1) % playbackRates.length;
    globalAudio.playbackRate = playbackRates[playbackRateIndex];
    document.getElementById('sound-speed').innerHTML = '×' + playbackRates[playbackRateIndex];
}



function soundPlay(): boolean {
    try {
        const audio = sounds.get(currentStep()).audio;
        if (audio == undefined)
            throw 'no audio';


        globalAudio = audio;
        globalAudio.playbackRate = playbackRates[playbackRateIndex];

        // if (time != undefined) {
        //     if (time < 0) {
        //         //negative time is counted from the end of the audio
        //         globalAudio.currentTime = Math.max(0, globalAudio.duration - time);
        //     }
        //     else {
        //         //non-negative time is counted in the usual way
        //         globalAudio.currentTime = time;
        //     }
        // }
        globalAudio.play();
        soundState = SoundState.Play;
        soundIcon();
        updateTimelineDisplay();
        return true;
    }
    catch (e) {
        //if the sound is not in the database
        userAlert("No sounds for this event");
        soundStop();
        return false;
    }
}


const whereToSave: Map<Step, { id: string, index: number }> = new Map();

//for each step in the timeline, get its file name and duration
function initSoundTimeline(): void {

    sounds.clear();
    whereToSave.clear();

    totalSoundDuration = 0;

    
    for (const step of allSteps()) {
        //the sound for a step is stored in the sound dict under the parent event, and the index of the current event. Therefore, we need to compute these values
        let index: number;
        let parent: SlideEvent;
        if (step instanceof OverlayStep) {
            const event = step.overlays[0];
            parent = parentEvent(event);
            index = parent.children.indexOf(event);
        }
        else 
        if (step instanceof ZoomStep) {
            parent = step.source;
            if (zoomsIn(step))
                index = parent.children.indexOf(step.target);
            else {
                index = parent.children.length;
            }
        }
        else {
            //this is a finish event
            parent = manifest.tree;
            index = parent.children.length;
        }

        whereToSave.set(step, { id: parent.id, index: index });

        //try to get the sound information
        try {
            const x = manifest.soundDict[parent.id][index];
            sounds.set(step, {
                filename: fileName(parent.id, x.file + '.mp3'),
                audio: undefined,
                duration: x.duration,
                previousDuration: totalSoundDuration
            })
            totalSoundDuration += x.duration;
        }
        catch (e) {
            console.log('found no sound file')
            // there is no sound file
        }
    }
}

function loadSound(step: Step): Promise<void> {
    return new Promise((resolve, reject) => {
        const sound = sounds.get(step);

        if (sound == undefined || sound.audio != null) {
            //if there is no sound to load, or it has already been loaded, then the loading is assumed successful
            resolve()
        }
        else {
            const filename = sound.filename;
            const audio = new Audio(filename);
            // audio.autoplay=true;
            audio.addEventListener('ended', function () {
                moveHead(1);
            });

            audio.addEventListener('progress', () => {
                sound.audio = audio;
                if (step == currentStep()) {
                    soundIcon();
                }
                resolve();
            })

            audio.addEventListener('error', () => {
                sounds.delete(step);
                if (step == currentStep()) {
                    soundIcon();
                }
                reject();
            })

            audio.addEventListener('timeupdate',
                e => { audioPlaying(e.target as HTMLAudioElement) })
        }
    })
}

function gotoAudio(ratio: number): void {
    if (globalAudio != null) {
        globalAudio.currentTime = globalAudio.duration * ratio;
    }
}

const soundIncrement = 10;
//advance the sound by 10 second if t=1 and by -10 seconds otherwise
function soundAdvance(t: 1 | -1): void {
    if (t < 0) {
        if (globalAudio.currentTime < 1) {//if we are close to the beginning then we move to the previous event
            globalAudio.pause();
            moveHead(-1);
            throw 'this should be redone'
        }
        else {
            globalAudio.currentTime = Math.max(0, globalAudio.currentTime - soundIncrement);
        }
    }
    else {
        globalAudio.currentTime = Math.min(globalAudio.duration, globalAudio.currentTime + soundIncrement);
    }
}

//resets the current sound to zero
function resetSound(): void {
    if (globalAudio != undefined)
        globalAudio.currentTime = 0;
}

//we begin by loading the sound database
soundIcon();