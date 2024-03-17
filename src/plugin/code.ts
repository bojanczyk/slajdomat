/* 
// This is the backend of the plugin. It edits the figma artboard. It sends messages to the frontend (in the file src/plugin/ui.ts), which handles user interaction and the contents of the plugin window.
*/

import { } from '@figma/plugin-typings'

export {
    allSlides, deleteHoverFrames, findEventObject, findOverlayNodeById, findSlide, getDatabase, getRoot, loadCurrentData, saveCurrentData, selChange, sendToUI, slideId, state
}


import { Database, PresentationNode } from '../common/types'
import { createChildEvent, createNewSlide } from './code-child-events'
import { findSlide, overlayId, slideId } from './code-name-management'
import { canBeOverlayTarget, createOverlayEvent } from './code-overlay-events'
import { getLatexSettings, initSettings, pluginSettings } from './code-settings'
import { updateThumbnails } from './code-thumbnails'
import { loadAnimationParams, saveAnimationParams } from './code-timeline'
import { exportSlides } from './code-export'
import { latexitOne, latexitTwo, matReplacer, matematykData, matematykWord } from './matematyk'
import { PluginCodeToUI, PluginUIToCode } from './messages-ui-plugin'
import { LatexState } from './plugin-types'
import { drawTree, presentationTree, unusedSlides } from './code-draw-tree'
import { save } from 'pdfkit'




//*** global variables */

const state = {
    //the data for the current slide, mainly the event list
    database: null as Database,
    //the current slide, as a frame of figma
    currentSlide: null as FrameNode,
}


function sendToUI(msg: PluginCodeToUI): void {
    figma.ui.postMessage(msg)
}




//send the  list which says what are the possible candidates for child slides. 
//these are slides that do not appear in the presentation tree
function sendDropDownList() {
    const msg: PluginCodeToUI = {
        type: 'dropDownContents',
        slides: [] as {
            name: string,
            id: string
        }[]
    }


    const tree = presentationTree();
    const unused = unusedSlides(tree);
    for (const slide of unused) {
        msg.slides.push({
            name: slide.name,
            id: slideId(slide)
        })
    }

    sendToUI(msg);
}



//send the event list of the current slide
function sendEventList() {
    //the slide might be removed
    if (state.currentSlide != null && !state.currentSlide.removed) {
        cleanDatabase();
        sendToUI({
            type: 'eventList',
            events: state.database.events,
            selected: state.database.selected
        });
    }
}


// create new event 
//msg.id is used for the 'child' event
function createEvent(eventInfo: {
    type: 'createEvent',
    subtype: 'child' | 'show' | 'hide' | 'animate',
    id: string,
    name: string
}): void {


    saveAnimationParams();


    let createdEvents: PresentationNode[];

    if (eventInfo.subtype == 'child') {
        // we are creating a child event
        if (eventInfo.id == null) {
            const newSlide = createNewSlide(state.currentSlide.width, state.currentSlide.height, eventInfo.name);
            eventInfo.id = slideId(newSlide)
        }
        createdEvents = createChildEvent(eventInfo.id);        
    }
    else {

        //we are creating an overlay event
        createdEvents = createOverlayEvent(eventInfo.subtype);
    }



    // insert the new event into the database, at position selected
    for (const newEvent of createdEvents) {
        state.database.events.splice(state.database.selected, 0, newEvent);
        state.database.selected++;
    }



    saveCurrentData();
    loadAnimationParams();
    sendEventList();

    if (eventInfo.subtype == 'child' && pluginSettings.drawTree)
    {   
        console.log('draw tree')
        drawTree();
    }
}


//remove an event from the current event list
function removeEvent(index: number): void {
    saveAnimationParams();
    const event = state.database.events[index];
    if (event.type == "child") {
        const rect = findEventObject(event, state.currentSlide);
        if (rect != null)
            rect.remove();
    }

    if (state.database.selected > index)
        state.database.selected--;

    state.database.events.splice(index, 1);
    saveCurrentData();
    loadAnimationParams();
    sendEventList();

    if (pluginSettings.drawTree && event.type == "child")
        drawTree();
}

//merge or de-merge an event with the previous one 
function mergeEvent(index: number): void {
    const event = state.database.events[index];
    event.merged = !event.merged;
    saveCurrentData();
    sendEventList();
}


//change order of event list so that source becomes target. The source and target are counted among merged blocks of events
function reorderEvents(sourceBlock: number, targetBlock: number): void {

    saveAnimationParams();


    

    //the source is a block, and so is the target
    const blockStarts: number[] = [];
    let i: number;
    for (i = 0; i < state.database.events.length; i++) {
        if (state.database.events[i].merged == false)
            blockStarts.push(i);
    }
    blockStarts.push(i);
    const source = blockStarts[sourceBlock];
    const target = blockStarts[targetBlock];
    const sourceCount = blockStarts[sourceBlock + 1] - source;
    const targetCount = blockStarts[targetBlock + 1] - target;

    // check if the source or target block contains a child event, which will force a redraw of the tree
    let swapsChildren = false;
    for (let i = source; i < source + sourceCount; i++) {
        if (state.database.events[i].type == "child") {
            swapsChildren = true;
            break;
        }
    }
    for (let i = target; i < target + targetCount; i++) {
        if (state.database.events[i].type == "child") {
            swapsChildren = true;
            break;
        }
    }



    let realTarget;
    if (source > target) {
        realTarget = target;
    } else {
        realTarget = target + targetCount - sourceCount;
    }

    const block = state.database.events.splice(source, sourceCount);
    while (block.length > 0) {
        state.database.events.splice(realTarget, 0, block.pop());
    }

    saveCurrentData();
    loadAnimationParams();
    sendEventList();

    if (swapsChildren && pluginSettings.drawTree)
        drawTree();

}


// this function is clicked when the user clicks on the animate bar
function clickAnimateBar(newIndex: number) {
    if (newIndex == state.database.selected)
        return;
    deleteHoverFrames();
    saveAnimationParams();
    state.database.selected = newIndex;
    saveCurrentData();
    loadAnimationParams();
    sendEventList();
}



//these frames are displayed when the mouse hovers over an event. In principle, there should be at most one, but for some reason the delete events are not matched with the create events, and therefore I keep a list of all frames, and delete all of them.
const hoverFrames: RectangleNode[] = []

//deletes all hover frames
function deleteHoverFrames() {
    while (hoverFrames.length > 0)
        hoverFrames.pop().remove();
}

//when the mouse hovers over an event, then it should be highlighted a little frame
function hoverEvent(index: number): void {

    if (index == -1) {
        //if the index is -1, then the mouse has left, and the frames should be deleted
        deleteHoverFrames();
    }
    else {


        //otherwise, the index says which event is hovered over. It will be surrounded by a frame
        const event = state.database.events[index];
        const link = findEventObject(event, state.currentSlide);
        if (link != null) {

            const margin = 20;
            // create a hover frame
            const hoverFrame = figma.createRectangle();
            hoverFrame.resize(link.width + 2 * margin, link.height + 2 * margin);
            hoverFrame.x = link.x - margin
            hoverFrame.y = link.y - margin;
            hoverFrame.fills = [{
                type: 'SOLID',
                color: {
                    r: 173 / 255,
                    g: 216 / 255,
                    b: 230 / 255
                }
            }];
            hoverFrame.name = 'slajdomat selection';
            hoverFrame.opacity = 0.5;
            // make the hoverframe be behind everything
            state.currentSlide.insertChild(0, hoverFrame);
            hoverFrames.push(hoverFrame);

        }
    }
}

//code that is run when the plugin is closed
function closePlugin(): void {
    deleteHoverFrames();
}


//if the event on a plugin is clicked, then the corresponding object in figma should be selected
function clickEvent(index: number): void {
    const event = state.database.events[index];
    if (event.type == 'child') {
        gotoSlide(findSlide(event.id));
    }
}

// save the plugin data, for the current slide, to the file
function saveCurrentData(): void {
    state.database.name = state.currentSlide.name;
    state.currentSlide.setPluginData("database", JSON.stringify(state.database));
}


// the opposite of the previous function
function loadCurrentData(slide: FrameNode): void {
    state.currentSlide = slide;
    state.database = getDatabase(state.currentSlide);
    cleanDatabase();
}


function fixVersion(database: Database): void {
    if (database.originalParams == undefined)
        database.originalParams = {};
}


//get the database for a slide
function getDatabase(slide: FrameNode): Database {
    const s = slide.getPluginData("database");
    if (s == '')
        return undefined
    else {
        const parsed = JSON.parse(s);
        fixVersion(parsed);
        return parsed;
    }
}



//a node is a slide if it contains a database
function isSlideNode(node: FrameNode): boolean {
    if (node == null)
        return false;
    return (getDatabase(node) != null)
}

//return the list of all slides
function allSlides(): FrameNode[] {
    const retval = [] as FrameNode[];
    for (const node of (figma.currentPage.children as FrameNode[])) {
        if (isSlideNode(node))
            retval.push(node)
    }
    return retval
}


//find an node in the current slicde with the given id
function findOverlayNodeById(id: string, slide: FrameNode): SceneNode {
    for (const child of slide.children)
        if (id == overlayId(child))
            return child as SceneNode;
}

//Gives the object in the slide that corresponds to the event. For a show/hide event this is the node that is shown/hidden. For a child event, this is the link to the child.
function findEventObject(event: PresentationNode, slide: FrameNode): SceneNode {
    if (event.type == 'child') {
        //find the object in the current slide, which represents a link to a child slide. This object is indicated by plugin data. Currently, it is a semi-transparent red rectangle.
        const nodes = slide.findAll((node: SceneNode) => node.getPluginData("childLink") == event.id);
        if (nodes.length > 0)
            return nodes[0] as SceneNode
    }
    else {
        // for overlay events, we search if the corresponding object exists in the current slide
        return findOverlayNodeById(event.id, slide);
    }
    return null;
}


// disable events that are not available, and fix stuff from older versions
// Among other places, this code is called at sendEventList, which is called at every selection change. Therefore, this code should be made more efficient.
function cleanDatabase(): void {
    
    // we will want to redraw the tree if some child events have changed
    let shouldRedrawTree = false;

    state.database.name = state.currentSlide.name;

    // this will be called when opening the slide for the first time, or 
    // when using a slide created in older versions
    if (state.database.selected == undefined)
        state.database.selected = state.database.events.length;

    //for each event, check if it is active
    // a child event is active if the linked frame exists
    // a show/hide event is active if the linked object exists
    // for the active show/hide events, store the index of the corresponding item
    for (const event of state.database.events) {
        const oldEnabled = event.enabled;
        event.enabled = 'disabled';
        const node = findEventObject(event, state.currentSlide);
        if (node != null) {
            if (event.type == "child") {
                const f = findSlide(event.id);
                if (f != null) {
                    event.name = f.name;
                    node.name = 'link to ' + f.name;
                    event.enabled = 'enabled';
                }
            }
            if (event.type == "show" || event.type == "hide" || event.type == "animate") {
                event.name = node.name;
                event.enabled = 'enabled';
            }
        }
        if (oldEnabled != event.enabled && event.type == "child")
        {
            shouldRedrawTree = true;
        }
    }
    
    if (shouldRedrawTree &&  pluginSettings.drawTree == true) {
        saveCurrentData();
        drawTree();
    }
}


//return any slide that points to slide as a child
function parentSlide(slide: FrameNode): FrameNode {
    for (const other of allSlides()) {
        const db = getDatabase(other);
        if (db != undefined)
            for (const event of db.events)
                if (event.type == 'child' && event.id == slideId(slide))
                    return other;
    }
    return null;
}


//set the current slide of the plugin
function setCurrentSlide(slide: FrameNode): void {

    if (slide != null) {
        loadCurrentData(slide);
        const isRoot = getRoot() == state.currentSlide;
        const msg: PluginCodeToUI = {
            type: 'slideChange',
            docName: figma.root.name,
            slide: state.currentSlide.name,
            isRoot: isRoot,
            slideCount: allSlides().length,
        }

        sendToUI(msg);
        sendEventList();
        updateThumbnails();

    } else {
        sendToUI({
            type: 'noSlide'
        })
    }
}

//go to a slide and show it on the screen
function gotoSlide(slide: FrameNode): void {
    figma.viewport.scrollAndZoomIntoView([slide]);
    setCurrentSlide(slide);
}


//returns the slide with the currently selected object
function slideWithSelection(): FrameNode {
    const sel = figma.currentPage.selection;
    if (sel.length > 0) {
        let node = sel[0];
        while (!isSlideNode(node as FrameNode) && node != null)
            node = node.parent as SceneNode;
        return node as FrameNode;
    } else
        return null;
}

//finds the root from previous sessions
function getRoot(): FrameNode {
    const rootSlide = findSlide(figma.root.getPluginData('rootSlide'));
    if (rootSlide == null) {
        setRoot();
    }
    return rootSlide;

}

//change the root to the current slide
function setRoot(): void {
    figma.root.setPluginData('rootSlide', slideId(state.currentSlide));
}



//event handler for when the document has changed. We use this to re-proportion the red rectangles for the child link
function docChange(changes: DocumentChangeEvent): void {

    for (const x of changes.documentChanges) {
        if ((x.type == 'PROPERTY_CHANGE')) {
            const change = x.node as SceneNode;
            if (x.node.type == 'TEXT') {
                matReplacer(change as TextNode);
            }
            if ((!change.removed) && (change.getPluginData('childLink') != '')) {
                const rect = change as RectangleNode;
                rect.resize(rect.width, rect.width * state.currentSlide.height / state.currentSlide.width);
            }


        }
    }

}

//event handler for when the selection has changed
function selChange(): void {
    //if there is a saved selection, this means that the change was triggered by the user hovering over the event list in the plugin, and hence it should not count

    const slide = slideWithSelection();


    //we change the current slide if it satisfies certain conditions: or the selection has moved to some other non-null slide (the selection is in a null slide if it is outside all slides) 
    if
        //it has been removed; or
        ((state.currentSlide != null && state.currentSlide.removed) ||
        //the selection has moved to some other non-null slide; or 
        (slide != state.currentSlide && slide != null) ||
        //the name of the slide has changed
        (state.currentSlide != null && state.currentSlide == slide && state.currentSlide.name != slide.name))
        setCurrentSlide(slide);
    else if (state.currentSlide != undefined && state.database.name != state.currentSlide.name) {
        //if the name of the current slide was changed, then we also send this to the ui
        setCurrentSlide(state.currentSlide);
    }
    else if (state.currentSlide != null)
        sendEventList();

    const sel = figma.currentPage.selection;

    const msg: PluginCodeToUI = {
        type: 'selChange',
        selected: false, // is there at least one object that can be used for show/hide
        latexState: LatexState.None, // is the current selection an object that can be latexed/de-latexed
        canInsert: false, // is the caret in a text field where characters can be inserted
        currentFont: null as FontName
    };

    for (const item of figma.currentPage.selection) {
        if (canBeOverlayTarget(item))
            msg.selected = true;
    }

    // this part of the code is for the math features of latexit and inserting characters

    if (sel.length == 1) {
        if (sel[0].type == "TEXT") //the selected object can be latexed
            msg.latexState = LatexState.Latex;
        if (matematykData(sel[0]) != null) //the selected object can be de-latexed
            msg.latexState = LatexState.Delatex
    }
    if (figma.currentPage.selectedTextRange != null) {
        const r = figma.currentPage.selectedTextRange.end;
        if (r > 0) {
            msg.currentFont = (sel[0] as TextNode).getRangeFontName(r - 1, r) as FontName
        }
        msg.canInsert = true;
    }
    //send the information about the updated selection
    sendToUI(msg)
}


//handle messages that come from the ui
function onMessage(msg: PluginUIToCode) {
    
    switch (msg.type) {

        case 'notify':
            //write a user notification
            figma.notify(msg.text);
            break

        case 'clickAnimateBar':
            clickAnimateBar(msg.index);
            break;

        case 'createEvent':
            //create a new event for the current slide
            //this covers show/hide/child events
            createEvent(msg);
            break;

        case 'settings':
            //get settings from the interface
            getLatexSettings(msg.pluginSettings);
            break;

        case 'removeEvent':
            //remove an event
            removeEvent(msg.index);
            break;

        case 'mergeEvent':
            //merge an event with the previous one
            mergeEvent(msg.index);
            break;

        case 'moveEvent':
            //swap the order of two events
            reorderEvents(msg.index, msg.target);
            deleteHoverFrames();
            break;

        case 'makeFirst':
            //make a first slide
            setCurrentSlide(createNewSlide(msg.width, msg.height, 'new slide'));
            figma.viewport.scrollAndZoomIntoView([state.currentSlide]);
            break;

        case 'saveFile':
            //export the files to svg files
            exportSlides();
            break;

        case 'changeRoot':
            setRoot();
            break;

        case 'mouseEnterPlugin':
            // //I'm not sure if this is necessary, but just in case I refresh the event list when the mouse enters the plugin.
            // if (state.currentSlide != null)
            //     sendEventList();
            break;

        case 'hoverEvent':
            //highlight an event when the mouse hovers over it. For show/hide event we change the selection to the concerned object, for child events we do this for the link.
            hoverEvent(msg.index);
            break;

        case 'requestDropDown':
            //request a list of all slides for the current slide
            sendDropDownList();
            break;

        case 'mouseLeave':
            break;

        case 'clickEvent':
            //if an event is clicked, then the selection stays permanent
            clickEvent(msg.index)
            break;

        case 'gotoSlide':
            //the parent button is clicked
            console.log(msg.which);
            if (msg.which == 'parent')
                gotoSlide(parentSlide(state.currentSlide));
            else
                gotoSlide(findSlide(msg.which.slideId));
            break;

        case 'addWord':
            //functions for the matematyk plugin ******
            matematykWord(msg.text);
            break;

        case 'latexit':
            //the user requests turning text into latex
            latexitOne();
            break;

        case 'latexitTwo':
            //the second stage of latexit, is necessary because only the ui can communicate with the web
            latexitTwo(msg.text);
            break;

        case 'drawTree' :
            //draw a tree of the presentation
            drawTree();
            break;

        default:
            throw "uncovered message type sent to code: "

    }
}

figma.on('documentchange', docChange);
figma.on("selectionchange", selChange);
figma.on('close', closePlugin);
figma.showUI(__html__, {
    width: 230,
    height: 500
});
figma.ui.onmessage = onMessage;



setCurrentSlide(slideWithSelection());
initSettings();


