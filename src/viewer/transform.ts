


export {
    applyTransform,
    getTransform,
    transformToString,
    idTransform,
    getBoundRect,
    Transform,
    Rect
}

type Rect = {
    x : number,
    y : number,
    width : number,
    height : number
}

type Transform = {
    scalex : number,
    scaley : number,
    deltax : number,
    deltay : number
}

//apply transform t to rectangle rect (first scale, then shift)
function applyTransform(t : Transform, rect : Rect) : Rect {
    return {
    x : rect.x * t.scalex + t.deltax,
    y : rect.y * t.scaley + t.deltay,
    width : rect.width * t.scalex,
    height : rect.height * t.scaley}
}

// the input is two rectangles, with equal proportions
// the output is a transform that maps source to target    
function getTransform(source : Rect, target : Rect) : Transform {
    
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
function transformToString(t : Transform) : string {
    return "translate(" + t.deltax + " " + t.deltay + ") scale(" + t.scalex + " " + t.scaley + ")";
}


//the identity transformation
function idTransform() : Transform {
    return {
        scalex: 1,
        scaley: 1,
        deltax: 0,
        deltay: 0
    };
}

//get the bounding rect for a slide
//deletes the background rectangle as a side effect
function getBoundRect(svg : SVGElement) : Rect {
    const firstRect = svg.firstElementChild as SVGRectElement;    
    const bounds = {
        width : (firstRect.width as SVGAnimatedLength).baseVal.value,
        height : (firstRect.height as SVGAnimatedLength).baseVal.value,
        x : 0,
        y : 0
    };
    const transform = firstRect.transform.baseVal as unknown as  SVGTransform[];
    if (transform.length > 0) {
        bounds.x = transform[0].matrix.e;
        bounds.y = transform[0].matrix.f;
    }
    firstRect.remove();
    return bounds;
}

