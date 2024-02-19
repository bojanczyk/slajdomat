export {
    loadNearbySounds, initSoundTimeline, soundState, stopSound, startRecording, soundIcon, playAudio, endRecording, canPlaySound, soundAdvance, loadSound
}

import {
    SoundDict,
    State
} from '../common/types'

import {
    getManifest,
    manifest,
    serverConnected
} from './viewer'

import {
    sendToServer
} from './files'


import {
    progressCache,
    timelineFailedLoad,
    timelineHTML,
    timelineRecording,
    updateTimeCounter,
    userAlert
} from "./html"
import { StateMap, currentState, decodeState, encodeState, moveHead, sameState, timeline } from './timeline'
import { formatTime } from './presenter-tools'
import { MessageToServerSound } from '../common/messages-viewer-server'




//there are three possible states for the sound
//"recording" means that we are recording sound
//"play" means that we are playing sound
//"none"  means none of the above
type SoundState = "recording" | "playing" | "none";
let soundState: SoundState = 'none';




type SoundInfo = {
    previousDuration: number,
    audio: HTMLAudioElement
}

// let sounds: SoundInfo[] = undefined;


function timelineAudio(index: number): HTMLAudioElement {
    return timeline.frames[index].audio;
}


//to get new sounds, we use a trick where the audio name is extended with meaningless, but changing, string parameters
let cacheFlushString = ''
function cacheFlush(): void {
    cacheFlushString += '?' + Date.now();
}


let audioChunks: Blob[] = undefined;
let mediaRecorder: MediaRecorder;


function endRecording(): void {

    if (mediaRecorder == null || mediaRecorder.state != 'recording') return;

    timelineRecording(timeline.current, 'not recording');

    const retval: MessageToServerSound = {
        presentation: undefined,
        type: 'wav',
        forWhat: encodeState(currentState()),
        file: undefined
    }

    mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks)
        const fr = new FileReader()
        fr.onload = function (e) {
            async function send() {
                try {
                    const serverResponse = await sendToServer(retval);
                    if (serverResponse.status != 'sound recorded')
                        throw serverResponse.status;
                    else
                        if (soundState == 'none') {
                            {
                                //if sound recording has finished, then we reload the timeline
                                //we reload the manifest to get the new version of the sound dictionary
                                const man = await getManifest()
                                manifest.defaultTimeLine = man.defaultTimeLine;
                                //add some salt to the audio urls to flush the cache
                                cacheFlush();
                                initSoundTimeline();
                                loadNearbySounds();
                                timelineHTML();
                            }
                        }
                } catch (e) {
                    console.log(e);
                    userAlert("Failed to record sound. " + e)
                }
            }


            const y = new Uint8Array(fr.result as ArrayBuffer)
            retval.file = Array.from(y);
            send();
        }
        fr.readAsArrayBuffer(audioBlob)
    }

    mediaRecorder.stop();
    const mediaStream = mediaRecorder.stream;
    for (const track of mediaStream.getTracks()) {
        track.stop();
    }

}

//start recording sound
async function startRecording(): Promise<void> {
    if (serverConnected() == false) {
        userAlert("Cannot record sound without the app running");
        return;
    }

    try {

        timelineRecording(timeline.current, 'recording');
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true
        })
        mediaRecorder = new MediaRecorder(stream)
        audioChunks = [];
        mediaRecorder.start()
        mediaRecorder.addEventListener("dataavailable", event => {
            audioChunks.push(event.data)
        })
        soundState = 'recording';
    }
    catch (error) {
        soundState = 'none'
        userAlert("Failed to record sound. " + error);

    }
}







const playbackRates = [1, 1.5, 2, 0.7];
let playbackRateIndex = 0;
//the possible values are 1, 1.5, 2
function playbackRateChange(): void {

    playbackRateIndex = (playbackRateIndex + 1) % playbackRates.length;
    const audio = timeline.frames[timeline.current].audio;
    if (audio != undefined)
        audio.playbackRate = playbackRates[playbackRateIndex];
    document.getElementById('sound-speed').innerHTML = '×' + playbackRates[playbackRateIndex];
}




function findInsoundList(state: State, dict: SoundDict): number {
    return dict.findIndex((s) => sameState(decodeState(s.key), state));
}



//for each step in the timeline, get its file name and duration
function initSoundTimeline(): void {

    const defaultSounds: StateMap<string> = new StateMap();
    const defaultDurations: StateMap<number> = new StateMap();

    for (const x of manifest.defaultTimeLine) {
        const state = decodeState(x.state);
        if (state != undefined) {
            defaultSounds.set(state, x.soundFile);
            defaultDurations.set(state, x.soundDuration);
        }
    }

    for (const step of timeline.frames) {
        step.soundDuration = defaultDurations.get(step.state);
        step.soundFile = defaultSounds.get(step.state);
    }

    const searchParams = (new URL(window.location.href)).searchParams;
    //this makes sure that the cache is ignored when downloading sounds, if a nocache string is present in the url
    if (searchParams.get('nocache') != undefined)
        cacheFlush();

    let totalSoundDuration = 0;

    for (let i = 0; i < timeline.frames.length; i++) {
        timeline.frames[i].audio = undefined;
        timeline.frames[i].previousDuration = totalSoundDuration;
        if (timeline.frames[i].soundDuration != undefined)
            totalSoundDuration += timeline.frames[i].soundDuration;
    }


}


function loadNearbySounds(): void {
    //how far is nearby?
    const loadRadius = 3;

    loadSound(timeline.current);

    for (let i = 1; i <= loadRadius; i++) {
        if (timeline.current + i < timeline.frames.length)
            loadSound(timeline.current + i);
        if (timeline.current - i >= 0)
            loadSound(timeline.current - i);
    }
}

//load the sound for the given index
async function loadSound(index: number): Promise<HTMLAudioElement> {
    const sound = timeline.frames[index];

    if (sound == undefined || sound.soundFile == undefined) {
        return undefined;
    }
    else {
        if (sound.audio != undefined)
            return sound.audio
        else {
            return new Promise((resolve, reject) => {
                const audio = new Audio(timeline.frames[index].soundFile);
                audio.onloadeddata = () => {
                    timeline.frames[index].audio = audio;
                    resolve(audio);
                }
                audio.addEventListener('timeupdate', updateTimeCounter)
                audio.onerror = (e) => {
                    console.log('failed to load sound ' + sound.soundFile + ' ' + e);
                    timeline.frames[index].soundFile = undefined;
                    timeline.frames[index].audio = undefined;
                    timeline.frames[index].soundDuration = undefined;
                    timelineHTML();
                    resolve(undefined)
                };
            });
        }
    }
}

//advance the sound by 5 seconds if t=1 and by -5 seconds otherwise
//return true if we have reached the end of the sound, and pause the sound
function soundAdvance(t: number): { frame: number, time: number } {

    function endTime(i: number) {
        if (timeline.frames[i].soundDuration == undefined)
            return timeline.frames[i].previousDuration;
        else
            return timeline.frames[i].previousDuration + timeline.frames[i].soundDuration;
    }

    const audio = timeline.frames[timeline.current].audio;
    const currentTime = audio.currentTime + timeline.frames[timeline.current].previousDuration;

    let i: number;
    if (t >= 0) {
        i = timeline.current;
        while (i < timeline.frames.length - 1 && timeline.frames[i].audio != undefined && currentTime + t > endTime(i)) {
            i++;
        }

    }
    else {
        i = timeline.current;
        while (i > 0 && timeline.frames[i].audio != undefined && currentTime + t < timeline.frames[i].previousDuration) {
            i--;
        }
    }
    let retval = {
        frame: i,
        time: 0
    }
    if (timeline.frames[i].audio != undefined) {
        retval.time = currentTime + t - timeline.frames[i].previousDuration;
        if (retval.time < 0)
            retval.time = 0;
        if (retval.time > timeline.frames[i].audio.duration)
            retval.time = timeline.frames[i].audio.duration;
    }
    return retval;
}



async function whenFinishedPlaying() {
    if (timeline.current < timeline.frames.length - 1) {
        if (!canPlaySound(timeline.current + 1))
            stopSound();
        moveHead(1);
    }
    else
        stopSound();

}

function playAudio(audio: HTMLAudioElement, how: 'play' | 'pause'): void {

    if (how == 'pause') {
        if (audio != undefined) {
            audio.pause();
            audio.removeEventListener('ended', whenFinishedPlaying);
        }
        soundState = 'none';
    }
    else {
        if (audio != undefined) {
            audio.play();
            audio.addEventListener('ended', whenFinishedPlaying);
        }
        soundState = 'playing';
    }
}


//stop playing or recording, thus making the sound state none
function stopSound(): void {
    if (soundState == 'recording') {
        endRecording();
    }
    soundState = 'none'
}



// ************ html for sounds ***************




function initSoundHTML(): void {
    document.getElementById('sound-speed').addEventListener('click',
        playbackRateChange);
    // soundIcon();
}

initSoundHTML();




// the timeline uses two kinds of display, depending on the whether the sound is playing, or not
function updateTimelineDisplay(): void {
    if (soundState == 'playing') {
        document.getElementById('progress-panel').classList.add('playing');
    } else {
        document.getElementById('progress-panel').classList.remove('playing');
    }
}

//is it possible to play a sound
function canPlaySound(frame: number): boolean {
    if (frame == undefined)
        return false;
    const sound = timeline.frames[frame];
    if (sound == undefined)
        return false;
    if (sound.audio == undefined)
        return false;


    // even if the sound exists, the presentation could be finished
    if ((sound.audio.currentTime == sound.audio.duration) && (frame == timeline.frames.length - 1))
        return false;
    return true;
}

//choose the right button for playing sound
function soundIcon(): void {
    const playButton = document.getElementById("play-button");

    switch (soundState) {
        case 'playing':
            playButton.style.visibility = 'visible';
            playButton.innerHTML = "pause"
            break;
        case 'none':
            if (canPlaySound(timeline.current)) {
                playButton.style.visibility = 'visible';
                playButton.innerHTML = "play_arrow"
            }
            else {
                playButton.style.visibility = 'hidden';
            }
            break;
        case 'recording':
            playButton.style.visibility = 'visible';
            playButton.innerHTML = "mic"
            break;
    }
}

// this code measures the volume of the microphone
// we might use it to block slide changing when the volume is too high
// but it is not used now
async function volumeCheck() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    const audioContext = new AudioContext();
    const mediaStreamAudioSourceNode = audioContext.createMediaStreamSource(stream);
    const analyserNode = audioContext.createAnalyser();
    mediaStreamAudioSourceNode.connect(analyserNode);

    const pcmData = new Float32Array(analyserNode.fftSize);
    const onFrame = () => {
        analyserNode.getFloatTimeDomainData(pcmData);
        let sumSquares = 0.0;
        for (const amplitude of pcmData) { sumSquares += amplitude * amplitude; }
        console.log(Math.sqrt(sumSquares / pcmData.length));
        window.requestAnimationFrame(onFrame);
    };
    window.requestAnimationFrame(onFrame);
}

