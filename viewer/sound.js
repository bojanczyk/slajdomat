//are we recording sound for the slides
var recordingState = false;

//there are four possible states for the sound
//"recording" means that we are recording sound
//"play" means that we are playing sound
//"pause" means that we have paused playing sound
//null means none of the above
var soundState = null;


//a dictionary with the sound recordings
//sound with index i is played immediately after event with index i
var soundDict = {}



//stop playing or recording, thus making the sound state null
function soundStop() {
    if (soundState == "play") {
        document.getElementById("play-icon").classList.add("invisible");
        globalAudio.pause();
    }

    if (soundState == "record") {
        document.getElementById("record-icon").classList.add("invisible");
        mediaRecorder.stop();
        soundState = null;
        sendSoundDatabase();
    }
    if (soundState == "pause") {
        document.getElementById("pause-icon").classList.add("invisible");
        globalAudio.pause();
    }


    soundState = null;
}


function soundRecord() {
    soundStop();
    document.getElementById("record-icon").classList.remove("invisible");
    soundRecordCurrentEvent();
    soundState = "record";
}


var globalAudio = new Audio();

function initAudio() {
    /*
    console.log("dia");
    const soundEffect = new Audio();
soundEffect.src = 'slides/2:20.wav';
soundEffect.play();*/
    console.log("playing");
    document.getElementById("audioid").play().then(console.log("started playing"));
};

function soundPlay() {
    if (soundState == "pause") {
        document.getElementById("pause-icon").classList.add("invisible");
        globalAudio.play();
        soundState = "play";
        document.getElementById("play-icon").classList.remove("invisible");
    } else {
        soundStop();
        if (soundPlayCurrentEvent()) {
            soundState = "play";
            document.getElementById("play-icon").classList.remove("invisible");
        }
    }

}

function soundPause() {
    document.getElementById("play-icon").classList.add("invisible");
    document.getElementById("pause-icon").classList.remove("invisible");
    globalAudio.pause();
    soundState = "pause";
}


function getServer() {
    return 'http://localhost:8001';
}


//start recording the sound for a given event
function soundRecordCurrentEvent() {
    var top = slideStack.top();
    slide = top.node.id;
    const filename = slide + top.index + '.wav';
    recordSound(filename);
    if (!(slide in soundDict)) {
        soundDict[slide] = {};
    }
    soundDict[slide][top.index] = filename;

}

var mediaRecorder;
var soundFileName;

function recordSound(filename) {
    if (mediaRecorder != null) {
        if (mediaRecorder.state == "recording")
            mediaRecorder.stop();
    }

    navigator.mediaDevices.getUserMedia({
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

                fr = new FileReader();
                fr.onload = function () {
                    var retmsg = {
                        type: 'wav',
                        name: filename
                    };

                    fetch(getServer(), {
                        method: 'POST',
                        body: JSON.stringify(retmsg)
                    }).
                    then(response => {
                        if (!response.ok) {
                            throw "not connected";
                        } else {
                            console.log("sending sound", filename);
                            fetch(getServer(), {
                                method: 'POST',
                                body: this.result
                            })
                        }
                    }).
                    catch((error) => {
                        alert("Not connected to the slide server. Run it locally (it is called viewer/server.py).");
                    });
                };
                fr.readAsArrayBuffer(audioBlob);
            });

            // setTimeout(() => {
            //     mediaRecorder.stop();
            // }, 2000);
        });

}

function sendSoundDatabase() {
    fetch(getServer(), {
        method: 'POST',
        body: JSON.stringify({
            type: 'sounds',
            body: soundDict
        })
    }).
    catch((error) => {
        userAlert("Not connected to the slide server. Run it locally (it is called viewer/server.py).");
    });
}

function getSoundDatabase() {
    fetch('slides/sounds.json').
    then(function (res) {
        if (!(res.ok))
            throw "not connected";
        else
            return res.json();
    }).
    then(j => soundDict = j).
    catch((error) =>
        soundDict = {});
}






function soundPlayCurrentEvent() {
    var top = slideStack.top();
    if (top.node.id in soundDict)
        if (top.index in soundDict[top.node.id]) {
            console.log("playing " + soundDict[top.node.id][top.index]);
            const filename = 'slides/' + soundDict[top.node.id][top.index];
            playBackState = true;
            globalAudio.src = filename;
            globalAudio.play().catch(error => {
                if (soundsWork()) {
userAlert("Sound playing failed");
                }
                else{
    userAlert("Unfortunately, sounds work only in Chrome and Firefox, not Safari");
                }
                
                soundStop();
            });
            globalAudio.addEventListener('ended', function () {
                nextEvent(1);
            });
            return true;
        }
    //if the sound is not in the database
    userAlert("No sounds for this event");
    soundStop();
    return false;
}

//we begin by loading the sound database
getSoundDatabase();