export { freshName, sanitize, freshRect }

//gives a name, starting with base, which is not on the avoid list
function freshName(base: string, avoid: string[]): string {
    let candidate = base;
    if (avoid.indexOf(candidate) > -1) {
        //we need to decorate the name;
        let index = 2;

        do {
            candidate = base + index.toString();
            index++;
        } while (avoid.indexOf(candidate) > -1)

    }

    return candidate;
}


//finds a place for the new slide, by searching in a spiral around the current slide (or the origin, if there is no current slide)
function freshRect(initial : {width: number, height: number, x : number, y : number}, avoidList: FrameNode[]): Rect {

    console.log('initial', initial);
    console.log('avoid list', avoidList);

    for (const avoid of avoidList){
        console.log(avoid.x,avoid.y,avoid.width, avoid.height);
    }
    //does rectangle a intersect any frame
    function intersectsNothing(a: Rect) {
        function intersects(a: Rect, b: FrameNode) {
            if (a.x > b.x + b.width || a.x + a.width < b.x)
                return false;
            if (a.y > b.y + b.height || a.y + a.height < b.y)
                return false;
            return true;
        }
        for (const b of avoidList)
            if (intersects(a, b))
                return false;
        return true;
    }

    const candidate = initial;

    //search for free space below the current slide,
    //using the city metric (i.e. the search follows a square spiral pattern)
    let i = 0;
    let searching = true;
    const xoffset = initial.width * 1.1;
    const yoffset = initial.height * 1.1;

    while (searching) {
        i++;
        for (let j = 0; j <= i && searching; j++) {
            candidate.x = initial.x + j * xoffset;
            candidate.y = initial.y + i * yoffset;
            if (intersectsNothing(candidate)) {
                searching = false;
                break;
            }
            candidate.x = initial.x + i * xoffset;
            candidate.y = initial.y + j * yoffset;
            if (intersectsNothing(candidate)) {
                searching = false;
                break;
            }
            candidate.x = initial.x - j * xoffset;
            candidate.y = initial.y + i * yoffset;
            if (intersectsNothing(candidate)) {
                searching = false;
                break;
            }
            candidate.x = initial.x - i * xoffset;
            candidate.y = initial.y + j * yoffset;
            if (intersectsNothing(candidate))
                searching = false;
        }
    }
    return candidate;
}



//sanitize a string so that it is a good filename 
function sanitize(s: string): string {
    return encodeURI(s).replace(/:/g, "_").replace(/%20/g, '_').replace(/%/g, '_');
}
