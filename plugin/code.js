
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

//creates a new frame 
function createNewFrame(width, height) {
    const nodes = figma.root.findAll(isSlideNode);

    //does rectangle a intersect any frame
    function intersectsNothing(a) {
        function intersects(a, b) {
            if (a.x > b.x + b.width || a.x + a.width < b.x)
                return false;
            if (a.y > b.y + b.height || a.y + a.height < b.y)
                return false;
            return true;
        }
        for (const b of nodes)
            if (intersects(a, b))
                return false;
        return true;
    }

    var candidate = {
        width: width,
        height: height
    };

    if (currentSlide == null) {
        candidate.x = 0;
        candidate.y = 0;
    } else {
        //search for free space below the current slide,
        //using the city metric
        var i = 0;
        var searching = true;
        while (searching) {
            i++;
            for (var j = 0; j < i && searching; j++) {
                candidate.x = currentSlide.x + j * width;
                candidate.y = currentSlide.y + (i + 0.2) * height;
                if (intersectsNothing(candidate)) {
                    searching = false;
                    break;
                }
                candidate.x = currentSlide.x + (i + 0.2) * width;
                candidate.y = currentSlide.y + j * height;
                if (intersectsNothing(candidate)) {
                    searching = false;
                    break;
                }
                candidate.x = currentSlide.x - j * width;
                candidate.y = currentSlide.y + (i + 0.2) * height;
                if (intersectsNothing(candidate)) {
                    searching = false;
                    break;
                }
                candidate.x = currentSlide.x - (i + 0.2) * width;
                candidate.y = currentSlide.y + j * height;
                if (intersectsNothing(candidate))
                    searching = false;
            }
        }
    }

    var newframe = figma.createFrame();
    newframe.x = candidate.x;
    newframe.y = candidate.y
    newframe.resize(width, height);
    return newframe;
}

//creates a new slide, and attaches it as a child of the current slide
function createNewChild() {

    var newframe = createNewFrame(currentSlide.width, currentSlide.height);
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
    box.opacity = 0.2;
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
function reorderEvents(source, target) {
    var tmp = database.events.splice(source, 1)[0];
    database.events.splice(target, 0, tmp);
    saveCurrentData();
}




//send the svg file to the ui, which then sends it to the server
function saveFile() {
    //the list of slides and their svg's
    var slideList = [];
    //stack of the recursion, to find cycles in slides
    var stack = [];

    
    async function saveRec(node) {
        if (stack.includes(node)) {
            var cycle = "The slides contain a cycle: \n";
            for (const n of stack)
                cycle += (n.name + "\n");
            figma.notify(cycle + node.name);
            return;
        } else {
            stack.push(node);
            currentSlide = node;
            loadCurrentData();
            saveCurrentData();
            var svg = await node.exportAsync({
                format: 'SVG',
                svgOutlineText: true,
                svgIdAttribute: true
            });
            slideList.push({
                database: database,
                svg: svg
            });
            for (const event of database.events)
                if (event.type == "child" && !(event.disabled))
                    await saveRec(findFrame(event.id));

            stack.pop();
        }
    }

    var savedSlide = currentSlide;
    saveRec(currentSlide).then(x => {
        figma.ui.postMessage({
            type: 'savePresentation',
            presentation: figma.root.name,
            slideList: slideList
        });
        currentSlide = savedSlide;
    });

}


// this is a legacy function
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
    findCurrentSaveNode().remove();
    database.name = currentSlide.name;
    database.id = currentSlide.id;
    currentSlide.setPluginData("database",JSON.stringify(database));
    /*
    //this is legacy code, which saves data to the picture
    //it might come in useful when developing copy paste
    var rect = findCurrentSaveNode();
    rect.name = saveprefix + JSON.stringify(database);
    */
}


// the opposite of the previous function
function loadCurrentData() {
    /*
    //this is legacy code, see the comments for saveCurrentData
    var rect = findCurrentSaveNode();
    // cut off the save prefix
    var s = rect.name.slice(saveprefix.length);
    */
    var s = currentSlide.getPluginData("database");
    if (s == '') {
        //there is no database
        database = {
            name: currentSlide.name,
            id: currentSlide.id,
            events: []
        }
    } else
        database = JSON.parse(s);
    cleanDatabase();

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
                event.disabled = false;
        }

        if (event.type == "show" || event.type == "hide") {
            for (const child of currentSlide.children) {
                if (child.id == event.id) {
                    event.name = child.name;
                    event.disabled = false;
                }
            }
        }
    }
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

//set the current slide of the plugin
function setCurrentSlide(slide) {
    currentSlide = slide;

    if (slide != null) {
        loadCurrentData();
        var msg = {
            type: 'init',
            docName : figma.root.name,
            slide: currentSlide.name,
            slideid: currentSlide.id,
            events: database.events,
            framelist: [],
            selected: (selectedOnCurrentPage().length > 0)
        }

        const nodes = figma.root.findAll(x => isSlideNode(x) && x.id != currentSlide.id);

        for (const x of nodes) {
            var alreadyChild = false;
            for (const e of database.events) {
                if (e.type == "child" && e.id == x.id)
                    alreadyChild = true;
            }
            if (!alreadyChild)
                msg.framelist.push({
                    name: x.name,
                    id: x.id
                });
        }

        figma.ui.postMessage(msg);



    } else {
        figma.ui.postMessage({
            type: 'init'
        })
    }
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
        setCurrentSlide(currentSlide);
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
    if (msg.type == 'reorderEvents') {
        reorderEvents(msg.source, msg.target);
    }

    //make a first slide
    if (msg.type == 'makeFirst') {
        setCurrentSlide(createNewFrame(msg.width, msg.height));
        figma.viewport.scrollAndZoomIntoView([currentSlide]);
    }

    //export the files to svg's
    if (msg.type == 'saveFile')
        saveFile();

    if (msg.type == 'mouseEnterPlugin') {
        savedSelection = figma.currentPage.selection;
        setCurrentSlide(currentSlide);
    }

    if (msg.type == 'mouseLeavePlugin') {
        if (savedSelection != null)
        figma.currentPage.selection = savedSelection;
    }

    if (msg.type == 'dropdownHover') {
        if (savedSelection != null)
        figma.currentPage.selection = savedSelection;
    }


    //the mouse is hovering over an event
    //to highlight this event, we select the corresponding object in figma
    if (msg.type == 'mouseEnterEvent') {

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

    if (msg.type == 'notify') {
        figma.notify(msg.text);
    }
};



//the selection has changed
function selChange() {
    var sel = figma.currentPage.selection;
    if (sel.length > 0) {
        var node = sel[0];
        while (!isSlideNode(node) && node != null)
            node = node.parent;
        if (node != currentSlide) {
            setCurrentSlide(node);
        }
        else 
            cleanDatabase();
    }
}

figma.on("selectionchange", selChange);
figma.showUI(__uiFiles__.main, {
    width: 250,
    height: 400
});
figma.ui.onmessage = onMessage;


setCurrentSlide(mostCentral());

