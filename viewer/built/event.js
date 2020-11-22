export { eventTree, curEvent, numberOfPages, changeEvent, gotoPath, createEventTree, eventIndex, openPanelTree, gotoEvent };
import { createTreeHTML, makeTimeline, markSeen } from './html.js';
import { manifest, fileName, userAlert, updatePageNumber, presentationURL } from './viewer.js';
import { getBoundRect, idTransform, transformToString, zoomSlide, applyTransform, getTransform } from './transform.js';
import { soundStop, loadSounds, soundState, soundPlayCurrentEvent, soundRecord, updateSoundIcon } from "./sound.js";
// const { gsap } = require("./gsap.min.js");
// import {gsap} from 'gsap'
var eventTree = null;
var curEvent = null;
var numberOfPages = 0;
//add a new node to the slide tree
//the svg
function svgLoaded(node, index) {
    //Checks if an svg element matches an event.
    //For the moment the matching function is that the 
    //svg id has the event event name as a prefix
    function matches(svg, event) {
        //the name in the id uses a wrong encoding, which is repaired here
        var niceName = decodeURIComponent(escape(svg.id));
        return (niceName == event.id);
    }
    node.localRect = getBoundRect(node.svg);
    node.eventSVGs = [];
    //hide objects that are either a placeholder rectangle, or the first event is show
    for (const child of node.svg.children) {
        for (const event of node.children) {
            if (event.type == 'show' && matches(child, event)) {
                node.eventSVGs.push({
                    svg: child,
                    startVisible: false
                });
                break;
            }
            if (event.type == 'hide' && matches(child, event)) {
                node.eventSVGs.push({
                    svg: child,
                    startVisible: true
                });
                break;
            }
            if (event.type == 'child' && event.id == child.id)
                child.style.opacity = 0;
        }
    }
    //attach each show or hide event to its corresponding svg element
    for (const event of node.children) {
        if (event.type == 'show' || event.type == 'hide') {
            for (const child of node.svg.children)
                if (matches(child, event)) {
                    event.svg = child;
                }
            if (event.svg == null)
                event.disabled = true;
        }
    }
    updateEventsSVG(node, index);
    //compute the transformation with respect to the local coordinates of the parent
    if (node.parent == null) {
        node.transform = idTransform();
    }
    else {
        for (const s of node.parent.svg.children)
            if (s.id == node.id) {
                //s is the child link. This could be a group, or a rectangle. We find the dimensions by searching for a rectangle, which could be s or one of its children (the latter happens when s is a group that contains other stuff).
                var rect = null;
                if (s.nodeName == 'rect')
                    rect = s;
                else
                    for (const c of s.children) {
                        if (c.nodeName == 'rect')
                            rect = c;
                    }
                node.placeholder = {
                    x: rect.x.baseVal.value,
                    y: rect.y.baseVal.value,
                    width: rect.width.baseVal.value,
                    height: rect.height.baseVal.value
                };
            }
        var target = applyTransform(node.parent.transform, node.placeholder);
        node.transform = getTransform(node.localRect, target);
    }
    node.svg.setAttribute("transform", transformToString(node.transform));
    document.getElementById("svg").appendChild(node.svg);
}
//loads the SVG for the given node in the slide tree
function loadSVG(node, index = 0, callback = null) {
    if (node.type != 'child' || node.svg != null) {
        //there is nothing to load, so the callback can be called
        if (node.type == 'child')
            updateEventsSVG(node, index);
        if (callback != null)
            callback(true);
    }
    else {
        loadSounds(node);
        var ob = document.createElement("object");
        const file = fileName(node.id, 'image.svg');
        ob.setAttribute("data", file);
        ob.setAttribute("type", "image/svg+xml");
        ob.classList.add("hidden-svg");
        document.body.appendChild(ob);
        ob.onload = function () {
            try {
                var doc = ob.contentDocument.firstElementChild;
                //in principle, the right element should be the first child, but Marek Sokołowski mentioned that expressVPN changes inserts some wrong children, hence the following code
                for (const child of ob.contentDocument.firstElementChild.children) {
                    if (child.nodeName == 'g')
                        node.svg = child;
                }
                //remove the 'loading' class from the corresponding elements in the slide panel
                if (node.div != null) {
                    console.log('removing loading');
                    node.div.classList.remove("tree-view-item-loading");
                }
                for (let child of node.children)
                    if (child.type == 'show' || child.type == 'hide')
                        child.div.classList.remove("tree-view-item-loading");
                svgLoaded(node, index);
                if (callback != null) {
                    callback(true);
                }
            }
            catch (exception) {
                console.log(exception);
                // this means that the svg failed to load correctly
                if (node.div != null) {
                    node.div.classList.add("disabled-event");
                    node.div.classList.remove("tree-view-item-loading");
                }
                node.svg = null;
                userAlert("Failed to load svg for " + node.name);
                if (callback != null) {
                    callback(false);
                }
            }
        };
    }
}
//creates the tree of slides and events, without adding the svg's yet
function createEventTree() {
    function createTreeRec(event, parent) {
        const retval = {
            type: event.type,
            id: event.id,
            name: event.name,
            parent: parent,
            audio: null,
            duration: null,
            pageNumber: numberOfPages,
            children: []
        };
        if (retval.type == 'child') {
            numberOfPages++;
            for (const child of event.children) {
                retval.children.push(createTreeRec(child, retval));
            }
            retval.children.push({
                type: 'finish',
                parent: retval,
                pageNumber: numberOfPages
            });
        }
        return retval;
    }
    eventTree = manifest.tree;
    eventTree.parent = null;
    eventTree = createTreeRec(manifest.tree, null);
    createTreeHTML();
    makeTimeline();
    curEvent = eventTree;
}
//this tree navigation is not efficient, but I want to avoid adding extra links
function treeSibling(node, dir) {
    try {
        for (let i = 0; i < node.parent.children.length; i++)
            if (node.parent.children[i] == node)
                return node.parent.children[i + dir];
    }
    catch (exception) {
        return null;
    }
}
//returns the index of an event inside its parent.
function eventIndex(node) {
    if ('index' in node)
        return node.index;
    else
        try {
            for (let i = 0; i < node.parent.children.length; i++)
                if (node.parent.children[i] == node) {
                    node.index = i;
                    return i;
                }
        }
        catch (exception) {
            return null;
        }
}
//pushes a list of slides. The root is the first slide, which is assumed to be loaded, and then path contains a list of directions (which event number), that defines a path; ordered from last to first. The after parameter is a callback to be performed once the last slide is pushed.
function pushIndexList(root, path, after = (x) => { }) {
    if (path.length == 0) {
        curEvent = root;
        if (curEvent.parent.parent == null) {
            zoomSlide(curEvent.parent, 0);
        }
        else {
            zoomSlide(curEvent.parent);
        }
        updatePageNumber();
        after(root);
    }
    else {
        const index = path.pop();
        // const event = root.children[index];
        function callback(success) {
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
            }
            else {
                userAlert('Failed to push slide ' + root.name);
            }
        }
        loadSVG(root, index, callback);
    }
}
//the move to the prev/next event, depending on whether dir is -1 or 1. One of the longer functions, because there are numerous combinations of push, pop, next sibling, etc.
function changeEvent(dir) {
    function showHide(event) {
        var opacity;
        if ((event.type == "show" && dir == 1) || (event.type == "hide" && dir == -1))
            opacity = 1;
        else
            opacity = 0;
        gsap.to(event.svg, {
            duration: 0.3,
            opacity: opacity
        });
    }
    if (dir == 1) {
        markSeen(curEvent, true);
        if (curEvent.type == 'child') {
            openPanelTree(curEvent, true);
            pushIndexList(curEvent.parent, [0, eventIndex(curEvent)]);
        }
        else if (curEvent.type == 'show' || curEvent.type == 'hide') {
            // hide or show
            showHide(curEvent);
            curEvent = treeSibling(curEvent, 1);
        }
        else if (curEvent.type == 'finish') {
            if (curEvent.parent == eventTree) {
                soundStop();
                // userAlert("Cannot move after last event");
            }
            else {
                // pop the stack
                openPanelTree(curEvent.parent, false);
                zoomSlide(curEvent.parent.parent, 1.5);
                curEvent = treeSibling(curEvent.parent, 1);
            }
        }
        if (soundState == "play") {
            soundPlayCurrentEvent();
        }
        if (soundState == "record")
            soundRecord();
    }
    else {
        //direction is backward
        markSeen(curEvent, false);
        const prevEvent = treeSibling(curEvent, -1);
        if (prevEvent == null) //first event of its group
         {
            //we need to pop the current slide
            if (curEvent.parent == eventTree) {
                // userAlert("Cannot move before first event");
            }
            else {
                zoomSlide(curEvent.parent.parent, 1.5);
                curEvent = curEvent.parent;
                openPanelTree(curEvent, false);
                markSeen(curEvent, false);
            }
        }
        else if (prevEvent.type == 'show' || prevEvent.type == 'hide') {
            // hide or show
            markSeen(prevEvent, false);
            showHide(prevEvent);
            curEvent = treeSibling(curEvent, -1);
        }
        else if (prevEvent.type == 'child') {
            openPanelTree(prevEvent, true);
            pushIndexList(prevEvent.parent, [prevEvent.children.length - 1, eventIndex(prevEvent)]);
            markSeen(curEvent, false);
        }
    }
    updatePageNumber();
    updateSoundIcon();
}
function openPanelTree(event, open) {
    if (open) {
        event.subdiv.classList.remove('slide-stack-hidden');
        event.div.childNodes[0].innerHTML = 'expand_more';
    }
    else {
        event.subdiv.classList.add('slide-stack-hidden');
        event.div.childNodes[0].innerHTML = 'chevron_right';
    }
}
function updateEventsSVG(slide, index) {
    if (slide.type != 'child' || slide.svg == null)
        return;
    for (let x of slide.eventSVGs) {
        let visible = x.startVisible;
        for (let i = 0; i < index; i++) {
            if (slide.children[i].svg == x.svg)
                visible = (slide.children[i].type == 'show');
        }
        if (visible)
            x.svg.style.opacity = 1;
        else
            x.svg.style.opacity = 0;
    }
    //call recursively for child slides
    for (let child of slide.children) {
        if (child.type == 'child') {
            if (eventIndex(child) < index) {
                updateEventsSVG(child, child.children.length);
            }
            else {
                updateEventsSVG(child, 0);
            }
        }
    }
}
function pathInURL() {
    const path = getPath(curEvent);
    let string = '';
    while (path.length > 0) {
        string += path.pop() + '/';
    }
    history.pushState({}, null, '?slides=' + encodeURI(presentationURL) + '&path=' + string);
}
function gotoPath(path) {
    soundStop();
    //after moving to the event, we will call the following function
    function updateSeen(event) {
        let before = true;
        function updateRec(e) {
            if (e == event)
                before = false;
            //update the colour of the timeline and tree view
            if (e.parent != null) // the root has no divs in the tree view or timeline
                markSeen(e, before);
            if (e.type == 'child')
                for (let child of e.children)
                    updateRec(child);
        }
        updateRec(eventTree);
        pathInURL();
    }
    pushIndexList(eventTree, path, updateSeen);
}
function getPath(event) {
    const path = [];
    var ancestor = event;
    while (ancestor.parent != null) {
        path.push(eventIndex(ancestor));
        ancestor = ancestor.parent;
    }
    return path;
}
function gotoEvent(event) {
    gotoPath(getPath(event));
}
//# sourceMappingURL=event.js.map