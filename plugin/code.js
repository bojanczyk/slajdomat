//*** global variables */
//saved viewport when termporarily showing some other part
var savedViewport;
//saved selection when temporarily selecting an object through mouseover 
var savedSelection;

//the data for the current slide, mainly the event list
var database = null;
//the current slide, as a frame of figma
var currentSlide = null;

//the root slide, given by id
var rootSlide;

//prefix of plugin data
const saveprefix = "habzdryg data (do not delete): ";




// I don't know how to set the viewport, so I create a rectangle
function setViewport(rect) {
    var viewport = figma.createRectangle();
    viewport.x = rect.x;
    viewport.y = rect.y;
    viewport.resize(rect.width, rect.height);
    //  viewport.fills = [{type: 'SOLID', color: {r: 1, g: 0.5, b: 0}}];
    //   figma.currentPage.appendChild(savedViewport);
    figma.viewport.scrollAndZoomIntoView([viewport]);
    viewport.remove();
}

var currentOutline = null;

function outlineFrame(frame) {
    if (frame == null) {
        currentOutline.remove();
        currentOutline = null;
    } else {
        if (currentOutline != null)
            throw "outline frame already set";

        currentOutline = figma.createRectangle();
        currentOutline.x = frame.x;
        currentOutline.y = frame.y;
        currentOutline.resize(frame.width, frame.height);
        currentOutline.opacity = 0.5;
        currentOutline.fills = [{
            type: 'SOLID',
            color: {
                r: 1,
                g: 0,
                b: 0
            }
        }];
    }

}



//find an object in the current slide frame with the given id
function findShowHide(id) {
    const nodes = currentSlide.findAll(node => node.id == id);
    return nodes[0];
}

function findChildRectangle(id, slide) {
    const nodes = slide.findAll(node => node.type == 'RECTANGLE' && node.name == id);
    if (nodes.length > 0)
        return nodes[0]
    else
        return null;
}

//creates a new slide, and attaches it as a child of the current slide
function createNewChild() {
    const nodes = figma.root.findAll(isSlideNode);

    // the position of the new child will be at the bottom, on the left
    var minx = 0;
    var maxy = 0;
    for (const n of nodes) {
        if (n.x < minx)
            minx = n.x;
        if (n.y + n.height > maxy)
            maxy = n.y + n.height;
    }

    var newframe = figma.createFrame();
    newframe.x = minx;
    newframe.y = maxy + 100;
    newframe.resize(currentSlide.width, currentSlide.height);

    createChildEvent(newframe.id);

    saveCurrentData();
    figma.ui.postMessage({
        type: 'refreshEventList',
        events: database.events
    });
}


function createChildEvent(id) {

    const scale = 100;
    const frame = findFrame(id);
    var box = figma.createRectangle();
    box.x = 100;
    box.y = 100;
    box.resize(scale, frame.height * scale / frame.width);
    box.fills = [{
        type: 'SOLID',
        color: {
            r: 1,
            g: 0,
            b: 0
        }
    }];
    currentSlide.appendChild(box);
    box.name = id;
    database.events.push({
        type: "child",
        id: id,
        name: frame.name
    })

}

// create new event
function createEvent(id, subtype) {
    if (subtype == 'show' || subtype == 'hide') {
        var selected = figma.currentPage.selection;
        for (const item of selected) {
            database.events.push({
                type: subtype,
                id: item.id,
                name: item.name
            })
        }

    }
    if (subtype == 'child')
        createChildEvent(id);


    saveCurrentData();
    figma.ui.postMessage({
        type: 'refreshEventList',
        events: database.events
    });
}

//remove an event from the current event list
function removeEvent(index) {
    var event = database.events[index];
    if (event.type = "child") {
        var rect = findChildRectangle(event.id, currentSlide);
        if (rect != null)
            rect.remove();
    }
    database.events.splice(index, 1);
    saveCurrentData();
}

//change order of event list so that source becomes target
function transposition(source, target) {
    var tmp = database.events[source];
    database.events[source] = database.events[target]
    database.events[target] = tmp;
    saveCurrentData();
}




//send the svg file to the ui, which then sends it to the server
function saveFile() {

    //go through all descendant  nodes to and clean their databases
    //cleaning is needed because the user might have deleted some 
    //elements from the picture, thus making events disabled

    const nodes = figma.root.findAll(isSlideNode);
    var promiseArray = [];
    var fileNames = [];
    var pageCount = 0;


    var stack = [];

    function saveRec(node) {
        var savedPages = pageCount;
        pageCount += 1;
        if (stack.includes(node)) {
            var cycle = "The slides contain a cycle: \n";
            for (const n of stack)
                cycle += (n.name + "\n");
            alert(cycle + node.name);
            return;
        } else {
            stack.push(node);
            currentSlide = node;
            loadCurrentData();

            for (event of database.events)
                if (event.type == "child")
                    saveRec(findFrame(event.id));

            currentSlide = node;
            loadCurrentData();
            database.pagecount = pageCount - savedPages;
            saveCurrentData();
            fileNames.push(node.id);
            promiseArray.push(
                node.exportAsync({
                    format: 'SVG',
                    svgOutlineText: false,
                    svgIdAttribute: true
                }));
            stack.pop();
        }
    }
    
    saveRec(currentSlide);

    var msg = {
        type: 'saveData',
        fileList: []
    };


    Promise.all(promiseArray).then(
        x => {
            for (var i = 0; i < fileNames.length; i++)
                msg.fileList.push({
                    name: fileNames[i],
                    file: x[i]
                });
            figma.ui.postMessage(msg);
        }
    );
}

// the plugin data is stored in a rectangle of the corner of the current slide, whose prefix is saveprefix
//the following function finds the rectangle for the current frame
//if this rectangle does not exist, then it is created
function findCurrentSaveNode() {
    function isSaveDataNode(node) {
        return (node.type === "RECTANGLE") && (node.name.startsWith(saveprefix));
    }

    function newSaveDataNode() {
        var rect = figma.createRectangle();
        rect.x = 1;
        rect.y = 1;
        rect.resize(0.1, 0.1);
        currentSlide.insertChild(0, rect);
        rect.name = saveprefix + JSON.stringify({
            events: []
        });
        rect.locked = true;
        return rect;
    }


    const nodes = currentSlide.findAll(isSaveDataNode);
    if (nodes.length > 0)
        return nodes[0];
    else
        return newSaveDataNode();
}

// save the plugin data, for the current slide, to the file
function saveCurrentData() {
    var rect = findCurrentSaveNode();
    cleanDatabase();
    database.name = currentSlide.name;
    database.id = currentSlide.id;
    database.root = (currentSlide.id == rootSlide);
    rect.name = saveprefix + JSON.stringify(database);
}


// the opposite of the previous function
function loadCurrentData() {
    var rect = findCurrentSaveNode();
    // cut off the save prefix
    var s = rect.name.slice(saveprefix.length);
    database = JSON.parse(s);

}


//return the most central frame
//the centrality of a frame is the visible area
//this function is used to select the current frame when the plugin is opened
function mostCentral() {
    //return visible surface area of a node
    function centrality(node) {
        function max(x, y) {
            if (x > y) return x;
            else return y;
        }

        function min(x, y) {
            if (x > y) return y;
            else return x;
        }

        function right(rect) {
            return rect.x + rect.width;
        }

        function bottom(rect) {
            return rect.y + rect.height;
        }

        var l, r, t, b;
        l = max(node.x, figma.viewport.bounds.x);
        t = max(node.y, figma.viewport.bounds.y);
        r = min(right(node), right(figma.viewport.bounds));
        b = min(bottom(node), bottom(figma.viewport.bounds));

        if ((r - l > 0) && (b - t > 0))
            return (r - l) * (b - t);
        else
            return 0;
    }

    var maxCentrality = 0;
    var retval = null;
    const nodes = figma.root.findAll(isSlideNode)
    for (const x of nodes) {
        if (centrality(x) >= maxCentrality) {
            maxCentrality = centrality(x);
            retval = x;
        }
    }

    if (retval == null)
        throw "no slide frames";
    else
        return retval;
}


//a node is a slide if it is a frame and its parent is not a frame
function isSlideNode(node) {
    if (node == null)
        return false;
    return (node.type === "FRAME") && (node.parent.type === "PAGE")
}

//find a frame in the document with the given id
function findFrame(id) {
    const nodes = figma.root.findAll(node => node.id == id);
    if (nodes.length == 0)
        return null
    else
        return nodes[0];
}

//for each event, check if it is active
// a child event is active if the linked frame exists
// a show/hide event is active if the linked object exists
// for the active show/hide events, store the index of the corresponding item
function cleanDatabase() {
    for (var event of database.events) {
        event.disabled = true;

        if (event.type == "child") {
            var f = findFrame(event.id);
            if (f != undefined)
                event.name = f.name;
            if (f != undefined && findChildRectangle(event.id, currentSlide) != undefined)
                delete event.disabled;
        }

        if (event.type == "show" || event.type == "hide") {
            for (var j = 0; j < currentSlide.children.length; j++) {
                if (currentSlide.children[j].id == event.id) {
                    event.index = j;
                    delete event.disabled;
                }
            }
        }
    }
}


//sends the current event list to the ui, with inactive events disabled
function sendRefresh() {
    cleanDatabase();
    figma.ui.postMessage({
        type: 'refreshEventList',
        events: database.events
    });
}

//select the items that are selected on the current page
function selectedOnCurrentPage() {
    var retval = [];
    var sel = figma.currentPage.selection;
    for (const s of sel) {
        if (s.parent == currentSlide)
            retval.push(s);
    }
    return retval;
}

//returns list of candidates for a child frame, for the current slide
//this list is all frames, except for the current slide and its already added children
function getFrameList() {
    const nodes = figma.root.findAll(x => isSlideNode(x) && x.id != currentSlide.id)
    var outmsg = {
        framelist: [],
        type: 'framelist'
    };
    for (const x of nodes) {
        var alreadyChild = false;
        for (const e of database.events) {
            if (e.type == "child" && e.id == x.id)
                alreadyChild = true;
        }
        if (! alreadyChild)
            outmsg.framelist.push({
                name: x.name,
                id: x.id
            });
    }
    outmsg.selected = (selectedOnCurrentPage().length > 0);
    figma.ui.postMessage(outmsg);
}


//set the current slide of the plugin
function setCurrentSlide(slide) {
    currentSlide = slide;
    loadCurrentData();
    var slidelist = [];
    for (const slide of figma.root.findAll(isSlideNode))
        slidelist.push({
            name: slide.name,
            id: slide.id
        });

    figma.ui.postMessage({
        type: 'init',
        slide: currentSlide.name,
        slideid: currentSlide.id,
        slidelist: slidelist,
        root: (currentSlide.id == rootSlide)
    });
    sendRefresh();
}


//handle messages that come from the ui
function onMessage(msg) {
    //request for a list of candidates for the child frame
    if (msg.type === 'getAllFrames') {
        getFrameList();
    }

    //create a new event for the current slide
    //this covers show/hide/child events
    //an exception is the new child event in the next function
    if (msg.type == 'createEvent') {
        createEvent(msg.id, msg.subtype);
    }

    //create a new slide, and attach it as a child to the current slide 
    if (msg.type == 'createNewChild') {
        createNewChild();
    }

    //remove an event
    if (msg.type == 'removeEvent') {
        removeEvent(msg.index);
    }

    //swap the order of two events
    if (msg.type == 'transposition') {
        transposition(msg.source, msg.target);
    }

    //change the current slide
    if (msg.type == 'changeSlide') {
        var newSlide = findFrame(msg.id);
        figma.viewport.scrollAndZoomIntoView([newSlide]);
        setCurrentSlide(newSlide);
    }

    //export the files to svg's
    if (msg.type == 'saveFile')
        saveFile();

    
    //the mouse is hovering over an event
    //to highlight this event, we select the corresponding object in figma
    if (msg.type == 'mouseEnter') {
        savedSelection = figma.currentPage.selection;
        var selected = findFrame(msg.id);
        if (isSlideNode(selected))
            selected = findChildRectangle(msg.id, currentSlide);
        if (selected != null)
            figma.currentPage.selection = [selected];
    }

    //unselect the action from the previous event
    if (msg.type == 'mouseLeave') {
        figma.currentPage.selection = savedSelection;
    }

    //if an event is clicked, then the selection stays permanent
    if (msg.type == 'click') {
        savedSelection = figma.currentPage.selection;
    }
};



figma.showUI(__html__);
figma.ui.resize(250, 400);
figma.ui.onmessage = onMessage;

setCurrentSlide(mostCentral());
