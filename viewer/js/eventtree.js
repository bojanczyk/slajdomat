//add a new node to the slide tree
//the svg
function svgLoaded(node) {

    //Checks if an svg element matches an event.
    //For the moment the matching function is that the 
    //svg id has the event event name as a prefix
    function matches(svg, event) {
        //the name in the id uses a wrong encoding, which is repaired here
        var niceName = decodeURIComponent(escape(svg.id));
        return (niceName == event.id)
    }


    node.localRect = getBoundRect(node.svg);

    //hide objects that are either a placeholder rectangle, or the first event is show
    for (const child of node.svg.children) {
        for (const event of node.children) {
            var first = true;
            if (event.type == 'show' && matches(child, event) && first) {
                child.style.opacity = 0;
                first = false;
            }
            if (event.type == 'hide' && matches(child, event) && first)
                first = false;

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

    //compute the transformation with respect to the local coordinates of the parent
    if (node.parent == null) {
        node.transform = idTransform();
    } else {
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
    svgContainer = document.getElementById("svg");
    svgContainer.appendChild(node.svg);
}


//returns true if the event has already been performed
function alreadySeen(event) {
    //this is stub code
    return false;
}
//loads the SVG for the given node in the slide tree
function newLoadSVG(node) {

    var ob = document.createElement("object");
    ob.setAttribute("data", fileName(node.id, 'image.svg'));
    ob.setAttribute("type", "image/svg+xml");
    ob.classList.add("hidden-svg");
    document.body.appendChild(ob);
    ob.onload = function () {
        try {
            var doc = ob.contentDocument.firstElementChild;
            
            //in principle, the right element should be the first child, but Marek Sokołowski mentioned that expressVPN changes inserts some wrong children, hence the following code
            for (const child of ob.contentDocument.firstElementChild.children)
            {
                if (child.nodeName == 'g')
                    node.svg = child;
            }

            if (node.div != null)
                node.div.classList.remove("slide-list-item-loading");
            svgLoaded(node);
            console.log(node.svg);
            // loadSounds(node);

        } catch (exception) {
            console.log(exception);
            // this means that the svg failed to load correctly
            if (node.div != null) {
                node.div.classList.add("disabled-event");
                node.div.classList.remove("slide-list-item-loading");
            }
            node.svg = null;
            userAlert("Failed to load svg for " + node.name);
        }
    }
}



//creates the tree of slides and events, without adding the svg's yet
function createEventTree() {

    //create an html item for the left panel  
    function addDIV(event) {
        var parentDiv = null;
        if (event.parent == null) {
            parentDiv = document.getElementById('control-panel')
        } else {
            parentDiv = event.parent.subdiv;
            event.div = document.createElement("div");
            event.div.classList.add("slide-list-item");

            var icon;
            if (event.disabled) {
                event.div.classList.add("disabled-event");
            }

            if (event.type == "show")
                icon = "visibility";
            if (event.type == "hide")
                icon = "visibility_off";
            if (event.type == "child")
                icon = "zoom_out_map";

            event.div.innerHTML = "<i class=\"material-icons\">" + icon + "</i> " + event.name;
            parentDiv.appendChild(event.div);
        }

        if (event.type == 'child') {
            event.subdiv = document.createElement("div");
            event.subdiv.classList.add("slide-stack");
            parentDiv.appendChild(event.subdiv);
        }

    }

    async function createTreeRec(event) {
        addDIV(event);
        if (event.type == 'child') {
            {
                //this will be only called for show events
                event.children = [];
                const database = await fetchJSON(fileName(event.id, 'events.json'));
                event.name = database.name;
                for (const child of database.events) {
                    child.parent = event;
                    event.children.push(child);
                    createTreeRec(child);
                }
                event.children.push({
                    type: 'zoomout',
                    parent : event
                })
            }
        }
    }
    eventTree = {
        type: 'child',
        id: manifest.root,
        parent: null
    };
    createTreeRec(eventTree).then(x => x);
}
