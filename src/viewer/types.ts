import { Database } from "../plugin/plugin-types"
import { Step } from "./timeline"


export {
    SlideEvent,
    OverlayEvent,
    ZoomEvent,
    Manifest,
    MessageToServer,
    MessageToServerSound,
    MessageToServerSlide,
    MessageToServerLive,
    LiveRecording,
    ServerResponse
}

//the central type, which describes an event of the presentation
type SlideEvent = OverlayEvent | ZoomEvent

interface GenericEvent {
    //for overlays, the id describes the object that is being shown, hidden etc., for child events this is the ide of the target slide
    id: string, 
    //a human readable name, taken from figma
    name: string,
    //is the event merged with the previous event. Merged events should either both be overlays, or both zooms
    merged: boolean,
    //disabled is used in the plugin, for events where the corresponding object is temporarily unavailable
    disabled?: boolean,
    //keywords for searching slides
    keywords: string[],
    //an id of the event itself, which should be unique inside the slide. The point of this id is so that we can associate sounds to an event.
    eventId : string
}
interface OverlayEvent extends GenericEvent {
    type: 'show' | 'hide'
}

interface ZoomEvent extends GenericEvent {
    type: 'child',
    children: SlideEvent[],
}



//this is the type of the file with the slide information
interface Manifest  {
    version: number,
    presentation: string,
    slideDict: {
        [id: string]: string
    },
    soundDict: {
        [slide: string]: {
            [eventId: string]: number 
        }
    },
    tree: ZoomEvent,
    live? : LiveRecording[]
}

interface LiveRecording {
    date : number,
    steps : {step : StepDescription, soundFile : string}[]
}

interface StepDescription {
    slide : string,
    event : string
}


type MessageToServerSound = {
    type: 'wav',
    presentation: string,
    slideId: string,
    eventId : string,
    file: number[],
    live : boolean
}

type MessageToServerSlide = {
    type: 'slides',
    presentation: string,
    tree: ZoomEvent,
    slideList: {
        database: Database,
        svg: string,
    }[]
}

type MessageToServerLive = {
    type : 'startLive',
    presentation : string
}

type MessageToServer = MessageToServerSound | MessageToServerSlide | MessageToServerLive
    |
{
    type: 'probe'
}

//the response sent by the server to the plugin and the sound part of the slides
type ServerResponse = {
    status: string,
    duration?: number // the duration of a recorded sound
}

