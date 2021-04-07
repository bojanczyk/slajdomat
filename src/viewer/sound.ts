export {
    soundStop,
    soundPlay,
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
    soundPaused,
    endOfSound,
    cacheFlush
}

import {
    SoundState,
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
    soundIcon,
    timelineHTML,
    userAlert
} from "./html"
import { allSteps, currentStep, moveHead, OverlayStep, Step, timeline, zoomsIn, ZoomStep } from './timeline'








//there are three possible states for the sound
//"recording" means that we are recording sound
//"play" means that we are playing sound
//"none"  means none of the above

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

//to get new sounds, we use a trick where the audio name is extended with meaningless, but changing, string parameters
let cacheFlushString = ''
function cacheFlush(): void {
    cacheFlushString += '?' + Date.now();
}

function soundPaused(): boolean {
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
}





//start recording sound
function soundRecord(): void {
    recordSound(currentStep()).then(() => {
        soundState = SoundState.Record;
        soundIcon();
    }).catch((error) => {
        soundState = SoundState.None;
        soundIcon();
        if (userAgent() == "Safari") {
            userAlert("To enable Mediarecorder  in Safari, use Develop/Experimental features");
        } else
            userAlert(error)
    })
}



function afterSound(): void {
    if (timeline.future.length > 0) {
        //there is something to still play
        moveHead(1);
        soundPlay();
    }
    else {
        //we have finished playing the last sound
        soundStop();
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
        audio.addEventListener('ended', afterSound)

        const where = soundFile(step);


        const fr = new FileReader()
        fr.onload = function (e) {
            const target = e.target as FileReader
            const x = target.result as ArrayBuffer
            const y = new Uint8Array(x)
            const retmsg: MessageToServerSound = {
                presentation: undefined,
                type: 'wav',
                slideId: where.slide,
                eventId: where.eventId,
                file: Array.from(y),
                live : false
            }
            sendToServer(retmsg)
                .then(r => r.json())
                .then(r_1 => {
                    if (r_1.status != 'Sound recorded successfully')
                        throw r_1.status;
                    if (soundState == SoundState.None) {
                        {
                            //add some salt to the audio urls to flush the cache
                            cacheFlush();
                            initSoundTimeline();
                            timelineHTML();
                        }
                    }
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



function soundPlay(mode: 'normal' | 'fromEnd' = 'normal'): boolean {
    try {
        const audio = sounds.get(currentStep()).audio;
        if (audio == undefined)
            throw 'no audio';


        globalAudio = audio;
        globalAudio.playbackRate = playbackRates[playbackRateIndex];

        if (mode == 'fromEnd')
            globalAudio.currentTime = Math.max(0, globalAudio.duration - 10);

        globalAudio.play();
        soundState = SoundState.Play;
        soundIcon();
        return true;
    }
    catch (e) {
        //if the sound is not in the database
        userAlert("No sounds for this event");
        soundStop();
        return false;
    }
}


function soundFile (step : Step) :  {slide : string, eventId : string} {
    const retval  = {slide : undefined as string, eventId : undefined as string};
    if (step instanceof OverlayStep) {
        retval.slide = parentEvent(step.overlays[0]).id;
        retval.eventId = step.overlays[0].eventId;
    }
    else if (step instanceof ZoomStep) {
        retval.slide = step.source.id;
        if (zoomsIn(step)) 
            retval.eventId = step.target.eventId;
        else 
            retval.eventId = 'finish';        
    }
    else {
        //the last step
        retval.slide = manifest.tree.id;
        retval.eventId = 'finish';
    }
    return retval;
}



//for each step in the timeline, get its file name and duration
function initSoundTimeline(): void {

    sounds.clear();
    totalSoundDuration = 0;
    for (const step of allSteps()) {
        //try to get the sound information
        try {
            const where = soundFile(step);
            const duration = manifest.soundDict[where.slide][where.eventId];
            sounds.set(step, {
                filename: fileName(where.slide, where.eventId + '.mp3' + cacheFlushString),
                audio: undefined,
                duration: duration,
                previousDuration: totalSoundDuration
            })
            totalSoundDuration += duration;
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
            audio.addEventListener('ended', afterSound);

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
            resetSound();
            moveHead(-1);
            soundPlay('fromEnd')

        }
        else {
            globalAudio.currentTime = Math.max(0, globalAudio.currentTime - soundIncrement);
            soundIcon();
        }
    }
    else {
        globalAudio.currentTime = Math.min(globalAudio.duration - 0.01, globalAudio.currentTime + soundIncrement);
    }
}

//resets the current sound to zero
function resetSound(): void {
    if (globalAudio != undefined) {
        globalAudio.pause();
        globalAudio.currentTime = 0;
        audioPlaying(globalAudio);
        soundIcon();
    }
}

function endOfSound(): boolean {
    if (timeline.future.length == 0 && globalAudio != undefined && globalAudio.currentTime == globalAudio.duration)
        return true;
    else
        return false;

}

