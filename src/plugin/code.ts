import { } from '@figma/plugin-typings'

export {
    pluginSettings,
    sendSettings,
    getDatabase,
    allSlides,
    findEventObject,
    state,
    saveCurrentData,
    loadCurrentData,
    findSlide,
    allTexts,
    sendToUI,
    getRoot
}

import {
    PluginSettings,
    Database,
    LatexState,
    MessageToCode,
    MessageToUI
} from './plugin-types'

import {
    upgradeVersion
} from './plugin-version'

import {
    exportSlides
} from './export'

import {
    matematykData,
    latexitOne,
    latexitTwo,
    matematykWord
} from './matematyk'

import {
    Rect
} from '../viewer/transform'
import {
    SlideEvent,
    OverlayEvent,
    ZoomEvent
} from '../viewer/types';
import { freshName, sanitize } from '../common/helper'




//*** global variables */

const state = {
    //saved selection when temporarily selecting an object through mouseover 
    savedSelection: [] as readonly SceneNode[],

    //the data for the current slide, mainly the event list
    database: null as Database,
    //the current slide, as a frame of figma
    currentSlide: null as FrameNode,
}


//the plugin settings
let pluginSettings: PluginSettings;



function sendToUI(msg: MessageToUI): void {
    figma.ui.postMessage(msg)
}

//********* settings *********/
//get the settings from the ui
function getSettings(settings: PluginSettings): void {
    pluginSettings = settings;
    figma.clientStorage.setAsync('slajdomat', JSON.stringify(settings));
    sendSettings();
}

//send the settings to the ui
function sendSettings(): void {
    sendToUI({
        type: 'settings',
        settings: pluginSettings
    });
}

//initialize the settings for the plugin
function initPlugin() {


    upgradeVersion();
    figma.clientStorage.getAsync('slajdomat').then(
        x => {
            //the default plugin settings
            const defaultSettings = {
                words: ['∀', '∃', '∧', '∨', '∈'],
                active: false,
                mathFont: {
                    family: 'STIXGeneral',
                    style: 'Regular'
                },
                mathFontSize: 1,
                serverURL: 'http://localhost:3001',
                latexitURL: 'https://latex.codecogs.com/svg.latex?'
            }

            try {
                pluginSettings = {
                    ...defaultSettings,
                    ...JSON.parse(x)
                };
            } catch (e) {
                pluginSettings = defaultSettings;
            }
            sendSettings();
            selChange();
        }
    )
}



//Creates a new slide of given width and height. The place for the new slide is chosen to be close to the current slide.
function createNewSlide(width: number, height: number, name: string): FrameNode {


    //finds a place for the new slide, by searching in a spiral around the current slide (or the origin, if there is no current slide)
    function findPlace(width: number, height: number): Rect {
        //does rectangle a intersect any frame
        function intersectsNothing(a: Rect) {
            function intersects(a: Rect, b: FrameNode) {
                if (a.x > b.x + b.width || a.x + a.width < b.x)
                    return false;
                if (a.y > b.y + b.height || a.y + a.height < b.y)
                    return false;
                return true;
            }
            for (const b of allSlides())
                if (intersects(a, b))
                    return false;
            return true;
        }

        const candidate: Rect = {
            width: width,
            height: height,
            x: 0,
            y: 0
        };

        const basex = (state.currentSlide == null ? 0 : state.currentSlide.x);
        const basey = (state.currentSlide == null ? 0 : state.currentSlide.y);

        //search for free space below the current slide,
        //using the city metric (i.e. the search follows a square spiral pattern)
        let i = 0;
        let searching = true;
        while (searching) {
            i++;
            for (let j = 0; j < i && searching; j++) {
                candidate.x = basex + j * width;
                candidate.y = basey + (i + 0.2) * height;
                if (intersectsNothing(candidate)) {
                    searching = false;
                    break;
                }
                candidate.x = basex + (i + 0.2) * width;
                candidate.y = basey + j * height;
                if (intersectsNothing(candidate)) {
                    searching = false;
                    break;
                }
                candidate.x = basex - j * width;
                candidate.y = basey + (i + 0.2) * height;
                if (intersectsNothing(candidate)) {
                    searching = false;
                    break;
                }
                candidate.x = basex - (i + 0.2) * width;
                candidate.y = basey + j * height;
                if (intersectsNothing(candidate))
                    searching = false;
            }
        }
        return candidate;
    }


    const place = findPlace(width, height);
    const newSlide = figma.createFrame();
    newSlide.name = name;
    newSlide.x = place.x;
    newSlide.y = place.y
    newSlide.resize(width, height);
    const id = freshName(sanitize(newSlide.name), avoidList(newSlide));
    const database: Database = {
        name: newSlide.name,
        id: id,
        events: []
    }
    newSlide.setPluginData("database", JSON.stringify(database));


    return newSlide;
}


//send the  list which says what are the possible candidates for child slides. 
function sendDropDownList() {
    const msg: MessageToUI = {
        type: 'dropDownContents',
        slides: [] as {
            name: string,
            id: string
        }[]
    }


    for (const node of allSlides())
        if (node != state.currentSlide) {
            let alreadyChild = false;
            for (const e of state.database.events) {
                if (e.type == "child" && e.id == slideId(node)) {
                    alreadyChild = true;
                }
            }
            if (!alreadyChild)
                msg.slides.push({
                    name: node.name,
                    id: slideId(node)
                });
        }


    sendToUI(msg);
}


//send the event list of the current slide
function sendEventList() {
    cleanDatabase();
    sendToUI({
        type: 'eventList',
        events: state.database.events
    });
}

//returns a unique id for an event, inside the current slide
function newEventId(): string {

    //the id is a number (stored as a string). In order to achieve uniqueness, we store the maximal id used so far inside the attribute eventId.
    let retval: number;
    const maxId = state.currentSlide.getPluginData('eventId');
    if (maxId == '')
        retval = 1;
    else
        retval = parseInt(maxId) + 1;
    state.currentSlide.setPluginData('eventId', retval.toString());
    return retval.toString();
}

//Creates a child event in the current slide, together with a child link (as described in the previous function) that represents the child. 
function createChildEvent(id: string): RectangleNode {

    const slide: FrameNode = findSlide(id);
    const newEvent: ZoomEvent =
    {
        type: "child",
        id: id,
        name: slide.name,
        merged: false,
        children: [],
        keywords: [],
        eventId: newEventId()
    }
    state.database.events.push(newEvent);

    const width = 100;
    const rect = figma.createRectangle();
    rect.resize(width, width * slide.height / slide.width);
    rect.fills = [{
        type: 'SOLID',
        color: {
            r: 1,
            g: 0,
            b: 0
        }
    }];
    rect.opacity = 0.5;
    rect.setPluginData("childLink", id)
    rect.name = "Link to " + slide.name;
    state.currentSlide.appendChild(rect);
    rect.x = 100
    rect.y = 100
    return rect;

}

//give the list of all texts used in descendants
function allTexts(n: SceneNode, avoid: SceneNode[] = []): string[] {

    if (avoid.includes(n))
        return [];

    if (n.type == 'TEXT') {
        return [n.name];
    }
    if (n.type == 'GROUP' || n.type == 'FRAME') {
        let retval: string[] = [];
        for (const child of n.children) {
            retval = retval.concat(allTexts(child as SceneNode, avoid))
        }
        return retval;
    }
    //otherwise there are no strings
    return [];
}

// create new event 
//msg.subtype says what kind it is, values are 'child', 'show', 'hide', etc.
//msg.id is used for the 'child' event
function createEvent(eventInfo: {
    type: 'createEvent',
    subtype: string,
    id: string,
    name: string
}): void {

    //returns the contents the longest text node in the descendants. Used to select a name for a group node
    function goodName(node: SceneNode): string {
        const texts = allTexts(node);

        //if there is no text, do not change the name
        if (texts.length == 0)
            return node.name;

        //otherwise, return the longest text    
        let retval = texts[0];
        for (const text of texts) {
            if (text.length > retval.length)
                retval = text;
        }
        return retval
    }

    if (eventInfo.subtype == 'show' || eventInfo.subtype == 'hide') {
        

        let sorted: SceneNode[] = [];

        //we look at the set of x values and y values of the selected objects, to determine if this set is more vertical or more horizontal, so that we can determine the sorting order
        const xarray = [] as number[];
        const yarray = [] as number[];

        for (const item of figma.currentPage.selection) {
            if (isShowHideNode(item)) {
                xarray.push(item.x);
                yarray.push(item.y);
                sorted.push(item);
            }
        }
        //dx is the maximal difference between x coordinates, likewise for dy
        const dx = Math.max(...xarray) - Math.min(...xarray);
        const dy = Math.max(...yarray) - Math.min(...yarray);

        //the events are sorted by x or y depending on which of dx, dy is bigger
        const sortIndex = (a: SceneNode) => {
            if (dx > dy)
                return a.x
            else
                return a.y
        };
        //the order of events is so that it progresses in the down-right direction

        sorted = sorted.sort((a, b) => sortIndex(a) - sortIndex(b));
        for (const item of sorted) {

            if (item.type === 'GROUP' && item.name.startsWith('Group')) {
                //improve the name
                item.name = goodName(item);
            }

            const newEvent: OverlayEvent =
            {
                type: eventInfo.subtype,
                id: overlayId(item),
                name: item.name,
                merged: false,
                keywords: [],
                eventId: newEventId()
            }
            state.database.events.push(newEvent)
        }

    }
    if (eventInfo.subtype == 'child') {
        if (eventInfo.id == null) {
            const newSlide = createNewSlide(state.currentSlide.width, state.currentSlide.height, eventInfo.name);
            eventInfo.id = slideId(newSlide)
        }
        createChildEvent(eventInfo.id);
    }
    saveCurrentData();
    sendEventList();
}

//remove an event from the current event list
function removeEvent(index: number): void {
    const event = state.database.events[index];
    if (event.type == "child") {
        const rect = findEventObject(event, state.currentSlide);
        if (rect != null)
            rect.remove();
    }
    state.database.events.splice(index, 1);
    saveCurrentData();
    sendEventList();
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
    sendEventList();

}

//when the mouse hovers over an event, then it should be highlighted by figma, with a pretend selection
function hoverEvent(index: number): void {
    if (index == -1) {
        try {
        if (state.savedSelection != null) {
            figma.currentPage.selection = state.savedSelection;
        }
        state.savedSelection = null;}
        catch (e) {
            console.log('this is a place that is troublesome')
            console.log(e);
            console.log(state.savedSelection);
        }
    } else {
        if (state.savedSelection == null)
            state.savedSelection = figma.currentPage.selection;

        const event = state.database.events[index];
        const link = findEventObject(event, state.currentSlide);
        if (link != null)
            figma.currentPage.selection = [link];
    }
}

//if the event on a plugin is clicked, then the corresponding object in figma should be selected
function clickEvent(index: number): void {
    const event = state.database.events[index];
    if (event.type == 'child') {
        gotoSlide(findSlide(event.id));
    } else
        state.savedSelection = figma.currentPage.selection;
}

// I use my own id's, instead of those of figma, so that copy and paste between presentations works
//the id for a slide is stored in its database
function slideId(slide: FrameNode): string {
    const database = getDatabase(slide);
    if (database != undefined)
        return database.id;
    else
        return undefined;
}

//list of id's to avoid when creating a new id in a slide
function avoidList(slide: FrameNode): string[] {

    const avoid = [] as string[];

    for (const child of slide.children)
        avoid.push(child.getPluginData('id'));

    for (const slide of allSlides())
        avoid.push(slideId(slide));

    return avoid;
}

//the id of an overlay is stored in the node 
function overlayId(node: SceneNode) {
    let retval = node.getPluginData('id');
    if (retval == '') {
        // we need to generate a new id
        const slide = node.parent as FrameNode;
        if (!isSlideNode(slide))
            throw 'asked for overlay id of a node that is not a child of a slide';

         
        retval = freshName(sanitize(node.name), avoidList(slide));
        //save the name in the node
        node.setPluginData('id',retval);
    }
    return retval;
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


//get the database for a slide
function getDatabase(slide: FrameNode): Database {
    const s = slide.getPluginData("database");
    if (s == '')
        return undefined
    else {
        const parsed = JSON.parse(s);
        // fixVersion(parsed);
        return parsed;
    }
}


//says if the node is a possible target for a show/hide event
function isShowHideNode(node: SceneNode): boolean {
    if (node.parent != state.currentSlide || node.getPluginData('childLink') != '')
        return false;
    return true;
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

//find a slide in the document with the given id
function findSlide(id: string): FrameNode {
    for (const node of allSlides())
        if (slideId(node) == id)
            return node;
    return null;
}


//Gives the object in the slide that corresponds to the event. For a show/hide event this is the node that is shown/hidden. For a child event, this is the link to the child.
function findEventObject(event: SlideEvent, slide: FrameNode): SceneNode {
    if (event.type == 'show' || event.type == 'hide')
        for (const child of slide.children)
            if (event.id == overlayId(child))
                return child as SceneNode;

    if (event.type == 'child') {
        //find the object in the current slide, which represents a link to a child slide. This object is indicated by plugin data. Currently, it is a semi-transparent red rectangle.
        const nodes = slide.findAll((node: SceneNode) => node.getPluginData("childLink") == event.id);
        if (nodes.length > 0)
            return nodes[0] as SceneNode
    }
    return null;
}


//for each event, check if it is active
// a child event is active if the linked frame exists
// a show/hide event is active if the linked object exists
// for the active show/hide events, store the index of the corresponding item
function cleanDatabase(): void {
    state.database.name = state.currentSlide.name;
    for (const event of state.database.events) {
        event.disabled = true;
        const node = findEventObject(event, state.currentSlide);
        if (node != null) {
            if (event.type == "child") {
                const f = findSlide(event.id);
                if (f != null) {
                    event.name = f.name;
                    node.name = f.name;
                    event.disabled = false;
                }
            }
            if (event.type == "show" || event.type == "hide") {
                event.name = node.name;
                event.disabled = false;
            }
        }
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
    // state.currentSlide = slide;


    if (slide != null) {
        loadCurrentData(slide);
        const isRoot = getRoot() == state.currentSlide;
        const msg: MessageToUI = {
            type: 'slideChange',
            docName: figma.root.name,
            slide: state.currentSlide.name,
            isRoot : isRoot,
            slideCount: allSlides().length,
        }
        /*
        //this code runs too long and creates trouble
        const parent = parentSlide(slide);
        if (parent == null)
            msg.parent = null
        else
            msg.parent = parent.name;
        */

        sendToUI(msg);
        sendEventList();
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
function getRoot() : FrameNode {
    const rootSlide = findSlide(figma.root.getPluginData('rootSlide'));
    if (rootSlide == null) {
        setRoot();
    }
    return rootSlide;
    
}

//change the root to the current slide
function setRoot() : void {
    figma.root.setPluginData('rootSlide', slideId(state.currentSlide));
}


//the selection has changed
function selChange(): void {


    //if there is a saved selection, this means that the change was triggered by the user hovering over the event list in the plugin, and hence it should not count
    if (state.savedSelection == null || state.savedSelection.length == 0) {
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


        const msg: MessageToUI = {
            type: 'selChange',
            selected: false, // is there at least one object that can be used for show/hide
            latexState: LatexState.None, // is the current selection an object that can be latexed/de-latexed
            canInsert: false, // is the caret in a text field where characters can be inserted
            currentFont: null as FontName
        };

        for (const item of figma.currentPage.selection) {
            if (isShowHideNode(item))
                msg.selected = true;
        }

        // this part of the code is for the math features of latexit and inserting characters
        const sel = figma.currentPage.selection;
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
}


//handle messages that come from the ui
function onMessage(msg: MessageToCode) {

    switch (msg.type) {

        case 'notify':
            //write a user notification
            figma.notify(msg.text);
            break

        case 'createEvent':
            //create a new event for the current slide
            //this covers show/hide/child events
            createEvent(msg);
            break;

        case 'settings':
            //get settings from the interface
            getSettings(msg.pluginSettings);
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
            //I'm not sure if this is necessary, but just in case I refresh the event list when the mouse enters the plugin.
            if (state.currentSlide != null)
                sendEventList();
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
            //unselect the action from the previous event
            figma.currentPage.selection = state.savedSelection;
            break;

        case 'clickEvent':
            //if an event is clicked, then the selection stays permanent
            clickEvent(msg.index)
            break;

        case 'gotoParent':
            //the parent button is clicked
            gotoSlide(parentSlide(state.currentSlide));
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


        default:
            throw "uncovered message type sent to code: "

    }






}


figma.on("selectionchange", selChange);
figma.showUI(__html__, {
    width: 230,
    height: 500
});
figma.ui.onmessage = onMessage;


setCurrentSlide(slideWithSelection());
initPlugin();
// repairOldFormat();