
var slideStack = [];
var slideTree = null;
var slideDict = {};
var rootSlide;

var numberOfPages = 0;
var currentPage = 0;

//prefix of plugin data
const saveprefix = "habzdryg data (do not delete): ";




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
    var countdiv = document.getElementById("page-count-text");
    countdiv.innerHTML = currentPage + " / " + numberOfPages;
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
        if ('disabled' in event) {
            retval.classList.add("disabled-event");
        }

        if (event.type == "show")
            icon = "visibility";
        if (event.type == "hide")
            icon = "visibility_off";
        if (event.type == "child")
            icon = "zoom_out_map";
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
        if (event.type == "child" && !("disabled" in event) && (event.node == null)) {
            event.loading = true;
            newchild.classList.add("slide-list-item-loading");
            loadSVG(node, "slides/"+event.id, newchild);
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


//dir is +1 for next event and -1 for previous event
function nextEvent(dir) {
    var top = slideStack.top();
    //if the current slide is exhausted
    if ((dir == 1 && top.index == top.node.events.length) || (dir == -1 && top.index == 0)) {
        if (slideStack.length != 1)
            popSlide(dir);

    } else {
        if (dir == 1)
            if ('loading' in top.node.events[top.index]) {
                console.log("still loading");
                return;
            }
        if (dir == 1) {
            event = top.node.events[top.index];
            top.dom.children[top.index].classList.add("slide-list-item-seen");
        } else {
            event = top.node.events[top.index - 1];
            if (event.type != "child" || event.disabled)
                top.dom.children[top.index - 1].classList.remove("slide-list-item-seen");
        }
        if ('disabled' in event) {
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

                gsap.to(top.node.svg.children[event.index], {
                    duration: 0.3,
                    opacity: opacity
                });
                slideStack.top().index += dir;
            }
        }
    }
    nextPreviousArrows();
}

function keyListener(event) {
    if (event.keyCode == '39') {
        //arrow right
        nextEvent(1);
    }
    if (event.keyCode == '37') {
        //arrow left
        nextEvent(-1);
    }
}

document.addEventListener("keydown", keyListener);


//add a new node to the slide tree
//the svg
function attachToTree(parent, svg) {

    //loads the plugin data
    var retval;
    for (const child of svg.children) {
        //if the child stores the plugin data
        if (child.id.startsWith(saveprefix)) {
            var s = child.id.slice(saveprefix.length);
            retval = JSON.parse(s);
        }
    }
    retval.svg = svg;
    retval.parent = parent;
    retval.localRect = getBoundRect(svg);

    //hide objects that are one of:
    //the plugin data
    //a placeholder rectangle
    for (const child of svg.children) {
        if (child.id.startsWith(saveprefix))
            child.style.opacity = 0;
        for (const event of retval.events) {
            if (event.type == 'child' && event.id == child.id)
                child.style.opacity = 0;
        }
    }

    //hide objects where the first event is show
    for (var i = retval.events.length-1; i >= 0; i--)
    {   
        var event = retval.events[i];
        if (event.type == "show") 
            svg.children[event.index].style.opacity = 0;
            if (event.type == "hide") 
            svg.children[event.index].style.opacity = 1;
    }

    //compute the transformation with respect to the local coordinates of the parent
    if (parent == null) {
        retval.transform = idTransform();
        numberOfPages = retval.pagecount;
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
    }

}


function loadSVG(parent, name, dom) {
    var ob = document.createElement("object");
    ob.setAttribute("data", name + ".svg");
    ob.setAttribute("type", "image/svg+xml");
    ob.classList.add("hidden-svg");
    document.body.appendChild(ob);
    ob.onload = function () {
        var doc = ob.contentDocument.firstElementChild;
        if (doc.nodeName == 'svg') {
            var svg = ob.contentDocument.firstElementChild.firstElementChild;
            if (dom != null)
                dom.classList.remove("slide-list-item-loading");
            attachToTree(parent, svg);
        } else {
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

loadSVG(null, "root", null);