export {
    createTreeHTML,
    makeTimeline,
    markSeen,
    audioPlaying,
    updateEventDuration,
    timelineButtons,
    totalSoundDuration,
    initPanels
}

import {
    openPanelTree,
    gotoEvent,
    eventTree,
    curEvent
} from './event.js'


import {
    manifest,
    playButton,
    prevButton,
    nextButton
} from './viewer.js'

import {
    gotoAudio,
    playbackRateChange,
    soundState
} from './sound.js'
import { strict } from 'assert';

var totalSoundDuration = 0;

//create the tree list of the slides and event that is in the unfolding side panel on the left
function createTreeHTML() {




    function createTreeHTMLRec(event) {

        function eventClicked(e) //what happens when an event is clicked in the control panel
        {
            if (e.target.nodeName == 'I') {
                //the icon was clicked
                if (event.type == 'child') // for child events, we fold/unfold the list of child events
                {
                    event.divopen = !event.divopen;
                    openPanelTree(event, event.divopen);
                }
            } else {
                //the name of the event was clicked
                gotoEvent(event);
            }
        }
        event.divopen = false;
        if (event.parent == null) {
            event.subdiv = document.getElementById('slide-stack');
            event.div = null;
        } else {
            var parentDiv = event.parent.subdiv;
            event.div = document.createElement("div");
            event.div.classList.add("tree-view-item");
            event.div.classList.add("tree-view-item-loading");

            var icon;
            if (event.disabled) {
                event.div.classList.add("disabled-event");
            }

            if (event.type == "show")
                icon = "visibility";
            if (event.type == "hide")
                icon = "visibility_off";
            if (event.type == "child") {
                icon = "chevron_right";
            }

            event.div.innerHTML = "<i class=\"material-icons\">" + icon + "</i> " + event.name;

            event.div.addEventListener('click', eventClicked);
            parentDiv.appendChild(event.div);


            if (event.type == 'child') {
                event.subdiv = document.createElement("div");
                event.subdiv.classList.add("slide-stack");
                event.subdiv.classList.add("slide-stack-hidden");
                parentDiv.appendChild(event.subdiv);
            }
        }

        //recursively call for all children
        if (event.type == 'child') {
            for (let child of event.children)
                if (child.type != 'finish')
                    createTreeHTMLRec(child)
        }
    }
    createTreeHTMLRec(eventTree);

}

const noSoundDuration = 10;

//updates the duration of an event; the update concerns the timeline
function updateEventDuration(event) {
    if (event.duration != null)
                {
                    event.timeline.style.flexGrow = event.duration;
                    event.timeline.classList.remove('nosound');
                }
            else
                {
                    event.timeline.style.flexGrow = noSoundDuration ;
                    event.timeline.classList.add('nosound');
                }

}

//creates the timeline at the bottom of the screen
function makeTimeline() {

   

    //for each element, find the duration of its audio
    function computeDuration(event) {
        for (let i = 0; i < event.children.length; i++) {
            event.children[i].soundOffset = totalSoundDuration;
            try {
                event.children[i].duration = manifest.soundDict[event.id][i].duration;
                totalSoundDuration += event.children[i].duration;
            } catch (e) {
                event.children[i].duration = null;
                totalSoundDuration += noSoundDuration;
            }
            

            if (event.children[i].type == 'child')
                computeDuration(event.children[i]);
        }

    }

    //create a div in the timeline for every non-root element of the 
    function makeTimelineRec(event) {
        if (event.parent != null) {
            var big;
            var small;
            big = document.createElement('div');
            small = document.createElement('div');
            small.classList.add('progress-filler');
            small.style.width = '0%';
            big.appendChild(small);
            timeLine.appendChild(big);
            

            big.addEventListener('click', function (e) {
                timelineClicked(event,e);
            })
            event.timeline = big;
            updateEventDuration(event);
        }
        if (event.type == 'child')
            for (let child of event.children)
                makeTimelineRec(child);
    }

    const timeLine = document.getElementById('progress-line');
    computeDuration(eventTree);
    makeTimelineRec(eventTree);

}

//the timeline for an event was clicked; with the ratio being the indicating the click position inside the timeline
function timelineClicked(event, e) {

    var target = e.target;
    if (target.classList.contains('progress-filler'))
    {
        target= target.parentNode;
    }
    var a = e.offsetX;
    var b = target.offsetWidth;
    
    if (event == curEvent)
    {
        // console.log('curevent',a,b);
        gotoAudio(a/b);
    }
    else 
    {
        // console.log('other event');
        gotoEvent(event)
    }
}

//mark the tree view and timeline for an event as seen/unseen
function markSeen(event, seen) {
    if (seen) {
        if (event.div != null) //final events have no div
            event.div.classList.add('tree-view-item-seen');
        event.timeline.firstChild.style.width = "100%";        
        event.timeline.classList.add('seen');
    } else {
        if (event.div != null) //final events have no div
            event.div.classList.remove('tree-view-item-seen');
        event.timeline.firstChild.style.width = "0%";
        event.timeline.classList.remove('seen');
    }

}

//inputs number of seconds and formats it in mm:ss format
function formatTime(time) {
const minutes = Math.floor(time / 60);
const seconds = Math.floor(time) % 60;
if (seconds < 10)
return minutes+':0'+seconds
else 
return minutes+':'+seconds;
}

//this function is called periodically when the audio is playing, and it updates the position of the slider
function audioPlaying(e) {
    const curTime = e.target.currentTime + curEvent.soundOffset;
    document.getElementById('time-elapsed').innerHTML = formatTime(curTime) +'/'+ formatTime(totalSoundDuration);
        curEvent.timeline.firstChild.style.width = (100 * e.target.currentTime / e.target.duration) + '%'

}

// the timeline uses two kinds of disply, depending on the whether the sound is playing, or not
function timelineButtons() {
    if (soundState == 'play') {
        document.getElementById('progress-panel').classList.add('playing');
        /*document.getElementById('prev-event').innerHTML='fast_rewind';
        document.getElementById('next-event').innerHTML='fast_forward';*/
    }
    else
    {
        document.getElementById('progress-panel').classList.remove('playing');
        /*document.getElementById('prev-event').innerHTML='navigate_before';
        document.getElementById('next-event').innerHTML='navigate_next'
        */
    }
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

//initialise the left panel and the timeline, adding event listeners to the buttons. The actual content of these will be added later
function initPanels() {
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
    document.getElementById('sound-speed').addEventListener('click',
    playbackRateChange)
}
