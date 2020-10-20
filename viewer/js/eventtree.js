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
function loadSVG(node) {

    if (node.type == 'child' && node.svg == null) {
        loadSounds(node);
        var ob = document.createElement("object");
        ob.setAttribute("data", fileName(node.id, 'image.svg'));
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
                if (node.div != null)
                    node.div.classList.remove("slide-list-item-loading");
                for (let child of node.children)
                    if (child.type == 'show' || child.type == 'hide')
                        child.div.classList.remove("slide-list-item-loading");

                svgLoaded(node);
                if (node.parent == null) {
                    pushSlide(node, 1);
                    updatePageNumber();
                }
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
}



//creates the tree of slides and events, without adding the svg's yet
function createEventTree() {

    //create an html item for the left panel  
    function addDIV(event) {


        if (event.parent == null) {
            event.subdiv = document.getElementById('slide-stack');
            event.div = null;
        } else {
            parentDiv = event.parent.subdiv;
            event.div = document.createElement("div");
            event.div.classList.add("slide-list-item");
            event.div.classList.add("slide-list-item-loading");

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


            if (event.type == 'child') {
                event.subdiv = document.createElement("div");
                event.subdiv.classList.add("slide-stack");
                event.subdiv.classList.add("slide-stack-hidden");
                parentDiv.appendChild(event.subdiv);
            }
        }

    }

    async function createTreeRec(event) {
        addDIV(event);
        event.audio = null;
        if (event.type == 'child') {
            numberOfPages++;
            //this will be only called for show events
            event.children = [];
            const database = await fetchJSON(fileName(event.id, 'events.json'));
            event.name = database.name;
            for (const child of database.events) {
                child.parent = event;
                event.children.push(child);
                await createTreeRec(child);
            }
            event.children.push({
                type: 'finish',
                parent: event
            })
        }
    }
    eventTree = {
        type: 'child',
        id: manifest.root,
        parent: null
    };
    return createTreeRec(eventTree);
}






//this tree navigation is not efficient, but I want to avoid adding extra links
function treeSibling(node, dir) {
    try {
        for (let i = 0; i < node.parent.children.length; i++)
            if (node.parent.children[i] == node)
                return node.parent.children[i + dir]
    } catch (exception) {
        return null;
    }
}

//returns the index of an event inside its parent
function eventIndex(node) {
    try {
        for (let i = 0; i < node.parent.children.length; i++)
            if (node.parent.children[i] == node)
                return i;
    } catch (exception) {
        return null;
    }
}

//enters a node from its parent
//this is called at the beginning for the root node, and also when doing next/previous events
function pushSlide(node, dir) {
    if (node.svg == null) {
        //not loaded yet
        userAlert("Slide not loaded yet:" + node.name);
    } else {
        if (node.parent != null)
            zoomSlide(node, 1);
        else
            zoomSlide(node, 0.1);


        for (let child of node.children) {
            loadSVG(child);
        }
        if (dir == 1)
            curEvent = node.children[0];
        else
            curEvent = node.children.top();
    }

}



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
        if (curEvent.type == 'child') {
            curEvent.div.classList.add('slide-list-item-seen');
            curEvent.subdiv.classList.remove('slide-stack-hidden');
            pushSlide(curEvent, dir);
            pageCounter(1);
        } else
        if (curEvent.type == 'show' || curEvent.type == 'hide') {
            // hide or show
            curEvent.div.classList.add('slide-list-item-seen');
            showHide(curEvent);
            curEvent = treeSibling(curEvent, 1);
        } else
        if (curEvent.type == 'finish') {
            if (curEvent.parent == eventTree) {
                soundStop();
                // userAlert("Cannot move after last event");
            } else {
                // pop the stack
                curEvent.parent.subdiv.classList.add('slide-stack-hidden');
                zoomSlide(curEvent.parent.parent, 1.5);
                curEvent = treeSibling(curEvent.parent, 1);
            }

        }
        if (soundState == "play") {
            if (currentSound() == null) {
                soundStop();
            } else {
                soundPlayCurrentEvent();
            }
        }

        if (soundState == "record")
            soundRecordCurrentEvent();
    } else {
        //direction is backward
        const prevEvent = treeSibling(curEvent, -1);

        if (prevEvent == null) //first event of its group
        {
            //we need to pop the current slide
            if (curEvent.parent == eventTree) {
                // userAlert("Cannot move before first event");
            } else {
                zoomSlide(curEvent.parent.parent, 1.5);
                curEvent = curEvent.parent;
                curEvent.subdiv.classList.add('slide-stack-hidden');
                curEvent.div.classList.remove('slide-list-item-seen');
                pageCounter(-1);
            }

        } else
        if (prevEvent.type == 'show' || prevEvent.type == 'hide') {
            // hide or show
            prevEvent.div.classList.remove('slide-list-item-seen');
            showHide(prevEvent);
            curEvent = treeSibling(curEvent, -1);
        } else
        if (prevEvent.type == 'child') {
            prevEvent.subdiv.classList.remove('slide-stack-hidden');
            pushSlide(prevEvent, dir);
        }

    }

    updatePageNumber();
}