export {
    createTreeHTML,
    makeTimeline,
    markSeen,
    audioPlaying,
    updateEventDuration,
    timelineButtons,
    totalSoundDuration,
    initPanels,
    openPanelTree,
    removeLoading,
    updatePageNumber,
    userAlert,
    markDisabled
}

import {
    gotoEvent,
    eventTree,
    curEvent,
    numberOfPages,
    disabledEvent,
    pageNumber,
    parentEvent
} from './event'


import {
    manifest,
    playButton,
    prevButton,
    nextButton
} from './viewer'

import {
    gotoAudio,
    playbackRateChange,
    soundState,
    soundDurations
} from './sound'

import {
    gsap
} from "gsap";


import { SlideEvent, SoundState } from './types';


let totalSoundDuration = 0;

//these dictionaries store, for each slide event, the corresponding div and subtreeDiv in the tree panel. The div is the name of the event, while the subtreeDiv is defined only for child events, and it is the subtree.
const divCache: Map<SlideEvent, HTMLElement> = new Map();
const subtreeDivCache: Map<SlideEvent, HTMLElement> = new Map();

//this dictionary tells you if the div, for a child event, is open (the tree is unfolded)
const divOpen: Map<SlideEvent, boolean> = new Map();

//this dictionary associates to each event the corresponding html element in the timeline
const timelines: Map<SlideEvent, HTMLElement> = new Map();

//assigns to each event the number of seconds until that event
const soundOffset: Map<SlideEvent, number> = new Map();


//create the tree list of the slides and event that is in the unfolding side panel on the left
function createTreeHTML(): void {

    function createTreeHTMLRec(event: SlideEvent) {

        function eventClicked(e: MouseEvent) //what happens when an event is clicked in the control panel
        {
            if ((e.target as Element).nodeName == 'I') {
                //the icon was clicked
                if (event.type == 'child') // for child events, we fold/unfold the list of child events
                {
                    const open = !divOpen.get(event);
                    divOpen.set(event, open);
                    openPanelTree(event, open);
                }
            } else {
                //the name of the event was clicked
                gotoEvent(event);
            }
        }
        divOpen.set(event, false);
        if (parentEvent(event) == undefined) {
            subtreeDivCache.set(event, document.getElementById('slide-stack'));
        } else if (event.merged && event.type != 'child') {
            //merged events get no items in the tree view
        } else {
            const parentDiv = subtreeDivCache.get(parentEvent(event));
            const div = document.createElement("div");
            divCache.set(event, div);
            div.classList.add("tree-view-item");
            div.classList.add("tree-view-item-loading");

            let icon;
            if (disabledEvent(event)) {
                div.classList.add("disabled-event");
            }

            if (event.type == "show")
                icon = "visibility";
            if (event.type == "hide")
                icon = "visibility_off";
            if (event.type == "child") {
                icon = "chevron_right";
            }

            div.innerHTML = "<i class=\"material-icons\">" + icon + "</i> " + event.name;

            div.addEventListener('click', eventClicked);
            parentDiv.appendChild(div);


            if (event.type == 'child') {
                const subdiv = document.createElement("div");
                subdiv.classList.add("slide-stack");
                subdiv.classList.add("slide-stack-hidden");
                parentDiv.appendChild(subdiv);
                subtreeDivCache.set(event, subdiv);
            }
        }

        //recursively call for all children
        if (event.type == 'child') {
            for (const child of event.children)
                if (child.type != 'finish')
                    createTreeHTMLRec(child)
        }
    }
    createTreeHTMLRec(eventTree);

}

const noSoundDuration = 10;

//updates the duration of an event; the update concerns the timeline
function updateEventDuration(event: SlideEvent): void {
    const timeline = timelines.get(event);
    if (soundDurations.get(event) != undefined) {
        timeline.style.flexGrow = soundDurations.get(event).toString();
        timeline.classList.remove('nosound');
    } else {
        timeline.style.flexGrow = noSoundDuration.toString();
        timeline.classList.add('nosound');
    }

}

//creates the timeline at the bottom of the screen
function makeTimeline(): void {

    //for each element, find the duration of its audio
    function computeDuration(event: SlideEvent): void {
        for (let i = 0; i < event.children.length; i++) {
            soundOffset.set(event.children[i], totalSoundDuration);
            try {
                const duration = manifest.soundDict[event.id][i].duration;
                soundDurations.set(event.children[i], duration);
                totalSoundDuration += duration;
            } catch (e) {
                totalSoundDuration += noSoundDuration;
            }


            if (event.children[i].type == 'child')
                computeDuration(event.children[i]);
        }

    }

    //create a div in the timeline for every non-root element of the 
    function makeTimelineRec(event: SlideEvent): void {

        if (parentEvent(event) == undefined) {
            //the root has no element in the timeline

        } else if (event.merged) {
            //if an event is merged with the previous one, then also no timeline

        } else {
            const big = document.createElement('div');
            const small = document.createElement('div');
            small.classList.add('progress-filler');
            small.style.width = '0%';
            big.appendChild(small);
            timeLine.appendChild(big);

            big.addEventListener('click', function (e) {
                timelineClicked(event, e);
            })
            timelines.set(event, big);
            updateEventDuration(event);
        }
        //recursively call for children
        if (event.type == 'child')
            for (const child of event.children)
                makeTimelineRec(child);
    }

    const timeLine = document.getElementById('progress-line');
    computeDuration(eventTree);
    makeTimelineRec(eventTree);

}

//the timeline for an event was clicked; with the ratio being the indicating the click position inside the timeline
function timelineClicked(event: SlideEvent, e: MouseEvent): void {

    let target = e.target as HTMLElement;
    if (target.classList.contains('progress-filler')) {
        target = target.parentNode as HTMLElement;
    }
    const a: number = e.offsetX;
    const b: number = target.offsetWidth;

    if (event == curEvent) {
        gotoAudio(a / b);
    } else {
        gotoEvent(event)
    }
}

//mark the tree view and timeline for an event as seen/unseen
function markSeen(event: SlideEvent, seen: boolean): void {
    const div = divCache.get(event);
    const timeline = timelines.get(event);
    if (seen) {
        if (div != undefined) //final events have no div
            div.classList.add('tree-view-item-seen');
        if (timeline != undefined) {
            const firstChild = timeline.firstChild as HTMLElement;
            firstChild.style.width = "100%";
            timeline.classList.add('seen');
        }
    } else {
        if (div != undefined) //final events have no div
            div.classList.remove('tree-view-item-seen');
        if (timeline != undefined) {
            const firstChild = timeline.firstChild as HTMLElement;
            firstChild.style.width = "0%";
            timeline.classList.remove('seen');
        }
    }

}

//mark an event as disabled in the tree view
function markDisabled(node: SlideEvent): void {
    const div = divCache.get(node);
    if (div != undefined) {
        div.classList.add("disabled-event");
        div.classList.remove("tree-view-item-loading");
    }
}


//opens or closes the tree view corresponding to a child event
function openPanelTree(event: SlideEvent, open: boolean): void {
    const icon = divCache.get(event).childNodes[0] as HTMLElement;
    if (open) {
        subtreeDivCache.get(event).classList.remove('slide-stack-hidden');
        icon.innerHTML = 'expand_more';
    } else {
        subtreeDivCache.get(event).classList.add('slide-stack-hidden');
        icon.innerHTML = 'chevron_right';
    }
}

//remove the 'loading' class from the corresponding elements in the slide panel
function removeLoading(node: SlideEvent): void {
    if (divCache.get(node) != undefined) {
        divCache.get(node).classList.remove("tree-view-item-loading");
    }
    for (const child of node.children)
        if (child.type == 'show' || child.type == 'hide') {
            if (divCache.get(child) != undefined)
                divCache.get(child).classList.remove("tree-view-item-loading");
        }
}


//inputs number of seconds and formats it in mm:ss format
function formatTime(time: number): string {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time) % 60;
    if (seconds < 10)
        return minutes + ':0' + seconds
    else
        return minutes + ':' + seconds;
}

//this function is called periodically when the audio is playing, and it updates the position of the slider
function audioPlaying(e: Event): void {
    const audio = e.target as HTMLAudioElement;
    const currentTime = audio.currentTime;
    const duration = audio.duration;
    const curTime = currentTime + soundOffset.get(curEvent);
    document.getElementById('time-elapsed').innerHTML = formatTime(curTime) + '/' + formatTime(totalSoundDuration);
    (timelines.get(curEvent).firstChild as HTMLElement).style.width = (100 * currentTime / duration) + '%'

}

// the timeline uses two kinds of display, depending on the whether the sound is playing, or not
function timelineButtons(): void {
    if (soundState == SoundState.Play) {
        document.getElementById('progress-panel').classList.add('playing');
    } else {
        document.getElementById('progress-panel').classList.remove('playing');
    }
}

//toggles the side panel on the left with the list of slides
function showPanel(visible: boolean): void {
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

function togglePanel(): void {

    if ((document.getElementById('left-panel') as HTMLDivElement).clientWidth > 0)
        showPanel(false)
    else
        showPanel(true);
}




//initialize the left panel and the timeline, adding event listeners to the buttons. The actual content of these will be added later
function initPanels(): void {


    document.getElementById('open-menu').addEventListener('click', togglePanel);
    document.getElementById('prev-event').addEventListener('click', prevButton);
    document.getElementById('next-event').addEventListener('click', nextButton);
    document.getElementById('play-button').addEventListener('click', playButton);
    document.getElementById('sound-speed').addEventListener('click',
        playbackRateChange);

    //if there is at least one sound, then we display the sound controls (play button, and spped button)
    if (Object.keys(manifest.soundDict).length > 0)
    {
        document.body.classList.add('has-sound');
    }
}



//displays a panel for a short time
function shortDisplay(panel: HTMLElement): void {
    const tl = gsap.timeline();
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

// //displays the help
// function helpPanel() : void {
//     shortDisplay(document.getElementById("help-panel"));
// }

//displays an alert for the user at the bottom of the screen
function userAlert(text: string): void {
    document.getElementById("text-alert").innerHTML = text;
    shortDisplay(document.getElementById("text-alert-box"));
}

//update the page number in the corner
function updatePageNumber(): void {
    document.getElementById("page-count-enumerator").innerHTML = pageNumber(curEvent).toString();
    document.getElementById("page-count-denominator").innerHTML = " / " + numberOfPages;

    // the "previous" arrow should be invisible at the first event of the first slide
    // analogously for the "next" arrow
    if (curEvent == eventTree.children[0])
        document.getElementById("prev-event").style.visibility = "hidden";
    else
        document.getElementById("prev-event").style.visibility = "visible";

    if (curEvent.type == 'finish' && parentEvent(curEvent) == eventTree)
        document.getElementById("next-event").style.visibility = "hidden";
    else
        document.getElementById("next-event").style.visibility = "visible";
}


