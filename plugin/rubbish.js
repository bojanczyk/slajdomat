
//currently not used
function Utf8ArrayToStr(array) {
    var out, i, len, c;
    var char2, char3;

    out = "";
    len = array.length;
    i = 0;
    while (i < len) {
        c = array[i++];
        switch (c >> 4) {
            case 0:
            case 1:
            case 2:
            case 3:
            case 4:
            case 5:
            case 6:
            case 7:
                // 0xxxxxxx
                out += String.fromCharCode(c);
                break;
            case 12:
            case 13:
                // 110x xxxx   10xx xxxx
                char2 = array[i++];
                out += String.fromCharCode(((c & 0x1F) << 6) | (char2 & 0x3F));
                break;
            case 14:
                // 1110 xxxx  10xx xxxx  10xx xxxx
                char2 = array[i++];
                char3 = array[i++];
                out += String.fromCharCode(((c & 0x0F) << 12) |
                    ((char2 & 0x3F) << 6) |
                    ((char3 & 0x3F) << 0));
                break;
        }
    }

    return out;
}



//the following code is not used:
//make the current slide as big as possible,
//so that it is contained in slide-panel,
//and has its proportions unchanged
function resizeSlideContainer(duration) {
    var parent = document.getElementById("slide-panel");
    var width = slideStack.top().node.localRect.width;
    var height = slideStack.top().node.localRect.height;
    var rect;
    var parent = document.getElementById("slide-panel");
    if (parent.offsetWidth / parent.offsetHeight > width / height)
        rect = {
            duration: duration,
            width: parent.offsetHeight * width / height,
            x: 0.5 * (parent.offsetWidth - parent.offsetHeight * width / height),
            height: parent.offsetHeight,
            y: 0
        }
    else
        rect = {
            duration: duration,
            height: parent.offsetWidth * height / width,
            y: 0.5 * (parent.offsetHeight - parent.offsetWidth * height / width),
            width: parent.offsetWidth,
            x: 0
        }
    gsap.to(document.getElementById("slide-container"), rect);
}


/*

function traverseSVG() {
    function rec(node, parent, spaces) {
        if (node.id.startsWith(saveprefix)) {
            var s = node.id.slice(saveprefix.length);
            var database = JSON.parse(s);
            database.dom = parent.cloneNode(true);
            for (child of database.dom.children)
                child.style.opacity = 0;
            slideDict[database.id] = database;
            if (rootSlide == null || database.root)
                rootSlide = database.id;
        }
        for (const child of node.children) {
            rec(child, node, ' ' + spaces)
        }
    }


    // svgDoc.classList.add("svg-class");
    // svgDoc.id = "svg";
    rec(document.getElementById("svgobject").contentDocument.firstElementChild, null, '');
}

*/

/*
document.getElementById("svgobject").addEventListener("load", function () {
    traverseSVG();
    slideTree = createSlideTree(rootSlide, null);
    pushSlide(slideTree);
    nextPreviousArrows();
}, false);
*/



//read an svg file, and create slides for all groups which have 
//a child that has plugin data
function traverseSVG() {
    function rec(node, parent, spaces) {
        if (node.id.startsWith(saveprefix)) {
            var s = node.id.slice(saveprefix.length);
            var database = JSON.parse(s);
            database.dom = parent.cloneNode(true);
            for (child of database.dom.children)
                child.style.opacity = 0;
            slideDict[database.id] = database;
            if (rootSlide == null || database.root)
                rootSlide = database.id;
        }
        for (const child of node.children) {
            rec(child, node, ' ' + spaces)
        }
    }


    // svgDoc.classList.add("svg-class");
    // svgDoc.id = "svg";
    rec(document.getElementById("svgobject").contentDocument.firstElementChild, null, '');
}
// function place

function createSlideTree(id, parent) {


    var current = slideDict[id];
    console.log(current);
    var retval = {
        events: current.events,
        parent: parent,
        id: id,
        svg: current.dom,
        localRect: getBoundRect(current.dom)
    };


    if (parent == null)
        retval.transform = idTransform();
    else {
        var rect;
        for (const s of parent.svg.children)
            if (s.id == current.id) {
                rect = {
                    x: s.x.baseVal.value,
                    y: s.y.baseVal.value,
                    width: s.width.baseVal.value,
                    height: s.height.baseVal.value
                };
            }
        retval.placeholder = rect;
        var target = applyTransform(parent.transform, rect);
        retval.transform = getTransform(retval.localRect, target);

    }

    retval.svg.setAttribute("transform", transformToString(retval.transform));
    svgContainer = document.getElementById("svg");
    svgContainer.appendChild(retval.svg);

    for (var event of retval.events) {
        if (event.type == "child" && !("disabled" in event)) {
            event.node = createSlideTree(event.id, retval);
        }
    }

    console.log("pop")
    return retval;

}



