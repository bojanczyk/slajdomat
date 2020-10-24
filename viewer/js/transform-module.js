
//apply transform t to rectangle rect (first scale, then shift)
export function applyTransform(t, rect) {
    const retval = {};
    retval.x = rect.x * t.scalex + t.deltax;
    retval.y = rect.y * t.scaley + t.deltay;
    retval.width = rect.width * t.scalex;
    retval.height = rect.height * t.scaley;
    return retval;
}

// the input is two rectangles, with equal proportions
// the output is a transform that maps source to target    
export function getTransform(source, target) {
    var retval = {};
    retval.scalex = target.width / source.width;
    retval.scaley = target.height / source.height;
    retval.deltax = target.x - source.x * retval.scalex;
    retval.deltay = target.y - source.y * retval.scaley;
    return retval;
}

//creates a string for a transformation, to be used by gsap
export function transformToString(t) {
    return "translate(" + t.deltax + " " + t.deltay + ") scale(" + t.scalex + " " + t.scaley + ")";
}

// get the viewport for a node in the slide tree
function getViewPort(node) {
    return applyTransform(node.transform, node.localRect);
}

//the identity transformation
export function idTransform() {
    return {
        scalex: 1,
        scaley: 1,
        deltax: 0,
        deltay: 0
    };
}

//get the bounding rect for a slide
//deletes the background rectangle as a side effect
export function getBoundRect(svg) {
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
export function zoomSlide(node, duration = 1.5) {
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