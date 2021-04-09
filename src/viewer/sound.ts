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
    cacheFlush,
    SoundState,
    soundLive,
    endRecording,
    stepAudio
}

import {
    MessageToServerSound,
    MessageToServerLive,
    EventDescription,
    LiveRecording
} from './types'

import {
    getManifest,
    manifest,
    userAgent
} from './viewer'

import {
    fileName,
    sendToServer
} from './files'

import {
    eventDescription,
    parentEvent,
} from "./event"

import {
    audioPlaying,
    soundIcon,
    timelineHTML,
    userAlert
} from "./html"
import { allSteps, currentStep, moveHead, OverlayStep, Step, timeline, zoomsIn, ZoomStep } from './timeline'






enum SoundState {
    Recording = "Record",
    Live = "Live",
    Play = "Play",
    None = "Right",
}


//there are three possible states for the sound
//"recording" means that we are recording sound
//"play" means that we are playing sound
//"none"  means none of the above

let soundState: SoundState = SoundState.None;
// let globalAudio: HTMLAudioElement;

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
    const audio = stepAudio(currentStep());
    if (audio != undefined && audio.currentTime > 0)
        return true;
    else
        return false;
}


//stop playing or recording, thus making the sound state none
function soundStop(): void {
    if (soundState == SoundState.Play) {
        const audio = stepAudio(currentStep());
        if (audio != undefined) {
            audio.pause();
            audioPlaying(audio); //updates the timeline
        }
    }

    if (soundState == SoundState.Recording || soundState == SoundState.Live) {
        endRecording(0);
    }

    soundState = SoundState.None;
    soundIcon();
}





//start recording sound
function soundRecord(live: 'live' | 'event'): void {

    async function promiseSound(step: Step): Promise<void> {
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

            const fr = new FileReader()
            fr.onload = function (e) {
                const target = e.target as FileReader
                const x = target.result as ArrayBuffer
                const y = new Uint8Array(x)
                const retval: MessageToServerSound = {
                    presentation: undefined,
                    type: 'wav',
                    forWhat: undefined,
                    file: Array.from(y),
                }

                if (live == 'event')
                    retval.forWhat = eventDescription(step);
                else {
                    retval.forWhat = { type: 'step', description: undefined };
                    switch (lastDirection) {
                        case 1:
                            retval.forWhat.description = step.description();
                            break;
                        case -1:
                            retval.forWhat.description = step.reverse().description();
                            break;
                        case 0:
                            retval.forWhat.description = { type: 'last' };
                    }
                }

                sendToServer(retval)
                    .then(r => r.json())
                    .then(r_1 => {
                        if (r_1.status != 'Sound recorded successfully')
                            throw r_1.status;
                        if (soundState == SoundState.None) {
                            {
                                //if sound recording has finished, then we reload the timeline

                                //we reload the manifest to get the new verion of the sound dictionary
                                getManifest().then(m => {
                                    manifest.soundDict = m.soundDict;
                                    //add some salt to the audio urls to flush the cache
                                    cacheFlush();
                                    initSoundTimeline(undefined);
                                    timelineHTML();
                                    loadSound(currentStep());
                                })
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

    promiseSound(currentStep()).then(() => {
        if (live == 'live')
            soundState = SoundState.Live
        else
            soundState = SoundState.Recording;
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
        resetSound();
        //there is something to still play
        moveHead(1);
        soundPlay();
    }
    else {
        //we have finished playing the last sound
        soundStop();
    }
}


let lastDirection: -1 | 0 | 1;
function endRecording(direction: -1 | 0 | 1) {
    lastDirection = direction;
    if (mediaRecorder != null) {
        if (mediaRecorder.state == "recording")
            mediaRecorder.stop();
    }
}

let mediaRecorder: MediaRecorder;




//starts a new live recording 
function soundLive(): void {

    const msg: MessageToServerLive = {
        type: 'startLive',
        presentation: manifest.presentation,
    }
    sendToServer(msg);
    soundRecord('live');
    soundIcon();

}

const playbackRates = [1, 1.5, 2, 0.7];
let playbackRateIndex = 0;
//the possible values are 1, 1.5, 2
function playbackRateChange(): void {

    playbackRateIndex = (playbackRateIndex + 1) % playbackRates.length;
    const audio = stepAudio(currentStep());
    if (audio != undefined)
        audio.playbackRate = playbackRates[playbackRateIndex];
    document.getElementById('sound-speed').innerHTML = '×' + playbackRates[playbackRateIndex];
}



function soundPlay(mode: 'normal' | 'fromEnd' = 'normal'): boolean {
    try {
        const audio = stepAudio(currentStep());
        if (audio == undefined)
            throw 'no audio';
        audio.playbackRate = playbackRates[playbackRateIndex];
        if (mode == 'fromEnd')
            audio.currentTime = Math.max(0, audio.duration - 10);
        audio.play();
        soundState = SoundState.Play;
        soundIcon();
        return true;
    }
    catch (e) {
        //if the sound is not in the database
        if (sounds.get(currentStep()) != undefined)
            userAlert("No sounds for this event");
        soundStop();
        return false;
    }
}




//for each step in the timeline, get its file name and duration
function initSoundTimeline(recording: LiveRecording): void {

    const searchParams = (new URL(window.location.href)).searchParams;
    //this makes sure that the cache is ignored when downloading sounds, if a nocache string is present in the url
    if (searchParams.get('nocache') != undefined)
        cacheFlush();


    sounds.clear();
    totalSoundDuration = 0;
    let i = 0;
    for (const step of allSteps()) {
        //try to get the sound information
        try {
            const retval: SoundInfo = {
                filename: undefined,
                audio: undefined,
                duration: undefined,
                previousDuration: totalSoundDuration
            }

            if (recording == undefined) {
                //this is a timeline based on the event tree
                const where = eventDescription(step);
                retval.duration = manifest.soundDict[where.slideId][where.eventId];
                retval.filename = fileName(where.slideId, where.eventId + '.mp3' + cacheFlushString)
            }
            else {
                //this is a timeline from a recording
                retval.duration = recording.steps[i].duration;
                retval.filename = `${recording.dir}/${i}.mp3${cacheFlushString}`
                i++;
            }
            if (retval.duration == undefined)
                throw 'no duration'

            sounds.set(step, retval)
            totalSoundDuration += retval.duration;
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
    const audio = stepAudio(currentStep());
    if (audio != null) {
        audio.currentTime = audio.duration * ratio;
    }
}

const soundIncrement = 10;
//advance the sound by 10 second if t=1 and by -10 seconds otherwise
function soundAdvance(t: 1 | -1): void {
    const audio = stepAudio(currentStep());
    if (t < 0) {
        if (audio.currentTime < 1) {//if we are close to the beginning then we move to the previous event
            resetSound();
            moveHead(-1);
            soundPlay('fromEnd')

        }
        else {
            audio.currentTime = Math.max(0, audio.currentTime - soundIncrement);
            soundIcon();
        }
    }
    else {
        audio.currentTime = Math.min(audio.duration - 0.01, audio.currentTime + soundIncrement);
    }
}

//returns the audio for this step
function stepAudio(step: Step): HTMLAudioElement {
    const sound = sounds.get(step);
    if (sound != undefined)
        return sound.audio;
    else
        return undefined;
}

//resets the current sound to zero
function resetSound(): void {
    const audio = stepAudio(currentStep());
    if (audio != undefined) {
        audio.pause();
        audio.currentTime = 0;
        audioPlaying(audio);
        soundIcon();
    }
}

function endOfSound(): boolean {
    const audio = stepAudio(currentStep());

    if (timeline.future.length == 0 && audio != undefined && audio.currentTime == audio.duration)
        return true;
    else
        return false;

}

