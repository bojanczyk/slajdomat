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
    soundAdvance
}

import {
    manifest,
    userAgent,
    fileName,
    sendToServer,
    userAlert
} from './viewer.js'

import {
    curEvent,
    eventIndex,
    eventTree,
    changeEvent
} from "./event.js"

import {
    audioPlaying,
    makeTimeline,
    updateEventDuration,
    timelineButtons
} from './html.js'
import { glob } from 'glob';



//there are four possible states for the sound
//"recording" means that we are recording sound
//"play" means that we are playing sound
//"pause" means that we have paused playing sound
//null means none of the above
var soundState = null;
var globalAudio;



//stop playing or recording, thus making the sound state null
function soundStop() {
    if (soundState == "play") {
        globalAudio.pause();
    }

    if (soundState == "record") {
        soundState = null;
        mediaRecorder.stop();
    }
    if (soundState == "pause") {
        globalAudio.pause();
    }
    soundState = null;
    updateSoundIcon();
    timelineButtons();
}




function updateSoundIcon() {
    if (soundState == null) {
        if (curEvent.audio != null)
            soundIcon("play")
        else
            soundIcon(null);
    }
}

//start recoreding sound
function soundRecord() {
    recordSound(curEvent).then(x => {
        soundIcon("record");
        soundState = "record";
        timelineButtons();
    }).catch((error) => {
        soundState = null;
        soundIcon(null);
        if (userAgent() == "Safari") {
            userAlert("To enable Mediarecorder  in Safari, use Develop/Experimental features");
        } else
            userAlert(error)
        timelineButtons();

    })
}



//start playing the sound
function soundPlay() {
    if (soundState == "pause")
     {
         //if the current state is paused, then resume playing
        soundIcon("pause");
        globalAudio.play();
        soundState = "play";
    } else {
        // if the current state is not paused, then start playing the sound for the current event

        soundStop(); //I don't remember this is used, maybe  in case we are recording?
        if (soundPlayCurrentEvent()) {
            soundState = "play";
            soundIcon("pause");
        }
    }
    timelineButtons();


}

function soundPause() {
    soundIcon("play");
    globalAudio.pause();
    soundState = "pause";
    timelineButtons();
}



//set 
function soundIcon(icon) {
    if (icon != null) {
        document.getElementById("play-button").style.opacity = '1';
        if (icon == "pause") {
            document.getElementById("play-button").innerHTML = "pause"
        }
        if (icon == "play") {
            document.getElementById("play-button").innerHTML = "play_arrow"
        }
        if (icon == "record") {
            document.getElementById("play-button").innerHTML = "mic"
        }
    } else
        document.getElementById("play-button").style.opacity = '0';

    
    
}

function toggleSoundIcon(on) {
    if (on)
        document.getElementById("play-button").style.opacity = '1';
    else
        document.getElementById("play-button").style.opacity = '1';
}




var mediaRecorder;

function recordSound(event) {
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

            const audioChunks = [];
            mediaRecorder.addEventListener("dataavailable", event => {
                audioChunks.push(event.data);
            });

            mediaRecorder.addEventListener("stop", () => {
                const audioBlob = new Blob(audioChunks);
                var audioURL = window.URL.createObjectURL(audioBlob);
                event.audio = new Audio(audioURL);
                event.audio.addEventListener('ended', function () {
                    changeEvent(1);
                })



                const index = eventIndex(event);
                const shortName = index;
                const longName = fileName(event.parent.id, shortName);

                manifest.soundDict[event.parent.id][index] = {
                    file: shortName
                };

                console.log("sending sound " + longName);

                const fr = new FileReader();
                fr.onload = function (e) {
                    var x = e.target.result as ArrayBuffer;
                    var y = new Uint8Array(x);
                    var retmsg = {
                        type: 'wav',
                        slide: event.parent.id,
                        name: shortName,
                        file: Array.from(y)
                    };
                    sendToServer(retmsg)
                        .then(r => r.json())
                        .then(r => {
                            event.duration = r.duration;
                            updateEventDuration(event);
                        }).catch((e) => {
                            console.log(e);
                            userAlert("Could not send this sound to the server: " + longName)
                        });

                    /*
                    if (soundState == null)
                        sendSoundDatabase();
                        */
                };
                fr.readAsArrayBuffer(audioBlob);
            });
        });
}


const playbackRates = [1,1.5,2,0.7];
var playbackRateIndex = 0;
//the possible values are 1, 1.5, 2
function playbackRateChange() {

    playbackRateIndex = (playbackRateIndex + 1) % playbackRates.length;
    globalAudio.playbackRate = playbackRates[playbackRateIndex];
    document.getElementById('sound-speed').innerHTML= '×'+playbackRates[playbackRateIndex];
}



function soundPlayCurrentEvent(time = 0) {

    function currentSound() {
        return curEvent.audio;
    }

    if (currentSound() != null) {
        globalAudio = currentSound();
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

function soundFile(event) {
    const parent = event.parent.id;
    try {
        const index = eventIndex(event);
        const filename = manifest.soundDict[parent][index].file;
        return fileName(parent, filename + '.mp3');
    } catch (exception) {
        return null;
    }
}

function loadSounds(node) {
    if (!(node.id in manifest.soundDict))
        manifest.soundDict[node.id] = {};

    for (let child of node.children) {
        const filename = soundFile(child);
        if (filename != null) {
            const audio = new Audio(filename);
            audio.addEventListener('ended', function () {
                changeEvent(1);
            })
            audio.addEventListener('loadeddata', (e) => {
                child.audio = audio;
                if (child == eventTree.children[0]) {
                    soundIcon("play");
                }
            })

            audio.addEventListener('timeupdate', audioPlaying)
        }
    }
}

function gotoAudio(ratio) {
    console.log(ratio);
    if (globalAudio != null) {
        globalAudio.currentTime = globalAudio.duration * ratio;
    }
}

const soundIncrement = 10;
//advance the sound by 10 second if t=1 and by -10 seconds otherwise
function soundAdvance(t) {
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
soundIcon(null);