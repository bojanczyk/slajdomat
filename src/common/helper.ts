export { freshName, sanitize, freshRect, toAlphaNumeric, isLater, theHTMLFiles }



//these are the files in the resource directory that should be copied to each presentation
const theHTMLFiles = ['index.html', 'viewer.js', 'favicon.png', 'slajdomat-logo-blue.svg'];

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
function freshRect(x: number, y : number, width: number, height: number, avoidList: FrameNode[], dimensions: { width: number, height: number }): Rect {

    let insideFrame: Rect;
    //this is the frame that we should stay inside
    if (dimensions != undefined)
        insideFrame = { x: 0, y: 0, width: dimensions.width, height: dimensions.height };

    let initial = { x: x, y : y, width : width, height : height};

    function intersects(a: Rect, b: FrameNode | Rect) {
        if (b == undefined)
            return true;
        if (a.x > b.x + b.width || a.x + a.width < b.x)
            return false;
        if (a.y > b.y + b.height || a.y + a.height < b.y)
            return false;
        return true;
    }

    //search for free space below the current slide,
    //using the city metric (i.e. the search follows a square spiral pattern) 

    const xoffset = width * 1.1;
    const yoffset = height * 1.1;


    for (let i = 0; true; i++)
        for (let j = 0; j <= i; j++) {


            let candidates: Rect[] = [];

            candidates.push({ width: initial.width, height: initial.height, x: initial.x + j * xoffset, y: initial.y + i * yoffset });
            candidates.push({ width: initial.width, height: initial.height, x: initial.x + i * xoffset, y: initial.y + j * yoffset });
            candidates.push({ width: initial.width, height: initial.height, x: initial.x - j * xoffset, y: initial.y + i * yoffset });
            candidates.push({ width: initial.width, height: initial.height, x: initial.x - i * xoffset, y: initial.y + j * yoffset });

            let someFits = false;
            for (const candidate of candidates) {

                if (intersects(candidate, insideFrame)) {
                    someFits = true;

                    let intersectsAvoidList = false;
                    for (const avoid of avoidList) {
                        if (intersects(candidate, avoid))
                            intersectsAvoidList = true;
                    }
                    if (!intersectsAvoidList)
                        return candidate;
                }
            }

            if (!someFits)
                return initial;


        }

}


function toAlphaNumeric(s: string): string {
    return s.replace(/[^a-zA-Z0-9]/g, '_');
}

//sanitize a string so that it is a good filename 
function sanitize(s: string): string {
    const replaces = [
        [':', '_colon'],
        ['%20', '_'],
        ['%', '_percent'],
        ['*', '_star'],
        ['?', '_question']
    ];
    let retval = encodeURI(s);
    for (const replace of replaces)
        retval = retval.replace(replace[0], replace[1]);

    return retval;
}


function isLater(version1: string, version2: string): boolean {
    const v1 = version1.split('.').map(x => parseInt(x));
    const v2 = version2.split('.').map(x => parseInt(x));
    for (let i = 0; i < v1.length; i++) {
        if (v1[i] > v2[i])
            return true;
        if (v1[i] < v2[i])
            return false;
    }
    return true;
}
