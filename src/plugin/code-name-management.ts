import { freshName, toAlphaNumeric } from "../common/helper";
import { allSlides, getDatabase, state } from "./code";
import { canBeOverlayTarget } from "./code-overlay-events";

/* code for managing names and id's in the plugin backend */
export { allTexts, avoidList, findSlide, goodName, newEventId, overlayId, slideId };


//find a slide in the document with the given id
function findSlide(id: string): FrameNode {
    for (const node of allSlides())
        if (slideId(node) == id)
            return node;
    return null;
}

//returns a unique id for an event, inside the current slide
function newEventId(): string {

    //the id is a number (stored as a string). In order to achieve uniqueness, we store the maximal id used so far inside the attribute eventId.
    let retval: number;
    const maxId = state.currentSlide.getPluginData('eventId');
    if (maxId == '')
        retval = 1;
    else
        retval = parseInt(maxId) + 1;
    state.currentSlide.setPluginData('eventId', retval.toString());
    return retval.toString();
}


//give the list of all texts used in descendants
//this function is used in goodName below, and also to export keywords
function allTexts(n: SceneNode, avoid: SceneNode[] = []): string[] {

    if (avoid.includes(n))
        return [];

    if (n.type == 'TEXT') {
        return [n.name];
    }
    if (n.type == 'GROUP' || n.type == 'FRAME') {
        let retval: string[] = [];
        for (const child of n.children) {
            retval = retval.concat(allTexts(child as SceneNode, avoid))
        }
        return retval;
    }
    //otherwise there are no strings
    return [];
}


//Creates a descriptive string name for a node. It will be called if the node is a group node with a name like "Group 2". The current implementation returns the contents the longest text node in the descendants. 
function goodName(node: SceneNode): string {
    const texts = allTexts(node);

    //if there is no text, do not change the name
    if (texts.length == 0)
        return node.name;

    //otherwise, return the longest text    
    let retval = texts[0];
    for (const text of texts) {
        if (text.length > retval.length)
            retval = text;
    }
    return retval
}



// I use my own id's, instead of those of figma, so that copy and paste between presentations works
//the id for a slide is stored in its database
function slideId(slide: FrameNode): string {
    const database = getDatabase(slide);
    if (database != undefined)
        return database.id;
    else
        return undefined;
}




//list of id's to avoid when creating a new id in a slide
/*If the argument is defined, then we are generating an id for an event inside slideWithEvent. If it is undefined then we are generating an id for slide. The conflicts to be avoided are: 1. two id's in the same slide; 2. an event id with a slide id anywhere; 3. two slide id's. */
function avoidList(slideWithEvent: FrameNode): string[] {

    const avoid: string[] = [];

    //we definitely want to avoid conflicts with all slide id's
    for (const slide of allSlides())
        avoid.push(slideId(slide));

    //we want to avoid avoid conflicts with event id's in the list slides, which is either a singleton [slideWithEvent] if we are generating an id for an event inside slideEvent, or otherwise all slides.
    let slides: FrameNode[] = [];
    if (slideWithEvent != undefined)
        slides.push(slideWithEvent);
    else
        slides = allSlides();

    for (const slide of slides)
        for (const child of slide.children)
            avoid.push(child.getPluginData('id'));


    return avoid;
}



//returns an id for an overlay, creating a new one if necessary, and fixing the old one if necessary
// the output is always defined, since a new id is created if necessary
function overlayId(node: SceneNode): string {



    if (!canBeOverlayTarget(node))
        return undefined;

    let retval = node.getPluginData('id');
    const slide = node.parent as FrameNode;

    if (retval != '') {
        //check if the proposed id is already present in the current slide. This can happen if a node is copied by the user, then the plugin data is also copied, which includes the id, thus leading to duplicate id's 

        //tells us if node x is older than node y
        function olderNode(x: SceneNode, y: SceneNode): boolean {
            //figma id's store a number, such as 12:35, where 12 identifies the frame, and 35 identifies the child. In this case, the value of 12 is fixed, so we compare the value of 35, which grows as the objects get newer. 

            if (x.id.length == y.id.length)
                return (x.id < y.id);
            else
                return (x.id.length < y.id.length)
        }


        for (const other of slide.children) {
            if ((olderNode(other, node)) && (other.getPluginData('id') == retval)) {
                retval = '';
            }
        }

    }

    if (retval == '') {
        //generate a new id, because the id is empty. It could be empty because of the above deduplication code.

        retval = freshName(toAlphaNumeric(node.name), avoidList(slide));
        //save the name in the node
        node.setPluginData('id', retval);
    }
    return retval;
}
