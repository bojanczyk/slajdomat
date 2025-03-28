export {
    AnimateEvent, AnimationParams, Database, Frame, Manifest, OverlayEvent, PresentationNode, ShowHideEvent, Slide, SoundDict, State,
    StateJSON, TimelineJSON, VersionList
}

//the central type, which describes an event of the presentation
type PresentationNode = OverlayEvent | Slide

interface GenericEvent {
    //for overlays, the id describes the object that is being shown, hidden etc., for slide events this is the ide of the target slide. 
    id: string,
    
    //a human readable name, taken from figma
    name: string,
    
    //is the event merged with the previous event. Merged events should either both be overlays, or both zooms
    merged: boolean,
    
    //disabled is used in the plugin, for events where the corresponding object is temporarily unavailable
    enabled: 'disabled' | 'enabled',
    
    //keywords for searching slides
    keywords: string[],

    //an id of the event itself, which should be unique inside the slide. The point of this id is so that we can associate sounds to an event.
    eventId: string,

    //the parent of the event. This is defined only on the viewer side, because it gets lost in the conversion to json
    parent?: Slide

}

//an event that shows or hides an overlay
interface ShowHideEvent extends GenericEvent {
    type: 'show' | 'hide'
}

type AnimationParams = {
    opacity? : number,
    x? : number,
    y? : number,
}

//an event that animates an overlay, by moving it to a new position
//the coordinates are relative to the containing slide
interface AnimateEvent extends GenericEvent {
    type: 'animate', 
    params : AnimationParams
}



type OverlayEvent =  AnimateEvent | ShowHideEvent

interface Slide extends GenericEvent {
    type: 'child',
    children: PresentationNode[],
    originalParams : { [id: string]: AnimationParams }
}


//the structure which describes a slide inside the plugin
type Database = {
    name: string,
    id: string,
    selected : number,  //this is the index of the currently selected event, which is undefined if no event is selected
    events: PresentationNode[],
    originalParams : { [id: string]: AnimationParams }
  }



//a state of the presentation is either just after entering a new slide (start), or just after executing some child event (afterEvent) 
type State = {
    type: 'start',
    slide: Slide
} | {
    type: 'afterEvent',
    event: PresentationNode
}

// a timeline is a list of states, each with a duration and a sound file
type Frame = {
    state : State,
    soundFile : string,
    soundDuration : number,
    audio : HTMLAudioElement,
    previousDuration : number
}


// a json represetnation of a state
type StateJSON =
    {
        type: 'start',
        slideId: string,
    } | {
        type: 'afterEvent',
        slideId: string,
        eventId: string
    }

type TimelineJSON = {
    state : StateJSON,
    soundFile : string,
    soundDuration : number
}[]        

// a json representation of a live recording
type ChronicleRecordingJSON = {
    name: string,
    date: string,
    states: { state: StateJSON, duration: number, audio: string }[],
}

type SoundDict = {
    key: StateJSON,
    duration: number,
    fileName: string
}[]

//this is the type of the file with the slide information
interface Manifest {
    version: number,
    presentation: string,
    slideDict: {
        [id: string]: string
    },
    treeTimeLine: TimelineJSON,
    chronicleTimeLine : TimelineJSON,
    tree: Slide,
    pdfFile?: string,
    comments?:
    {
        server: string,
        presentation: string
    }
}


type VersionList = {viewerVersion : string, requiresAppVersion : string} []