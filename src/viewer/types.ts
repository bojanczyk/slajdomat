import { Database } from "../plugin/plugin-types"




export {
    SlideEvent,
    OverlayEvent,
    ZoomEvent,
    Manifest,
    MessageToServer,
    MessageToServerSound,
    MessageToServerSlide,
    MessageToServerLive,
    MessageToServerPdf,
    LiveRecording,
    ServerResponse,
    EventDescription,
    StepDescription
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
    eventId: string,
    //the parent of the event. This is only written on the viewer side, because it gets lost in the conversion to json
    parent?: ZoomEvent

}
interface ShowHideEvent extends GenericEvent {
    type: 'show' | 'hide'
}

interface AnimateEvent extends GenericEvent {
    type: 'animate', source: number, target: number
}

type OverlayEvent = ShowHideEvent | AnimateEvent

interface ZoomEvent extends GenericEvent {
    type: 'child',
    children: SlideEvent[],
}



//this is the type of the file with the slide information
interface Manifest {
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
    live?: LiveRecording[],
    pdfFile?: string,
    comments?:
    {
        server: string,
        presentation: string
    }
}

interface LiveRecording {
    date: string,
    dir: string,
    steps: { step: StepDescription, duration: number }[]
}

type StepDescription = { type: 'zoom', page: number, source: string, target: string } | { type: 'overlays', page: number, slide: string, overlays: string[], direction: 1 | -1 } | { type: 'last', page: number }

type EventDescription = { type: 'event', slideId: string, eventId: string }

type MessageToServerSound = {
    type: 'wav',
    file: number[],
    presentation: string,
    forWhat: EventDescription | { type: 'step', description: StepDescription }
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
    type: 'startLive',
    presentation: string
}

type MessageToServerPdf = {
    type: 'toPdf',
    svg: string,
    width: number,
    height: number,
    presentation: string,
    index: number,
    maxindex: number
}

type MessageToServer = MessageToServerSound | MessageToServerSlide | MessageToServerLive | MessageToServerPdf
    |
{
    type: 'probe'
}

//the response sent by the server to the plugin and the sound part of the slides
type ServerResponse =
    {
        status: 'server working'
    } |
    {
        status: 'sound recorded',
        duration?: number // the duration of a recorded sound
    } |
    {
        status: 'pdf created'
    } |
    {
        status: 'slides received'
    } |
    {
        status: 'live recording started'
    } |
    {
        status: 'error',
        explanation: string
    }

