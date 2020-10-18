//are we recording sound for the slides
var recordingState = false;

//there are four possible states for the sound
//"recording" means that we are recording sound
//"play" means that we are playing sound
//"pause" means that we have paused playing sound
//null means none of the above
var soundState = null;





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
}

function currentSound() {
    return slideStack.top().node.sounds[slideStack.top().index];
}

function updateSoundIcon() {
    if (soundState == null) {

        if (currentSound() != null)
            soundIcon("play")
        else
            soundIcon(null);
    }
}

function soundRecord() {
    if (currentEvent() == null)
        userAlert("There are no events in this presentation")
    else
    if (userAgent() == "Safari") {
        userAlert("Sound recording does not work in Safari");
    } else {
        soundIcon("record");
        soundRecordCurrentEvent();
        soundState = "record";
    }
}

function playButton() {
    if (soundState == "record")
        soundStop();
    else if (soundState == "play")
        soundPause();
    else
        soundPlay();
}

var globalAudio;


function soundPlay() {
    if (soundState == "pause") {
        soundIcon("pause");
        globalAudio.play();
        soundState = "play";
    } else {
        soundStop();
        if (soundPlayCurrentEvent()) {
            soundState = "play";
            soundIcon("pause");
        }
    }

}

function soundPause() {
    soundIcon("play");
    globalAudio.pause();
    soundState = "pause";
}


function soundIcon(icon) {
    if (icon != null) {
        document.getElementById("play-button").style.opacity = 1;
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
        document.getElementById("play-button").style.opacity = 0;
}

function toggleSoundIcon(on) {
    if (on)
        document.getElementById("play-button").style.opacity = 1;
    else
        document.getElementById("play-button").style.opacity = 0;
}



//start recording the sound for a given event
function soundRecordCurrentEvent() {
    var top = slideStack.top();
    recordSound(top.node, top.index);
}

var mediaRecorder;

function recordSound(slide, index) {
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
                var audioURL = window.URL.createObjectURL(audioBlob);
                slide.sounds[index] = new Audio(audioURL);
                slide.sounds[index].addEventListener('ended', function () {
                    nextEvent(1);
                })
                if (!(slide.id in manifest.soundDict)) {
                    manifest.soundDict[slide.id] = {};
                }
                var filename = index.toString();
                manifest.soundDict[slide.id][index] = {
                    file: filename
                };
                console.log("sent sound " + filename);

                fr = new FileReader();
                fr.onload = function () {
                    var retmsg = {
                        type: 'wav',
                        slide: slide.id,
                        name: filename,
                        file: Array.from(new Uint8Array(this.result))
                    };

                    sendToServer(retmsg).then(x => {
                        if (soundState == null) {
                            sendSoundDatabase();
                        }
                    }).catch((error) => {
                        alert("Not connected to the slide server. Run it locally (it is called viewer/server.py).");
                    })


                };
                fr.readAsArrayBuffer(audioBlob);

            });

            // setTimeout(() => {
            //     mediaRecorder.stop();
            // }, 2000);
        });

}


function sendSoundDatabase() {
    sendToServer({
        type: 'json',
        slide: null,
        name: 'manifest',
        body: manifest
    }).
    catch((error) => {
        userAlert("Not connected to the slide server. Run it locally (it is called viewer/server.py).");
    });
}


function soundPlayCurrentEvent() {
    if (currentSound() != null) {
        globalAudio = currentSound();
        globalAudio.play();
        return true;
    } else {
        //if the sound is not in the database
        userAlert("No sounds for this event");
        soundStop();
        return false;
    }
}

function loadSounds(database) {

    function loader(filename, i, first = false) {
        var longname = fileName(database.id, filename + '.mp3');
        var audio = new Audio(longname);
        audio.addEventListener('ended', function () {
            nextEvent(1);
        })
        audio.addEventListener('loadeddata', (e) => {
            database.sounds[i] = audio;
            if (first) {
                soundIcon("play");
            }
        })
    }

    database.sounds = {};
    for (let i = 0; i <= database.events.length; i++) {
        var soundName = null;
        database.sounds[i] = null;
        if (database.id in manifest.soundDict)
            if (i in manifest.soundDict[database.id]) {
                var first = false;
                if (database.id == manifest.root && i == 0)
                    first = true;
                loader(manifest.soundDict[database.id][i].file, i, first);
            }
    }
}

//we begin by loading the sound database
soundIcon(null);
