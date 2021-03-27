import { Database } from "../plugin/plugin-types"

export {
    SlideEvent,
    SoundState,
    Manifest,
    MessageToServer,
    MessageToServerSound,
    ServerResponse
}

//the central type, which describes an event of the presentation
type SlideEvent = {
    type: string,
    id: string,
    name: string,
    children: SlideEvent[],
    merged: boolean,
    disabled? : boolean,
    keywords : string[]
}

//this is the type of the file with the slide information
type Manifest = {
    version : number,
    presentation: string,
    slideDict: {
        [id: string]: string
    },
    soundDict: {
        [slide: string]: {
            [index: number]: {
                file: string,
                duration ? : number
            }
        }
    },  
    tree: SlideEvent
}

enum SoundState {
    Record = "Record",
        Play = "Play",
        Pause = "Pause",
        None = "Right"
}

type MessageToServerSound = {
    type : 'wav',
    presentation : string,
    slideId : string,
    index : number,
    name : string,
    file : number[]
}


type MessageToServer =  MessageToServerSound |
 {
    type : 'slides',
    presentation : string,
    tree : SlideEvent,
    slideList : {
        database : Database,
        svg : string,
    }[],
    keywords : {[slide :string] : string[]}
} |
{
    type : 'probe'
}

//the response sent by the server to the plugin and the sound part of the slides
type ServerResponse = {
    status : string, 
    duration? : number // the duration of a recorded sound
}

