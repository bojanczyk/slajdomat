export { createTreeHTML, makeTimeline, markSeen, audioPlaying, updateEventDuration };
import { openPanelTree, gotoEvent, eventTree, curEvent } from './event.js';
import { manifest } from './viewer.js';
import { gotoAudio } from './sound.js';
//create the tree list of the slides and event that is in the unfolding side panel on the left
function createTreeHTML() {
    function createTreeHTMLRec(event) {
        function eventClicked(e) {
            if (e.target.nodeName == 'I') {
                //the icon was clicked
                if (event.type == 'child') // for child events, we fold/unfold the list of child events
                 {
                    event.divopen = !event.divopen;
                    openPanelTree(event, event.divopen);
                }
            }
            else {
                //the name of the event was clicked
                gotoEvent(event);
            }
        }
        event.divopen = false;
        if (event.parent == null) {
            event.subdiv = document.getElementById('slide-stack');
            event.div = null;
        }
        else {
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
                    createTreeHTMLRec(child);
        }
    }
    createTreeHTMLRec(eventTree);
}
const noSoundDuration = 10;
//updates the duration of an event; the update concerns the timeline
function updateEventDuration(event) {
    if (event.duration != null) {
        event.timeline.style.flexGrow = event.duration;
        event.timeline.classList.remove('nosound');
    }
    else {
        event.timeline.style.flexGrow = noSoundDuration;
        event.timeline.classList.add('nosound');
    }
}
//creates the timeline at the bottom of the screen
function makeTimeline() {
    //for each element, find the duration of its audio
    function computeDuration(event) {
        for (let i = 0; i < event.children.length; i++) {
            try {
                event.children[i].duration = manifest.soundDict[event.id][i].duration;
                totalDuration += event.children[i].duration;
            }
            catch (e) {
                event.children[i].duration = null;
                totalDuration += noSoundDuration;
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
                timelineClicked(event, e);
            });
            event.timeline = big;
            updateEventDuration(event);
        }
        if (event.type == 'child')
            for (let child of event.children)
                makeTimelineRec(child);
    }
    var totalDuration = 0;
    const timeLine = document.getElementById('progress-line');
    computeDuration(eventTree);
    makeTimelineRec(eventTree);
    console.log("total sound is " + totalDuration / 60);
}
//the timeline for an event was clicked; with the ratio being the indicating the click position inside the timeline
function timelineClicked(event, e) {
    var target = e.target;
    if (target.classList.contains('progress-filler')) {
        target = target.parentNode;
    }
    var a = e.offsetX;
    var b = target.offsetWidth;
    if (event == curEvent) {
        console.log('curevent', a, b);
        gotoAudio(a / b);
    }
    else {
        console.log('other event');
        gotoEvent(event);
    }
}
//mark the tree view and timeline for an event as seen/unseen
function markSeen(event, seen) {
    if (seen) {
        if (event.div != null) //final events have no div
            event.div.classList.add('tree-view-item-seen');
        event.timeline.firstChild.style.width = "100%";
        event.timeline.classList.add('seen');
    }
    else {
        if (event.div != null) //final events have no div
            event.div.classList.remove('tree-view-item-seen');
        event.timeline.firstChild.style.width = "0%";
        event.timeline.classList.remove('seen');
    }
}
//this function is called periodically when the audio is playing, and it updates the position of the slider
function audioPlaying(e) {
    // console.log(audio.currentTime, audio.duration);
    curEvent.timeline.firstChild.style.width = (100 * e.target.currentTime / e.target.duration) + '%';
    // document.getElementById('sound-range').value = ;
}
//# sourceMappingURL=html.js.map