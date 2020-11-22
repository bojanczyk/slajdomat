export {
    manifest,
    userAlert,
    updatePageNumber,
    presentationURL,
    userAgent,
    fileName,
    sendToServer
}

import {
    createEventTree,
    curEvent,
    eventTree,
    numberOfPages,
    gotoPath,
    changeEvent
} from "./event.js"

// import { toggleSketchpad } from "./sketchpad.js";

import {
    soundStop,
    soundState,
    soundPlay, 
    soundPause,
    soundRecord,
    playbackRateChange
} from "./sound.js"


// const { gsap } = require("./gsap.min.js");
// import {gsap} from "gsap"



var manifest;

var slideStack = [];


var presentationDir; //the directory where the slides are
var presentationName; //the name of the slides
var presentationURL;



function getServer() {
    return 'http://localhost:8001';
}


//toggles the side panel on the left with the list of slides
function togglePanel(visible) {
    if (visible) {
        gsap.to("#left-panel", {
            width: "20%",
            duration: 0.3
        });
    } else {
        gsap.to("#left-panel", {
            width: "0%",
            duration: 0.3
        });
    }
}

//displays a panel for a short time
function shortDisplay(panel) {
    let tl = gsap.timeline();
    panel.style.display = 'inherit';
    tl.to(panel, {
        opacity: "100%",
        duration: 0.1
    }).to(panel, {
        duration: 2
    }).to(panel, {
        opacity: "0",
        duration: 1
    });
    tl.eventCallback("onComplete", function () {
        panel.style.display = 'none';
    });
}

//displays the help
function helpPanel() {
    shortDisplay(document.getElementById("help-panel"));
}

//displays an alert for the user at the bottom of the screen
function userAlert(text) {
    document.getElementById("text-alert").innerHTML = text;
    shortDisplay(document.getElementById("text-alert-box"));
}



function nextPreviousArrows() {


}



//update the page number in the corner
function updatePageNumber() {
    document.getElementById("page-count-enumerator").innerHTML = curEvent.pageNumber;
    document.getElementById("page-count-denominator").innerHTML = " / " + numberOfPages;

    // the "previous" arrow should be invisible at the first event of the first slide
    // analogously for the "next" arrow
    if (curEvent == eventTree.children[0])
        document.getElementById("prev-event").style.visibility = "hidden";
    else
        document.getElementById("prev-event").style.visibility = "visible";

    if (curEvent.type == 'finish' && curEvent.parent == eventTree)
        document.getElementById("next-event").style.visibility = "hidden";
    else
        document.getElementById("next-event").style.visibility = "visible";
}


/*

//we use a top method for accessing a stack
if (!Array.prototype.top) {
    Array.prototype.top = function () {
        return this[this.length - 1];
    };
};
*/


function playButton() {
    if (soundState == "record")
        soundStop();
    else if (soundState == "play")
        soundPause();
    else
        soundPlay();
}


function nextButton() {
    if (soundState != "record")
        soundStop();
    changeEvent(1);
}

function prevButton() {
    soundStop();
    changeEvent(-1);
}


/*
// I don't know why this does not work
function scrollListener(event){
    console.log('scroll');
}
document.addEventListener('scroll', scrollListener );
*/


function slideDirectory(name) {
    return manifest.slideDict[name]
}





//check the user agent for chrome
//at the moment, this is not used
function userAgent() {
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




//gives the name for a file in a slide, in the current presentation
//the slide parameter could be null, for top-level information in the presentation.
function fileName(slide, file) {

    if (slide == null) {
        return presentationDir + '/' + file;
    } else
        return presentationDir + '/' + manifest.slideDict[slide] + '/' + file;
}

//send an object to the server
function sendToServer(msg) {
    msg.presentation = presentationName;
    var json = JSON.stringify(msg);
    return fetch('http://localhost:8001', {
        method: 'POST',
        body: json
    }).
    then(response => {
        console.log(response);
        if (!response.ok) {
            throw "not connected";
        }
        else return response;
    })
}

//get a json file and parse it
function fetchJSON(filename) {
    return fetch(filename).
    then(function (res) {
        if (!(res.ok))
            throw "not connected";
        else
            return res.json();
    }).
    catch((error) => {
        userAlert("Could not load slide file " + filename);
        return null;
    });
}




function getPathFromURL() {
    var path = [];
    try {
        const pathstring = (new URL(window.location.href)).searchParams.get('path').split('/');
        while (pathstring.length > 0) {
            let index = pathstring.pop();
            if (index != '')
                path.push(parseInt(index));
        }
        return path;

    } catch (e) {
        return [0]; // default path is the first event of the root
    }
}


// the main event dispatcher
function keyListener(event) {
    if (event.keyCode == '190') {
        // >
        playbackRateChange(0.2);
    }

    if (event.keyCode == '188') {
        // <
        playbackRateChange(-0.2);

    }

    if (event.keyCode == '39') {
        //arrow right
        nextButton();

    }
    if (event.keyCode == '37') {
        //arrow left
        prevButton();
    }

    if (event.keyCode == '32') {
        //space bar
        playButton();
    }

    


    if (event.keyCode == '82') {
        // 'r'
        if (soundState == "record")
            soundStop();
        else {
            soundStop();
            soundRecord();
        }
    }
}


//startup code
//it reads the manifest, which contains the root slide, the number of slides, the sounds, and then it loads the first slide
window.onload = function () {

    // helpPanel();
    document.addEventListener("keydown", keyListener);
    document.addEventListener('mousemove', function (e) {
        if (e.clientX < 20)
        togglePanel(true);
    })
    document.getElementById('close-panel').addEventListener('click', function () {
        togglePanel(false)
    });
    document.getElementById('prev-event').addEventListener('click', prevButton);
    document.getElementById('next-event').addEventListener('click', nextButton);
    document.getElementById('play-button').addEventListener('click', playButton);

    
    let url = new URL(window.location.href);
    presentationURL= url.searchParams.get('slides')
    presentationDir = 'slides/'+ presentationURL;
    fetchJSON(presentationDir + '/manifest.json').then(j => {
            if (j == null)
                throw "The manifest is missing for the presentation"

            manifest = j;
            presentationName = manifest.presentation;
            document.title = presentationName;
            

            const path = getPathFromURL();
            createEventTree();
            gotoPath(path);
            // toggleSketchpad(eventTree);

        }) //.catch((e) => userAlert(e))
}
