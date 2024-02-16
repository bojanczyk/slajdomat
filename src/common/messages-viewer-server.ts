/* messages between the slide viewer and the electron server */


export type { MessageToServer, ServerResponse, MessageToServerSound, MessageToServerSlide, MessageToServerLive, MessageToServerPdf}

import e from "cors"
import { Database, Slide, StateJSON } from "./types"

//the message sent by the plugin to the server to record a new sound
type MessageToServerSound = {
    type: 'wav',
    file: number[],
    presentation: string,
    forWhat: StateJSON
    // forWhat: EventDescription | { type: 'step', description: StepDescription }
}

type MessageToServerSlide = {
    type: 'slides',
    presentation: string,
    tree: Slide,
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

