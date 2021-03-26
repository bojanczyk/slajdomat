export {
    soundStop,
    soundPlay,
    soundPause,
    soundRecord,
    loadSounds,
    soundPlayCurrentEvent,
    soundState,
    playbackRateChange,
    gotoAudio,
    updateSoundIcon,
    soundAdvance,
    soundDurations,
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
    curEvent,
    eventIndex,
    eventTree,
    changeEvent,
    parentEvent
} from "./event"

import {
    audioPlaying,
    updateEventDuration,
    timelineButtons,
    userAlert
} from './html'






//there are four possible states for the sound
//"recording" means that we are recording sound
//"play" means that we are playing sound
//"pause" means that we have paused playing sound
//null means none of the above



let soundState : SoundState = SoundState.None;
let globalAudio : HTMLAudioElement;

//for each events, gives the corresponding audio element
const audioDict : Map < SlideEvent, HTMLAudioElement > = new Map();

//for each events, gives the corresponding sound duration
const soundDurations : Map < SlideEvent, number > = new Map();

//stop playing or recording, thus making the sound state null
function soundStop(): void{
    if (soundState == SoundState.Play) {
        globalAudio.pause();
    }

    if (soundState == SoundState.Record) {
        soundState = SoundState.None;
        mediaRecorder.stop();
    }
    if (soundState == SoundState.Play) {
        globalAudio.pause();
    }
    soundState = SoundState.None;
    updateSoundIcon();
    timelineButtons();
}




function updateSoundIcon() : void {
    if (soundState == SoundState.None) {
        if (audioDict.get(curEvent) != undefined)
            soundIcon(SoundState.Play)
        else
            soundIcon(SoundState.None);
    }
}

//start recording sound
function soundRecord() : void {
    recordSound(curEvent).then(() => {
        soundIcon(SoundState.Record);
        soundState = SoundState.Record;
        timelineButtons();
    }).catch((error) => {
        soundState = SoundState.None;
        soundIcon(SoundState.None);
        if (userAgent() == "Safari") {
            userAlert("To enable Mediarecorder  in Safari, use Develop/Experimental features");
        } else
            userAlert(error)
        timelineButtons();

    })
}



//start playing the sound
function soundPlay() : void {
    if (soundState == SoundState.Pause)
     {
         //if the current state is paused, then resume playing
        soundIcon(SoundState.Pause);
        globalAudio.play();
        soundState = SoundState.Play;
    } else {
        // if the current state is not paused, then start playing the sound for the current event

        soundStop(); //I don't remember this is used, maybe  in case we are recording?
        if (soundPlayCurrentEvent()) {
            soundState = SoundState.Play;
            soundIcon(SoundState.Pause);
        }
    }
    timelineButtons();


}

function soundPause() : void {
    soundIcon(SoundState.Play);
    globalAudio.pause();
    soundState = SoundState.Pause;
    timelineButtons();
}


//set 
function soundIcon(icon : SoundState) {
    if (icon != SoundState.None) {
        document.getElementById("play-button").style.opacity = '1';
        if (icon == SoundState.Pause) {
            document.getElementById("play-button").innerHTML = "pause"
        }
        if (icon == SoundState.Play) {
            document.getElementById("play-button").innerHTML = "play_arrow"
        }
        if (icon == SoundState.Record) {
            document.getElementById("play-button").innerHTML = "mic"
        }
    } else
        document.getElementById("play-button").style.opacity = '0';

    
    
}

/*
function toggleSoundIcon(on : boolean) {
    if (on)
        document.getElementById("play-button").style.opacity = '1';
    else
        document.getElementById("play-button").style.opacity = '1';
}
*/




let mediaRecorder : MediaRecorder;

function recordSound(event : SlideEvent) : Promise<void> {
    if (mediaRecorder != null) {
        if (mediaRecorder.state == "recording")
            mediaRecorder.stop();
    }

    return navigator.mediaDevices.getUserMedia({
            audio: true
        })
        .then(stream => {
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.start();

            const audioChunks : Blob[] = [];
            mediaRecorder.addEventListener("dataavailable",  event => {
                audioChunks.push(event.data);
            });

            mediaRecorder.addEventListener("stop", () => {
                const audioBlob = new Blob(audioChunks);
                const audioURL = window.URL.createObjectURL(audioBlob);
                const audio = new Audio(audioURL);
                audioDict.set(event, audio);
                audio.addEventListener('ended', function () {
                    changeEvent(1);
                })

                const index = eventIndex(event);
                const shortName = index.toString();
                const longName = fileName(parentEvent(event).id, shortName);

                manifest.soundDict[parentEvent(event).id][index] = {
                    file: shortName
                };

                console.log("sending sound " + longName);

                const fr = new FileReader();
                fr.onload = function (e) {
                    const target = e.target as FileReader;
                    const x = target.result as ArrayBuffer;
                    const y = new Uint8Array(x);
                    const retmsg : MessageToServerSound = {
                        presentation : undefined,
                        type: 'wav',
                        slideId: parentEvent(event).id,
                        index : index, 
                        name: shortName,
                        file: Array.from(y)
                    };
                    sendToServer(retmsg)
                        .then(r => r.json() )
                        .then(r => {
                            if (r.status != 'Sound recorded successfully')
                                throw r.status;
                            soundDurations.set(event, r.duration);
                            updateEventDuration(event);
                        }).catch(() => {
                            userAlert("Failed to record sound.")
                        });

                };
                fr.readAsArrayBuffer(audioBlob);
            });
        });
}


const playbackRates = [1,1.5,2,0.7];
let playbackRateIndex = 0;
//the possible values are 1, 1.5, 2
function playbackRateChange() : void {

    playbackRateIndex = (playbackRateIndex + 1) % playbackRates.length;
    globalAudio.playbackRate = playbackRates[playbackRateIndex];
    document.getElementById('sound-speed').innerHTML= '×'+playbackRates[playbackRateIndex];
}



function soundPlayCurrentEvent(time = 0) : boolean {


    if (audioDict.get(curEvent) != undefined) {
        globalAudio = audioDict.get(curEvent);
        globalAudio.playbackRate = playbackRates[playbackRateIndex];
        if (time < 0)
        {
            //negative time is counted from the end of the audio
            globalAudio.currentTime = Math.max(0,globalAudio.duration - time);
        }
        else 
        {
            //non-negative time is counted in the usual way
            globalAudio.currentTime = time;
        }
        globalAudio.play();
        return true;
    } else {
        //if the sound is not in the database
        userAlert("No sounds for this event");
        soundStop();
        return false;
    }
}

function soundFile(event : SlideEvent) : string {
    const parent = parentEvent(event).id;
    try {
        const index = eventIndex(event);
        const filename = manifest.soundDict[parent][index].file;
        return fileName(parent, filename + '.mp3');
    } catch (exception) {
        return null;
    }
}

function loadSounds(node : SlideEvent) : void {
    if (!(node.id in manifest.soundDict))
        manifest.soundDict[node.id] = {};

    for (const child of node.children) {
        const filename = soundFile(child);
        if (filename != null) {
            const audio = new Audio(filename);
            // audio.autoplay=true;
            audio.addEventListener('ended', function () {
                changeEvent(1);
            });

            audio.addEventListener('loadeddata', () => {
                audioDict.set(child, audio);
                if (child == eventTree.children[0]) {
                    soundIcon(SoundState.Play);
                }
            })

            audio.addEventListener('timeupdate', audioPlaying)
        }
    }
}

function gotoAudio(ratio : number) : void {
    if (globalAudio != null) {
        globalAudio.currentTime = globalAudio.duration * ratio;
    }
}

const soundIncrement = 10;
//advance the sound by 10 second if t=1 and by -10 seconds otherwise
function soundAdvance(t : number) : void {
    if (t < 0) {
        if (globalAudio.currentTime < 1) 
        {//if we are close to the beginning then we move to the previous event
            globalAudio.pause();
            changeEvent(-1);
        }
        else 
        {
            globalAudio.currentTime = Math.max(0, globalAudio.currentTime - soundIncrement );
        }
    }
    else
    {
        globalAudio.currentTime = Math.min(globalAudio.duration, globalAudio.currentTime + soundIncrement );
    }
}


//we begin by loading the sound database
soundIcon(SoundState.None);