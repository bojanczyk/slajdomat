//*** global variables */
//saved viewport when termporarily showing some other part
var savedViewport;
//saved selection when temporarily selecting an object through mouseover 
var savedSelection;

//the data for the current slide, mainly the event list
var database = null;
//the current slide, as a frame of figma
var currentSlide = null;


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


// highlights a node by making a frame around it. Currently not used.
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
        currentOutline.opacity = 0.2;
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


//Creates a new slide of given width and height. The place for the new slide is chosen to be close to the current slide.
function createNewSlide(width, height) {
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

    var newslide = figma.createFrame();
    newslide.x = candidate.x;
    newslide.y = candidate.y
    newslide.resize(width, height);
    return newslide;
}





//send the drop down list, which says whether or not there is something selected, and what are the possible candidates for children. 
function sendDropDownList() {
    const msg = {
        type: 'dropDownContents',
        slides: [],
        selected: (selectedOnCurrentSlide().length > 0)
    }
    const nodes = figma.root.findAll(x => isSlideNode(x) && x.id != currentSlide.id);

    for (const x of nodes) {
        var alreadyChild = false;
        for (const e of database.events) {
            if (e.type == "child" && e.id == x.id) {
                alreadyChild = true;
            }
        }
        if (!alreadyChild)
            msg.slides.push({
                name: x.name,
                id: x.id
            });
    }

    figma.ui.postMessage(msg);
}


//send the event list of the current slide
function sendEventList() {
    cleanDatabase();
    figma.ui.postMessage({
        type: 'eventList',
        events: database.events
    });
}



//Creates a child event in the current slide, together with a child link (as described in the previous function) that represents the child. 
function createChildEvent(id) {


    const slide = findSlide(id);
    database.events.push({
        type: "child",
        id: id,
        name: slide.name
    });

    /*
    const instance = frame.createInstance();
    instance.rescale(0.2);
    instance.x=currentSlide.x;
    instance.y=currentSlide.y;
    */
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
    currentSlide.appendChild(rect);
    rect.x = 100
    rect.y = 100
    console.log(rect);
    console.log(currentSlide.name);
    return rect;

}

// create new event
function createEvent(id, subtype) {


    //returns the contents of some text node in the descendants
    function firstText(node) {
        if (node.type == 'TEXT') {
            return node.name;
        }
        if (node.type == 'GROUP') {
            for (let child of node.children) {
                let text = firstText(child);
                if (text != null)
                    return text;
            }
        }
        return null;
    }

    if (subtype == 'show' || subtype == 'hide') {
        var selected = figma.currentPage.selection;

        var sorted = [];
        for (const item of selected) {
            sorted.push(item);
        }

        function sortIndex(a) {
            return a.y + a.x
        };
        //the order of events is so that it progresses in the down-right direction
        sorted = sorted.sort((a, b) => sortIndex(a) - sortIndex(b));
        for (const item of sorted) {

            if (item.type == 'GROUP' & item.name.startsWith('Group')) {
                let text = firstText(item);
                if (text != null)
                    item.name = text;
            }

            database.events.push({
                type: subtype,
                id: item.id,
                name: item.name
            })
        }

    }
    if (subtype == 'child') {
        if (id == null) {
            var newslide = createNewSlide(currentSlide.width, currentSlide.height);
            id = newslide.id;
        }
        createChildEvent(id);
    }


    saveCurrentData();
    sendEventList();
}

//remove an event from the current event list
function removeEvent(index) {
    console.log(index);
    var event = database.events[index];
    if (event.type = "child") {
        var rect = findEventObject(event, currentSlide);
        if (rect != null)
            rect.remove();
    }
    database.events.splice(index, 1);
    saveCurrentData();
    sendEventList();
}

//change order of event list so that source becomes target
function reorderEvents(source, target) {
    var tmp = database.events.splice(source, 1)[0];
    database.events.splice(target, 0, tmp);
    saveCurrentData();
    sendEventList();
}

function allNodes(selfun) {
    return figma.currentPage.findAll(selfun)
}

function repairOldFormat() {
    const nodes = allNodes(x => x.type == "RECTANGLE");
    for (const node of nodes) {
        const slide = findSlide(node.name);
        console.log(slide);
        if (slide != null)
            node.setPluginData("childLink", slide.id)
        else
            node.setPluginData("childLink", '')
    }
}

//Gives the object in the slide that corresponds to the event. For a show/hide event this is the node that is shown/hidden. For a child event, this is the link to the child.
function findEventObject(event, slide) {
    if (event.type == 'show' || event.type == 'hide')
        for (let child of slide.children)
            if (event.id == child.id)
                return child;

    if (event.type == 'child') {
        //find the object in the current slide, which represents a link to a child slide. This object is indicated by plugin data. Currently, it is a semi-transparent red rectangle.
        const nodes = slide.findAll(node => node.getPluginData("childLink") == event.id);
        if (nodes.length > 0)
            return nodes[0]
    }
    return null;
}


//send the svg file to the ui, which then sends it to the server
function saveFile() {

    //the list of slides and their svg's
    var slideList = [];
    //stack of the recursion, to find cycles in slides
    var stack = [];


    //Saves a single slide, and then calls itself for the children of that slide. The result of saving is a new item on slideList.
    async function saveRec(slide) {
        var retval;
        if (stack.includes(slide)) {
            var cycle = "The slides contain a cycle: \n";
            for (const n of stack)
                cycle += (n.name + "\n");
            figma.notify(cycle + slide.name);
            return null;
        } else {
            stack.push(slide);
            currentSlide = slide;
            loadCurrentData();

            //We temporarily change the names of the children to their id's, so that the svg will have them as id's. (This is because Figma's svg export uses the object's name as the id for the svg. )
            //the function returns a list of pairs (node, old name) that can be used to revert these changes
            var changes = [];
            for (let event of database.events) {
                const node = findEventObject(event, slide);
                if (node != null) {
                    //we store the changes in reverse order,  so that the original names are at the end of the change list 
                    changes.unshift({ //unshift instead of push makes the order reversed
                        node: node,
                        savedname: node.name
                    });
                    node.name = event.id;
                }
            }

            var svg = await slide.exportAsync({
                format: 'SVG',
                svgOutlineText: true,
                svgIdAttribute: true
            });

            // console.log(changes);
            //we now undo the name changes. This needs to be done in reverse order to recover the original names
            for (let change of changes) {
                change.node.name = change.savedname;
            }

            retval = {
                type: 'child',
                name: database.name,
                id: database.id,
                children: []
            }

            saveCurrentData();
            slideList.push({
                database: database,
                svg: svg
            });
            for (const event of database.events) {
                if (!event.disabled) {
                    if (event.type == "child") {
                        retval.children.push(await saveRec(findSlide(event.id)));
                    } else
                        retval.children.push(event);
                }

            }

            stack.pop();
            return retval;
        }
    }

    var savedSlide = currentSlide;
    saveRec(currentSlide).then(x => {
        figma.ui.postMessage({
            type: 'savePresentation',
            presentation: figma.root.name,
            slideList: slideList,
            tree: x
        });
        currentSlide = savedSlide;
    });
}


// save the plugin data, for the current slide, to the file
function saveCurrentData() {
    database.name = currentSlide.name;
    database.id = currentSlide.id;
    currentSlide.setPluginData("database", JSON.stringify(database));
}


// the opposite of the previous function
function loadCurrentData() {
    database = getDatabase(currentSlide);
    if (database == null) {
        //there is no database
        database = {
            name: currentSlide.name,
            id: currentSlide.id,
            events: []
        }

    }
    cleanDatabase();
}

//get the database for a slide
function getDatabase(slide) {
    var s = slide.getPluginData("database");
    if (s == '')
        return null
    else
        return JSON.parse(s);
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
        if (centrality(x) > maxCentrality) {
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
    return (node.type == "COMPONENT" || node.type == 'FRAME') && (node.parent.type === "PAGE")
}

//find a slide in the document with the given id
function findSlide(id) {
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
    database.name = currentSlide.name;
    for (var event of database.events) {
        event.disabled = true;
        const node = findEventObject(event, currentSlide);
        if (node != null) {
            if (event.type == "child") {
                var f = findSlide(event.id);
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




//select the items that are selected on the current slide
function selectedOnCurrentSlide() {
    var retval = [];
    var sel = figma.currentPage.selection;
    for (const s of sel) {
        if (s.parent == currentSlide)
            retval.push(s);
    }
    return retval;
}


//return any slide that points to slide as a child
function parentSlide(slide) {
    for (const other of allNodes(isSlideNode)) {
        const db = getDatabase(other);
        if (db != null)
            for (const event of db.events)
                if (event.type == 'child' && event.id == slide.id)
                    return other;
    }
    return null;
}

//set the current slide of the plugin
function setCurrentSlide(slide) {
    currentSlide = slide;
    if (slide != null) {
        loadCurrentData();
        var msg = {
            type: 'init',
            docName: figma.root.name,
            slide: currentSlide.name,
            slideid: currentSlide.id,
            slideCount: figma.root.findAll(isSlideNode).length,
        }
        /*
        //this code runs too long and creates trouble
        const parent = parentSlide(slide);
        if (parent == null)
            msg.parent = null
        else
            msg.parent = parent.name;
        */
        msg.parent = null;

        figma.ui.postMessage(msg);
        sendEventList();
    } else {
        figma.ui.postMessage({
            type: 'init'
        })
    }
}

//go to a slide and show it on the screen
function gotoSlide(slide) {
    figma.viewport.scrollAndZoomIntoView([slide]);
    setCurrentSlide(slide);
}


//returns the slide with the currently selected object
function slideWithSelection() {
    var sel = figma.currentPage.selection;
    if (sel.length > 0) {
        var node = sel[0];
        while (!isSlideNode(node) && node != null)
            node = node.parent;
        return node;
    } else
        return null;
}

//the selection has changed
function selChange() {
    if (savedSelection == null) {
        const slide = slideWithSelection(); {
            // console.log(slide);
            // console.log("current:", currentSlide)
            if (slide != currentSlide && (slide != null || currentSlide.removed))
                setCurrentSlide(slide);
            else
                sendEventList();
        }
    }
}



//handle messages that come from the ui
function onMessage(msg) {

    //create a new event for the current slide
    //this covers show/hide/child events
    if (msg.type == 'createEvent') {
        createEvent(msg.id, msg.subtype);
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
        setCurrentSlide(createNewSlide(msg.width, msg.height));
        figma.viewport.scrollAndZoomIntoView([currentSlide]);
    }

    //export the files to svg's
    if (msg.type == 'saveFile')
        saveFile();

    //I'm not sure if this is necessary, but just in case I refresh the event list when the mouse enters the plugin.
    if (msg.type == 'mouseEnterPlugin') {
        if (currentSlide != null)
            sendEventList();
    }

    //highlight an event when the mouse hovers over it. For show/hide event we change the selection to the concerned object, for child events we do this for the link.
    if (msg.type == 'hoverEvent') {
        if (msg.index == -1) {
            if (savedSelection != null) {
                console.log(savedSelection);
                figma.currentPage.selection = savedSelection;
            }
            savedSelection = null;
        } else {
            if (savedSelection == null)
                savedSelection = figma.currentPage.selection;

            const event = database.events[msg.index];
            const link = findEventObject(event, currentSlide);
            if (link != null)
                figma.currentPage.selection = [link];
        }

    }

    if (msg.type == 'requestDropDown') {
        sendDropDownList();
    }

    //unselect the action from the previous event
    if (msg.type == 'mouseLeave') {
        figma.currentPage.selection = savedSelection;
    }

    //if an event is clicked, then the selection stays permanent
    if (msg.type == 'clickEvent') {
        const event = database.events[msg.index];
        if (event.type == 'child') {
            gotoSlide(findSlide(event.id));
        } else
            savedSelection = figma.currentPage.selection;
    }

    //the parent button is clicked
    if (msg.type == 'gotoParent') {
        gotoSlide(parentSlide(currentSlide));
    }

    if (msg.type == 'notify') {
        figma.notify(msg.text);
    }


};


figma.on("selectionchange", selChange);
figma.showUI(__uiFiles__.main, {
    width: 250,
    height: 400
});
figma.ui.onmessage = onMessage;


setCurrentSlide(slideWithSelection());
// repairOldFormat();
