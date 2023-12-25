export { exportSlides }

import {
    Database,
} from './plugin-types'

import {
    SlideEvent, ZoomEvent
} from '../viewer/types'

import {
    findEventObject,
    loadCurrentData,
    saveCurrentData,
    findSlide,
    sendToUI,
    state,
    allTexts,
    getRoot,
    deleteHoverFrames
} from './code'


//deduplicate a list of strings
function deDuplicate(list : string[]) : string[] {
    const retval = [] as string[];
    for (const string of list)
        if (!retval.includes(string))
            retval.push(string);
    return retval;
}

//complies a list of search keywords for the current slide
function compileKeywords(event: ZoomEvent, frame: FrameNode) {
    
    
    const done = [] as SceneNode[]; 
    
    for (const child of event.children) {
        //we only create keywords for show children, which are first
        if (child.type == 'show') {
            const node = findEventObject(child, frame);
            if (!done.includes(node)) {                
                done.push(node);
                child.keywords = allTexts(node);
                child.keywords.push(child.name);
                child.keywords = deDuplicate(child.keywords);
            }
        }
    }
    //the keywords for the slide itself is all other keywords that were not included above
    event.keywords = allTexts(frame, done);
    event.keywords.push(event.name); 
    event.keywords = deDuplicate(event.keywords);
}


//send the svg file to the ui, which then sends it to the server
function exportSlides(): void {
    
    //in case there are some straggler blue frames, delete them
    deleteHoverFrames();
    
    //the list of slides and their svg files
    const slideList: {
        database: Database,
        svg: Uint8Array
    }[] = [];
    
    //stack of the recursion, to find cycles in slides
    const stack: FrameNode[] = [];
    
    //Saves a single slide, and then calls itself for the children of that slide. The result of saving is a new item on slideList.
    async function saveRec(slide: FrameNode, eventId : string): Promise<SlideEvent> {
        if (stack.includes(slide)) {
            let cycle = "The slides contain a cycle: \n";
            for (const n of stack)
                cycle += (n.name + "\n");
            figma.notify(cycle + slide.name);
            return null;
        } else {
            stack.push(slide);
            loadCurrentData(slide);
            
            
            
            //We temporarily change the names of the children to their id's, so that the svg will have them as id's. (This is because Figma's svg export uses the object's name as the id for the svg. )
            //the function returns a list of pairs (node, old name) that can be used to revert these changes
            const changes: {
                node: SceneNode,
                savedName: string
            }[] = [];
            for (const event of state.database.events) {
                const node = findEventObject(event, slide);
                if (node != null) {
                    //we store the changes in reverse order,  so that the original names are at the end of the change list 
                    changes.unshift({ //unshift instead of push makes the order reversed
                        node: node,
                        savedName: node.name
                    });
                    node.name = event.id;
                }
            }
            
            const svg = await slide.exportAsync({
                format: 'SVG',
                svgOutlineText: true,
                svgIdAttribute: true
            });
            
            //we now undo the name changes. This needs to be done in reverse order to recover the original names
            for (const change of changes) {
                change.node.name = change.savedName;
            }
            
            const retval : ZoomEvent  = {
                type: 'child',
                name: state.database.name,
                id: state.database.id,
                merged: false,
                children: [],
                keywords: [],
                eventId : eventId
            };
            saveCurrentData();
            slideList.push({
                database: state.database,
                svg: svg
            });
            for (const event of state.database.events) {
                if (!event.disabled) {
                    if (event.type == "child") {
                        const child = await saveRec(findSlide(event.id), event.eventId);
                        child.merged = event.merged;
                        retval.children.push(child);
                    } else {
                        event.keywords = [event.name];
                        retval.children.push(event);
                    }
                }
                
            }
            loadCurrentData(stack.pop());
            compileKeywords(retval, state.currentSlide);
            
            return retval;
        }
    }
    
    
    
    const savedSlide = state.currentSlide;
    const rootSlide = getRoot();
    console.log(rootSlide);
    if (rootSlide != null) {
        saveRec(getRoot(),'root').then(x => {
            sendToUI({
                type: 'savePresentation',
                name: figma.root.name,
                slideList: slideList,
                tree: x
            });
            loadCurrentData(savedSlide);
        });
    }    
    
}
