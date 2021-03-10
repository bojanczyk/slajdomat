export {
    eventTree,
    curEvent,
    numberOfPages,
    changeEvent,
    gotoPath,
    createEventTree,
    eventIndex,
    gotoEvent,
    getPath,
    disabledEvent,
    pageNumber,
    parentEvent
}

import {
    SlideEvent,
    SoundState
} from './types'


import {
    createTreeHTML,
    makeTimeline,
    markSeen,
    markDisabled,
    openPanelTree,
    removeLoading,
    userAlert,
    updatePageNumber
} from './html'

import {
    pathInURL,
    fileName
} from './files'

import {
    manifest
} from './viewer'

import {
    getBoundRect,
    idTransform,
    transformToString,
    applyTransform,
    getTransform
} from './transform'

import {
    soundStop,
    loadSounds,
    soundState,
    soundPlayCurrentEvent,
    soundRecord,
    updateSoundIcon
} from "./sound"

import {
    Rect,
    Transform
} from './transform'


import {
    gsap,
    TimelineMax
} from "gsap";



let eventTree: SlideEvent = null;
let curEvent: SlideEvent = null;
let numberOfPages = 0;


const transforms: Map < SlideEvent, Transform > = new Map();
const pageNumberMap : Map < SlideEvent, number > = new Map();
const localRect: Map < SlideEvent, Rect > = new Map();
const svgdefs: Map < SlideEvent, SVGDefsElement > = new Map();
const svgMap: Map < SlideEvent, SVGElement> = new Map();
const eventSVGs: Map < SlideEvent, {
    svg: SVGElement,
    startVisible: boolean
} [] > = new Map();

//this is how we can access variables in the browser console
// (window as any).svgMap = svgMap;


const parentMap: Map < SlideEvent, SlideEvent > = new Map();
function parentEvent(event: SlideEvent) : SlideEvent {
    return parentMap.get(event);
}

function pageNumber(event : SlideEvent) : number {
    return pageNumberMap.get(event);
}



//this is a feature that is not currently used: a disabled event is one that is already known not to work from the manifest, e.g. because the figma file had some errors 
function disabledEvent( ignored : SlideEvent) : boolean {
    return   false;
}

//add a new node to the slide tree
//the svg
function svgLoaded(node: SlideEvent, index: number): void {

    //Checks if an svg element matches an event.
    //For the moment the matching function is that the 
    //svg id has the event event name as a prefix
    function matches(svg: SVGElement, event: SlideEvent): boolean {
        //the name in the id uses a wrong encoding, which is repaired here
        const niceName = decodeURIComponent(escape(svg.id));
        return (niceName == event.id)
    }


    localRect.set(node, getBoundRect(svgMap.get(node)));
    eventSVGs.set(node,[]);
    //hide objects that are either a placeholder rectangle, or the first event is show
    for (const c of svgMap.get(node).children) {
        const child = c as SVGElement;
        for (const event of node.children) {
            if (event.type == 'show' && matches(child, event)) {
                eventSVGs.get(node).push({
                    svg: child,
                    startVisible: false
                });
                break;
            }
            if (event.type == 'hide' && matches(child, event)) {
                eventSVGs.get(node).push({
                    svg: child,
                    startVisible: true
                });
                break;
            }

            if (event.type == 'child' && event.id == child.id)
                child.style.opacity = '0';
        }
    }

    //attach each show or hide event to its corresponding svg element
    for (const event of node.children) {
        if (event.type == 'show' || event.type == 'hide') {
            for (const c of svgMap.get(node).children) {
                const child = c as SVGElement;
                if (matches(child, event)) {
                    svgMap.set(event, child);
                }
            }
           
        }
    }

    updateEventsSVG(node, index);
    //compute the transformation with respect to the local coordinates of the parent
    if (parentEvent(node) == undefined) {
        transforms.set(node, idTransform());
    } else {
        let placeholder: Rect;
        for (const s of svgMap.get(parentEvent(node)).children)
            if (s.id == node.id) {
                //s is the child link. This could be a group, or a rectangle. We find the dimensions by searching for a rectangle, which could be s or one of its children (the latter happens when s is a group that contains other stuff).
                let rect: SVGRectElement = null;
                if (s.nodeName == 'rect')
                    rect = (s as unknown) as SVGRectElement;
                else
                    for (const c of s.children) {
                        if (c.nodeName == 'rect')
                            rect = (c as unknown) as SVGRectElement;
                    }
                placeholder = {
                    x: (rect.x as SVGAnimatedLength).baseVal.value,
                    y: (rect.y as SVGAnimatedLength).baseVal.value,
                    width: (rect.width as SVGAnimatedLength).baseVal.value,
                    height: (rect.height as SVGAnimatedLength).baseVal.value
                };
            }
        const target = applyTransform(transforms.get(parentEvent(node)), placeholder);
        transforms.set(node, getTransform(localRect.get(node), target));
    }
    svgMap.get(node).setAttribute("transform", transformToString(transforms.get(node)));
    document.getElementById("svg").appendChild(svgMap.get(node));
    if (svgdefs.get(node) != undefined)
        document.getElementById("svg").appendChild(svgdefs.get(node));
}


//loads the SVG for the given node in the slide tree
function loadSVG(node: SlideEvent, index = 0, callback: (x: boolean) => void = null) {
    if (node.type != 'child' || svgMap.get(node) != undefined) {
        //there is nothing to load, so the callback can be called
        if (node.type == 'child')
            updateEventsSVG(node, index);
        if (callback != null)
            callback(true);
    } else {
        loadSounds(node);
        const ob = document.createElement("object");
        const file = fileName(node.id, 'image.svg');
        ob.setAttribute("data", file);
        ob.setAttribute("type", "image/svg+xml");
        ob.classList.add("hidden-svg");
        document.body.appendChild(ob);
        ob.onload = function () {
            try {
                //in principle, the right element should be the first child, but Marek Sokołowski mentioned that expressVPN changes inserts some wrong children, hence the following code
                for (const child of ob.contentDocument.firstElementChild.children) {
                    if (child.nodeName == 'g')
                        svgMap.set(node,child as SVGElement);

                    //the svg has also some definitions, which will contain images
                    if (child.nodeName == 'defs') {
                        const defs = child as SVGDefsElement;
                        svgdefs.set(node, defs);
                        cleanDefs(defs) // this function is a hack, it removes clip masks from the definitions
                    }


                }

                //remove the loading style (red) from the tree view
                removeLoading(node);

                svgLoaded(node, index);

                if (callback != null) {
                    callback(true);
                }
            } catch (exception) {
                // this means that the svg failed to load correctly
                markDisabled(node);
                svgMap.set(node,undefined); //maybe this line is not needed
                userAlert("Failed to load svg for " + node.name);
                if (callback != null) {
                    callback(false);
                }
            }
        }
    }
}

//this function is an ugly hack. In the current situation, clip masks are mis-applied. This could be because their coordinates are not localized, but for the moment I just delete all clip masks
function cleanDefs(svg: SVGElement): void {
    for (const c of svg.childNodes) {
        if (c.nodeName == 'clipPath')
            c.remove();
    }
}

//do an animated zoom to the slide on the top of the stack
function zoomSlide(node: SlideEvent, duration = 1.5): void {
    function textRect(rect: Rect) {
        return " " + rect.x + " " + rect.y + " " + rect.width + " " + rect.height;
    }
    const svgDom = document.getElementById("svg");
    const viewBox = applyTransform(transforms.get(node), localRect.get(node));
    const tla = new TimelineMax({});
    tla.to(svgDom, duration, {
        attr: {
            viewBox: textRect(viewBox)
        }
    });
}


//creates the tree of slides and events, without adding the svg objects yet
function createEventTree(): void {

    function createTreeRec(event: SlideEvent, parent: SlideEvent): SlideEvent //recursive function which loads a json for each slide. I might move this to having a single json.
    {
        const retval: SlideEvent = {
            type: event.type,
            id: event.id,
            name: event.name,
            merged: event.merged,
            children: []
        }
        if (parent != undefined)
            parentMap.set(retval, parent);
        pageNumberMap.set(retval,numberOfPages);

        if (retval.type == 'child') {
            numberOfPages++;
            for (const child of event.children) {
                retval.children.push(createTreeRec(child, retval));
            }
            const finishEvent : SlideEvent = {
                type: 'finish',
                merged: false,
                id: null,
                name: null,
                children: [],
            };
            parentMap.set(finishEvent,retval);
            pageNumberMap.set(finishEvent,numberOfPages);
            retval.children.push(finishEvent);
        }

        return retval;
    }


    eventTree = createTreeRec(manifest.tree, undefined);
    createTreeHTML();
    makeTimeline();
    curEvent = eventTree;
}

//this tree navigation is not efficient, but I want to avoid adding extra links
function treeSibling(node: SlideEvent, dir: number): SlideEvent {
    try {
        for (let i = 0; i < parentEvent(node).children.length; i++)
            if (parentEvent(node).children[i] == node)
                return parentEvent(node).children[i + dir]
    } catch (exception) {
        return null;
    }
}

//stores for each slide event its index relative to its parent, so that it does not need to be recomputed
const cacheIndex: Map < SlideEvent, number > = new Map();

//returns the index of an event inside its parent.
function eventIndex(node: SlideEvent): number {
    if (cacheIndex.get(node) != undefined) {
        return cacheIndex.get(node)
    } else
        try {
            for (let i = 0; i < parentEvent(node).children.length; i++)
                if (parentEvent(node).children[i] == node) {
                    cacheIndex.set(node, i);
                    return i;
                }
        } catch (exception) {
            return null;
        }
}


//pushes a list of slides. The root is the first slide, which is assumed to be loaded, and then path contains a list of directions (which event number), that defines a path; ordered from last to first. The after parameter is a callback to be performed once the last slide is pushed.
function pushIndexList(root: SlideEvent, path: number[], after = (ignored : SlideEvent) => {/*do nothing */}): void {
    if (path.length == 0) {
        curEvent = root;
        if (parentEvent(parentEvent(curEvent)) == null) {
            zoomSlide(parentEvent(curEvent), 0)
        } else {
            zoomSlide(parentEvent(curEvent))
        }
        updatePageNumber();
        after(root);
    } else {
        const index = path.pop();
        // const event = root.children[index];
        const callback = (success: boolean) => {
            if (success) {
                for (let i = 0; i < root.children.length; i++) {
                    const event = root.children[i];
                    if (event.type == 'child') {
                        if (i < index) {
                            loadSVG(event, event.children.length);
                        }
                        if (i >= index) {
                            loadSVG(event, 0);
                        }
                    }
                    if (i == index)
                        pushIndexList(event, path, after);
                }
            } else {
                userAlert('Failed to push slide ' + root.name)
            }
        }
        loadSVG(root, index, callback);
    }

}


//the move to the prev/next event, depending on whether dir is -1 or 1. One of the longer functions, because there are numerous combinations of push, pop, next sibling, etc.
function changeEvent(dir: number): void {

    function showHide(event: SlideEvent) {
        let opacity;
        if ((event.type == "show" && dir == 1) || (event.type == "hide" && dir == -1))
            opacity = 1;
        else
            opacity = 0;

        gsap.to(svgMap.get(event), {
            duration: 0.3,
            opacity: opacity
        });
    }

    if (dir == 1) {
        markSeen(curEvent, true);
        if (curEvent.type == 'child') {
            openPanelTree(curEvent, true);
            pushIndexList(parentEvent(curEvent), [0, eventIndex(curEvent)])
        } else
        if (curEvent.type == 'show' || curEvent.type == 'hide') {
            // hide or show
            do {
                showHide(curEvent);
                curEvent = treeSibling(curEvent, 1);
            } while (curEvent.merged);
        } else
        if (curEvent.type == 'finish') {
            if (parentEvent(curEvent) == eventTree) {
                soundStop();
                // userAlert("Cannot move after last event");
            } else {
                const nextEvent = treeSibling(parentEvent(curEvent), 1);
                openPanelTree(parentEvent(curEvent), false);
                if (nextEvent.merged) {
                    //we go directly to the next child
                    if (nextEvent.type != 'child') {
                        throw ('a child merged with a non-child');
                    }
                    markSeen(nextEvent, true);
                    openPanelTree(nextEvent, true);
                    pushIndexList(parentEvent(nextEvent), [0, eventIndex(nextEvent)])
                } else {
                    //we zoom out to the parent
                    zoomSlide(parentEvent(parentEvent(curEvent)), 1.5);
                    curEvent = nextEvent;
                }

                // pop the stack


            }

        }
        if (soundState == SoundState.Play) {
            soundPlayCurrentEvent();
        }

        if (soundState == SoundState.Record)
            soundRecord();
    } else {
        //direction is backward
        markSeen(curEvent, false);
        const prevEvent = treeSibling(curEvent, -1);

        if (prevEvent == null) //first event of its group
        {
            //we need to pop the current slide
            if (parentEvent(curEvent) == eventTree) {
                // userAlert("Cannot move before first event");
            } else {
                curEvent = parentEvent(curEvent);
                openPanelTree(curEvent, false);
                markSeen(curEvent, false);
                if (curEvent.merged) {
                    const prevEvent = treeSibling(curEvent, -1);
                    openPanelTree(prevEvent, true);
                    pushIndexList(parentEvent(prevEvent), [prevEvent.children.length - 1, eventIndex(prevEvent)]);
                } else {
                    zoomSlide(parentEvent(curEvent), 1.5);
                }


            }

        } else
        if (prevEvent.type == 'show' || prevEvent.type == 'hide') {
            // hide or show
            do {
                curEvent = treeSibling(curEvent, -1);
                showHide(curEvent);
            } while (curEvent.merged == true);
            markSeen(curEvent, false);
        } else
        if (prevEvent.type == 'child') {
            openPanelTree(prevEvent, true);
            pushIndexList(parentEvent(prevEvent), [prevEvent.children.length - 1, eventIndex(prevEvent)]);
            markSeen(curEvent, false);
        }

        if (soundState == SoundState.Play) {
            soundPlayCurrentEvent(-1);
        }

    }

    updatePageNumber();
    updateSoundIcon();
}


//makes visible or invisible the appropriate objects in the slide, so that events before (not including) index have already been performed
function updateEventsSVG(slide: SlideEvent, index: number): void {
    if (slide.type != 'child' || svgMap.get(slide) == undefined)
        return;

    for (const x of eventSVGs.get(slide)) {
        let visible = x.startVisible;
        for (let i = 0; i < index; i++) {
            if (svgMap.get(slide.children[i]) == x.svg)
                visible = (slide.children[i].type == 'show')
        }
        if (visible)
            x.svg.style.opacity = '1';
        else
            x.svg.style.opacity = '0';
    }

    //call recursively for child slides
    for (const child of slide.children) {
        if (child.type == 'child') {
            if (eventIndex(child) < index) {
                updateEventsSVG(child, child.children.length);
            } else {
                updateEventsSVG(child, 0)
            }
        }
    }
}




function gotoPath(path: number[]): void //move to an event given by a list of indices, given in shallow-to-deep ordering
{
    soundStop();
    //after moving to the event, we will call the following function
    function updateSeen(event: SlideEvent): void //update the seen information for items in the slide panel, and the visibility
    {
        let before = true;

        function updateRec(e: SlideEvent) {
            if (e == event)
                before = false;
            //update the colour of the timeline and tree view
            if (parentEvent(e) != undefined) // the root has no div in the tree view or timeline
                markSeen(e, before);
            if (e.type == 'child')
                for (const child of e.children)
                    updateRec(child);
        }
        updateRec(eventTree);
        pathInURL();
    }
    pushIndexList(eventTree, path, updateSeen);
}

function getPath(event: SlideEvent): number[] {
    const path = [];
    let ancestor = event;
    while (parentEvent(ancestor) != undefined) {
        path.push(eventIndex(ancestor));
        ancestor = parentEvent(ancestor);
    }
    return path;
}

function gotoEvent(event: SlideEvent): void //move directly to an event
{
    gotoPath(getPath(event));
}