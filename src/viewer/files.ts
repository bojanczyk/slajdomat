export {
    presentationDir,
    fileName,
    sendToServer,
    fetchJSON,
    probeServer
}



import {
    userAlert
} from './html'

import { MessageToServer, ServerResponse } from '../common/messages-viewer-server';

import {
    manifest
} from './viewer'
import { list, save } from 'pdfkit';



//the directory where the slides are
function presentationDir(): string {
    return '.'
    // return  'slides/' + (new URL(window.location.href)).searchParams.get('slides'); 
}


function getServer() {
    return 'http://localhost:3001';
}


//gives the name for a file in a slide, in the current presentation
//the slide parameter could be null, for top-level information in the presentation.
function fileName(slide: string, file: string): string {

    if (slide == null) {
        return presentationDir() + '/' + file;
    } else
        return presentationDir() + '/' + manifest.slideDict[slide] + '/' + file;
}

//send an object to the server
async function sendToServer(msg: MessageToServer): Promise<ServerResponse> {

    const json = JSON.stringify(msg);
    const response = await fetch(getServer(), {
        method: 'POST',
        body: json as any  //I cannot figure how to correctly type putting a stream into the body
    });
    if (!response.ok) {
        return { status : 'error', explanation : 'not connected' };
    } else
        {
           return await response.json() as ServerResponse;
        }
}




//get a json file and parse it
async function fetchJSON(filename: string): Promise<unknown> {
    try {
        const res = await fetch(filename);
        if (!(res.ok))
            throw "not connected";

        else
            return res.json();
    } catch (e) {
        userAlert("Could not load slide file " + filename);
        return null;
    }
}
 


async function probeServer() : Promise<boolean> {
    try {
        await fetch(getServer(), {
            method: 'POST',
            body: JSON.stringify({
                type: 'probe'
            })
        });
        return true;
    }
    catch (e) { return false; }
}