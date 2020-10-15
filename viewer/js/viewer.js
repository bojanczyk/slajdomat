var slideStack = [];
var slideTree = null;


var numberOfPages = 0;
var currentPage = 0;

var presentationDir; //the directory where the slides are
var presentationName; //the name of the slides



function getServer() {
    return 'http://localhost:8001';
}


//toggles the side panel on the left with the list of slides
function togglePanel(visible) {
    if (visible)
        gsap.to("#control-panel", {
            width: "20%",
            duration: 0.3
        });
    else
        gsap.to("#control-panel", {
            width: "0%",
            duration: 0.3
        });
}


//displays an alert for the user at the bottom of the screen
function userAlert(text) {
    var panel = document.getElementById("text-alert-box");
    document.getElementById("text-alert").innerHTML = text;
    let tl = gsap.timeline();
    tl.to(panel, {
        opacity: "100%",
        duration: 0.1
    }).to(panel, {
        duration: 1
    }).to(panel, {
        opacity: "0",
        duration: 1
    });
}


// the "previous" arrow should be invisible at the first event of the first slide
// analogously for the "next" arrow
function nextPreviousArrows() {
    if (slideStack.top().index == 0 && slideStack.length == 1)
        document.getElementById("prev-event").style.visibility = "hidden";
    else
        document.getElementById("prev-event").style.visibility = "visible";

    if (slideStack.top().index == slideStack.top().node.events.length && slideStack.length == 1)
        document.getElementById("next-event").style.visibility = "hidden";
    else
        document.getElementById("next-event").style.visibility = "visible";

}


//update the page number in the corner
function updatePageNumber() {
    document.getElementById("page-count-enumerator").innerHTML = currentPage;
    document.getElementById("page-count-denominator").innerHTML = " / " + numberOfPages;
}

//offset the page counter
function pageCounter(dir) {
    currentPage += dir;
    updatePageNumber();
}

//apply transform t to rectangle rect (first scale, then shift)
function applyTransform(t, rect) {
    retval = {};
    retval.x = rect.x * t.scalex + t.deltax;
    retval.y = rect.y * t.scaley + t.deltay;
    retval.width = rect.width * t.scalex;
    retval.height = rect.height * t.scaley;
    return retval;
}

// the input is two rectangles, with equal proportions
// the output is a transform that maps source to target    
function getTransform(source, target) {
    var retval = {};
    retval.scalex = target.width / source.width;
    retval.scaley = target.height / source.height;
    retval.deltax = target.x - source.x * retval.scalex;
    retval.deltay = target.y - source.y * retval.scaley;
    return retval;
}

//creates a string for a transformation, to be used by gsap
function transformToString(t) {
    return "translate(" + t.deltax + " " + t.deltay + ") scale(" + t.scalex + " " + t.scaley + ")";
}

// get the viewport for a node in the slide tree
function getViewPort(node) {
    return applyTransform(node.transform, node.localRect);
}

//the identity transformation
function idTransform() {
    return {
        scalex: 1,
        scaley: 1,
        deltax: 0,
        deltay: 0
    };
}

//get the bounding rect for a slide
//deletes the background rectangle as a side effect
function getBoundRect(svg) {
    var firstrect = svg.firstElementChild;
    var bounds = {};
    bounds.width = firstrect.width.baseVal.value;
    bounds.height = firstrect.height.baseVal.value;
    if (firstrect.transform.baseVal.length > 0) {
        bounds.x = firstrect.transform.baseVal[0].matrix.e;
        bounds.y = firstrect.transform.baseVal[0].matrix.f;
    } else {
        bounds.x = 0;
        bounds.y = 0;
    }
    firstrect.remove();
    return bounds;
}

//do an animated zoom to the slide on the top of the stack
function zoomSlide(node, duration = 1.5) {

    function textRect(rect) {
        return " " + rect.x + " " + rect.y + " " + rect.width + " " + rect.height;
    }
    var svgDom = document.getElementById("svg");
    var viewBox = applyTransform(node.transform, node.localRect);
    var tla = new TimelineMax({});
    tla.to(svgDom, duration, {
        attr: {
            viewBox: textRect(viewBox)
        }
    });
}

//we use a top method for accessing a stack
if (!Array.prototype.top) {
    Array.prototype.top = function () {
        return this[this.length - 1];
    };
};


//pop the slide from the stack, and delete the corresponding information in the side panel
function popSlide(dir) {
    var popped = slideStack.pop();
    var top = slideStack.top();
    popped.dom.remove();
    if (dir == 1)
        top.index += 1
    else {
        pageCounter(-1);
        top.dom.children[top.index].classList.remove("slide-list-item-seen");
    }
    zoomSlide(top.node);
}


//push a slide to the stack, adn add corresponding information on the side panel
function pushSlide(node, dir = 1) {

    //create an html item for the left panel  
    function createSlideLeaf(event) {
        var retval = document.createElement("div");
        retval.classList.add("slide-list-item");

        var icon;
        if (event.disabled) {
            retval.classList.add("disabled-event");
        }

        if (event.type == "show")
            icon = "visibility";
        if (event.type == "hide")
            icon = "visibility_off";
        if (event.type == "child")
            icon = "zoom_out_map";


        //this operation seems to solve problems with utf
        // var niceName = decodeURIComponent(escape(event.name));

        retval.innerHTML = "<i class=\"material-icons\">" + icon + "</i> " + event.name;
        return retval;
    }

    var dom;
    var speed;

    if (dir == 1)
        pageCounter(1);
    if (slideStack.length == 0) {
        dom = document.getElementById("slide-stack");
        speed = 0.01;
    } else {
        if (dir == -1)
            slideStack.top().index -= 1;

        var parentdom = slideStack.top().dom;
        dom = document.createElement("div");
        dom.classList.add("slide-stack");
        parentdom.children[slideStack.top().index].after(dom);
        speed = 1.5;
    }

    for (const event of node.events) {
        var newchild = createSlideLeaf(event);
        if (dir == -1)
            newchild.classList.add("slide-list-item-seen");
        dom.appendChild(newchild);
        if (event.type == "child" && !(event.disabled) && (event.node == null)) {
            event.loading = true;
            newchild.classList.add("slide-list-item-loading");
            loadSVG(node, event.id, newchild);
        }
    }

    var index;
    if (dir == 1)
        index = 0;
    else
        index = node.events.length;

    slideStack.push({
        node: node,
        index: index,
        dom: dom
    });
    zoomSlide(node, speed);
}

function nextButton() {
    if (soundState != "record")
        soundStop();
    nextEvent(1);
}

function prevButton() {
    soundStop();
    nextEvent(-1);
}

//dir is +1 for next event and -1 for previous event
function nextEvent(dir) {
    var top = slideStack.top();

    //if the current slide is exhausted
    if ((dir == 1 && top.index == top.node.events.length) || (dir == -1 && top.index == 0)) {
        if (slideStack.length != 1)
            popSlide(dir);
        else
        if (dir == 1 && slideStack.length == 1) { //if the slides are finished, then stop playback
            soundStop();
        }

    } else {
        if (dir == 1)
            if ('loading' in top.node.events[top.index]) {
                userAlert("still loading");
                return;
            }
        var event;
        if (dir == 1) {
            event = top.node.events[top.index];
            top.dom.children[top.index].classList.add("slide-list-item-seen");
        } else {
            event = top.node.events[top.index - 1];
            if (event.type != "child" || event.disabled)
                top.dom.children[top.index - 1].classList.remove("slide-list-item-seen");
        }
        if (event.disabled) {
            slideStack.top().index += dir;
        } else {
            if (event.type == "child")
                pushSlide(event.node, dir);
            else {
                var opacity;
                if ((event.type == "show" && dir == 1) || (event.type == "hide" && dir == -1))
                    opacity = 1;
                else
                    opacity = 0;

                gsap.to(event.svg, {
                    duration: 0.3,
                    opacity: opacity
                });
                slideStack.top().index += dir;
            }
        }
    }
    nextPreviousArrows();
    if (soundState == "record")
        soundRecordCurrentEvent();


    if (soundState == "play") {
        if (currentSound() == null) {
            console.log("stop")
            soundStop();
        } else {
            soundPlayCurrentEvent();
        }
    }

    updateSoundIcon();
}

function keyListener(event) {
    if (event.keyCode == '39') {
        //arrow right
        nextButton();

    }
    if (event.keyCode == '37') {
        //arrow left
        prevButton();
    }

    if (event.keyCode == '32') {
        //space bar
        playButton();
    }

    if (event.keyCode == '82') {
        // 'r'
        if (soundState == "record")
            soundStop();
        else
            soundRecord();
    }
}

document.addEventListener("keydown", keyListener);


//add a new node to the slide tree
//the svg
function attachToTree(parent, svg, database) {

    //Checks if an svg element matches an event.
    //For the moment the matching function is that the 
    //svg id has the event event name as a prefix
    function matches(svg, event) {
        //the name in the id uses a wrong encoding, which is repaired here
        var niceName = decodeURIComponent(escape(svg.id));
        return (niceName.startsWith(event.name))
    }

    var retval = database;


    retval.svg = svg;
    retval.parent = parent;
    retval.localRect = getBoundRect(svg);

    //hide objects that are one of:
    //the plugin data
    //a placeholder rectangle
    //the first event is show
    for (const child of svg.children) {
        for (const event of retval.events) {
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

    //events by name
    //attach each show or hide event to its corresponding svg element
    for (const event of retval.events) {
        if (event.type == 'show' || event.type == 'hide') {
            for (const child of svg.children)
                if (matches(child, event)) {
                    event.svg = child;
                }
            if (event.svg == null)
                event.disabled = true;
        }
    }

    //compute the transformation with respect to the local coordinates of the parent
    if (parent == null) {
        retval.transform = idTransform();
    } else {
        for (const s of parent.svg.children)
            if (s.id == retval.id) {
                retval.placeholder = {
                    x: s.x.baseVal.value,
                    y: s.y.baseVal.value,
                    width: s.width.baseVal.value,
                    height: s.height.baseVal.value
                };
            }
        var target = applyTransform(parent.transform, retval.placeholder);
        retval.transform = getTransform(retval.localRect, target);
    }
    retval.svg.setAttribute("transform", transformToString(retval.transform));
    svgContainer = document.getElementById("svg");
    svgContainer.appendChild(retval.svg);

    //attach this node to the parent event list
    if (parent != null) {
        for (var e of parent.events) {
            if (e.id == retval.id && e.type == "child") {
                e.node = retval;
                delete e['loading'];
            }
        }
    }

    if (parent == null) {
        pushSlide(retval, 1);
        nextPreviousArrows();
    }

}


function slideDirectory(name) {
    return manifest.slideDict[name]
}

var debugDoc = [];

function loadSVG(parent, name, dom) {

    var ob = document.createElement("object");
    ob.setAttribute("data", fileName(name, 'image.svg'));
    ob.setAttribute("type", "image/svg+xml");
    ob.classList.add("hidden-svg");
    document.body.appendChild(ob);
    ob.onload = function () {
        var doc = ob.contentDocument.firstElementChild;
        if (doc.nodeName == 'svg') {
            var svg = null;
            //in principle, the right element should be the first child, but Marek Sokołowski mentioned that expressVPN changes inserts some wrong children, hence the following code
            for (const child of ob.contentDocument.firstElementChild.children)
                if (child.nodeName == 'g')
                    svg = child;
            if (dom != null)
                dom.classList.remove("slide-list-item-loading");
            fetchJSON(fileName(name, 'events.json')).then(
                database => {
                    attachToTree(parent, svg, database);
                    loadSounds(database);
                    //after loading the first svg, we make the sound icon
                    //visible or not depending on whether we have sounds
                }
            )

        } else {
            // this means that the svg failed to load correctly
            dom.classList.add("disabled-event");
            dom.classList.remove("slide-list-item-loading");
            if (parent != null) {
                for (const event of parent.events) {
                    if (event.id == name && event.type == "child") {
                        event.disabled = true;
                        delete event['loading'];
                    }
                }

            }
        }

    };
}


function currentEvent() {
    if (slideStack.top().node.events.length == 0)
        return null
    else
        return slideStack.top().node.events[slideStack.top().index];
}

//check the user agent for chrome
//at the moment, this is not used
function userAgent() {
    if (navigator.userAgent.indexOf("Chrome") !== -1) {
        return "Chrome";
    }
    if (navigator.userAgent.indexOf("Firefox") !== -1) {
        return "Firefox";
    }
    if (navigator.userAgent.indexOf("Safari") !== -1) {
        return "Safari";
    }
    return null;
}

var manifest;


//gives the name for a file in a slide, in the current presentation
//the slide parameter could be null, for top-level information in the presentation.
function fileName(slide, file) {

    if (slide == null) {
        return presentationDir + '/' + file;
    } else
        return presentationDir + '/' + manifest.slideDict[slide] + '/' + file;
}

//send an object to the server
function sendToServer(msg) {
    msg.presentation = presentationName;
    var json = JSON.stringify(msg);
    return fetch('http://localhost:3000', {
        method: 'POST',
        body: json
    }).
    then(response => {
        if (!response.ok) {
            throw "not connected";
        }
    })
}

//get a json file and parse it
function fetchJSON(filename) {
    return fetch(filename).
    then(function (res) {
        if (!(res.ok))
            throw "not connected";
        else
            return res.json();
    }).
    catch((error) => {
        userAlert("Could not load slide file " + filename);
        return null;
    });
}








//startup code
//it leads the manifest, which contains the root slide
//and the number of slides, and then it loads the first slide
window.onload = function () {
    fetchJSON('presentations.json')
        .then(j => {
            let url = new URL(window.location.href);
            presentationName = url.searchParams.get('slides');
            document.title = presentationName;
            presentationDir = j[presentationName];
            return fetchJSON(fileName(null, 'manifest.json'))
        }).then(j => {
            if (j == null) {
                throw "The manifest is missing"
            } else {
                console.log(j);
                console.log(fileName(null, 'manifest.json'))
                manifest = j;
                numberOfPages = Object.keys(manifest.slideDict).length;
                getSoundDatabase();
                loadSVG(null, manifest.root, null);
            }
        }) //.catch((e) => userAlert(e))
}
