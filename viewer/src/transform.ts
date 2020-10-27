
//apply transform t to rectangle rect (first scale, then shift)
export function applyTransform(t, rect) {
    return {
    x : rect.x * t.scalex + t.deltax,
    y : rect.y * t.scaley + t.deltay,
    width : rect.width * t.scalex,
    height : rect.height * t.scaley}
}

// the input is two rectangles, with equal proportions
// the output is a transform that maps source to target    
export function getTransform(source, target) {
    
    const scalex = target.width / source.width;
    const scaley = target.height / source.height;
    return {
        scalex : scalex,
        scaley : scaley,
        deltax : target.x - source.x * scalex,
        deltay : target.y - source.y * scaley
    }
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
    var bounds = {
        width : firstrect.width.baseVal.value,
        height : firstrect.height.baseVal.value,
        x : 0,
        y : 0
    };
    if (firstrect.transform.baseVal.length > 0) {
        bounds.x = firstrect.transform.baseVal[0].matrix.e;
        bounds.y = firstrect.transform.baseVal[0].matrix.f;
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