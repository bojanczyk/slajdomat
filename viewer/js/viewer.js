var slideStack = [];
var eventTree = null;
var curEvent = null;


var numberOfPages = 0;

var presentationDir; //the directory where the slides are
var presentationName; //the name of the slides



function getServer() {
    return 'http://localhost:8001';
}


//toggles the side panel on the left with the list of slides
function togglePanel(visible) {
    if (visible) {
        document.getElementById('left-sensor').style.display = 'none';
        gsap.to("#control-panel", {
            width: "20%",
            duration: 0.3
        });
    } else {
        document.getElementById('left-sensor').style.display = '';
        gsap.to("#control-panel", {
            width: "0%",
            duration: 0.3
        });
    }
}

//displays a panel for a short time
function shortDisplay(panel) {
    let tl = gsap.timeline();
    panel.style.display='inherit';
    tl.to(panel, {
        opacity: "100%",
        duration: 0.1
    }).to(panel, {
        duration: 2
    }).to(panel, {
        opacity: "0",
        duration: 1
    });
    tl.eventCallback("onComplete", function() {
        panel.style.display='none';
      });
}

//displays the help
function helpPanel() {
    shortDisplay(document.getElementById("help-panel"));
}

//displays an alert for the user at the bottom of the screen
function userAlert(text) {
    document.getElementById("text-alert").innerHTML = text;
    shortDisplay(document.getElementById("text-alert-box"));
}



function nextPreviousArrows() {


}



//update the page number in the corner
function updatePageNumber() {
    document.getElementById("page-count-enumerator").innerHTML = curEvent.pageNumber;
    document.getElementById("page-count-denominator").innerHTML = " / " + numberOfPages;

    // the "previous" arrow should be invisible at the first event of the first slide
    // analogously for the "next" arrow
    if (curEvent == eventTree.children[0])
        document.getElementById("prev-event").style.visibility = "hidden";
    else
        document.getElementById("prev-event").style.visibility = "visible";

    if (curEvent == eventTree.children.top())
        document.getElementById("next-event").style.visibility = "hidden";
    else
        document.getElementById("next-event").style.visibility = "visible";
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


function nextButton() {
    if (soundState != "record")
        soundStop();
    changeEvent(1);
}

function prevButton() {
    soundStop();
    changeEvent(-1);
}

function keyListener(event) {
    if (event.keyCode == '190') {
        // >
        playbackRateChange(0.2);
    }

    if (event.keyCode == '188') {
        // <
        playbackRateChange(-0.2);

    }

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
        {
            soundStop();
            soundRecord();
        }
    }
}

/*
// I don't know why this does not work
function scrollListener(event){
    console.log('scroll');
}
document.addEventListener('scroll', scrollListener );
*/
document.addEventListener("keydown", keyListener);

function slideDirectory(name) {
    return manifest.slideDict[name]
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




function getPathFromURL(pathstring) {
    var path = [];
    try {
        const pathstring = (new URL(window.location.href)).searchParams.get('path').split('/');
        while (pathstring.length > 0) {
            let index = pathstring.pop();
            if (index != '')
                path.push(parseInt(index));
        }
        return path;

    } catch (e) {
        return [0]; // default path is the first event of the root
    }
}


helpPanel();

//startup code
//it reads the manifest, which contains the root slide, the number of slides, the sounds, and then it loads the first slide
window.onload = function () {
    fetchJSON('slides/presentations.json')
        .then(j => {
            if (j == null)
                throw "The manifest is missing for all presentations"

            let url = new URL(window.location.href);
            presentationName = url.searchParams.get('slides');
            document.title = presentationName;
            presentationDir = j[presentationName];
            return fetchJSON(fileName(null, 'manifest.json'))
        }).then(j => {
            if (j == null)
                throw "The manifest is missing for the presentation"

            manifest = j;

            const path = getPathFromURL();


            createEventTree().then(x => {
                curEvent = eventTree;
                gotoPath(path)
                // loadSVG(eventTree);
                // updatePageNumber();
            });
        }).catch((e) => userAlert(e))
}
