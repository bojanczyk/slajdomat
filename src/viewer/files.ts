export {
    pathInURL,
    presentationDir,
    fileName,
    sendToServer,
    fetchJSON
}

import {
    curEvent,
    getPath,
} from './event'

import {
    userAlert
} from './html'

import { MessageToServer } from './types';


import {
    manifest
} from './viewer'


function pathInURL() : void //puts the current path into the url
{
    const path = getPath(curEvent);
    let string = '';
    while (path.length > 0) {
        string += path.pop() + '/';
    }
    const presentationURL  = (new URL(window.location.href)).searchParams.get('slides');
    history.pushState({}, null, '?slides=' + encodeURI(presentationURL) + '&path=' + string);
}

//the directory where the slides are
function presentationDir() : string {
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
function sendToServer(msg: MessageToServer): Promise < Response > {
    if (msg.type == 'slides' || msg.type == 'wav')
        msg.presentation = manifest.presentation;
    const json = JSON.stringify(msg);
    return fetch(getServer(), {
        method: 'POST',
        body: json
    }).
    then(response => {
        if (!response.ok) {
            throw "not connected";
        } else return response;
    });
}


//get a json file and parse it
function fetchJSON(filename: string): Promise < unknown > {
    return fetch(filename).
    then(function (res) {
        if (!(res.ok))
            throw "not connected";
        else
            return res.json();
    }).
    catch((e) => {        
        userAlert("Could not load slide file " + filename);
        return null;
    });
}
