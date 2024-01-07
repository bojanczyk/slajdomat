/*
the code for managing the settings in the main process
*/


export {
    SlajdomatSettings, assignSettings, loadSettings, myStringify, saveSettings, slajdomatSettings, checkIfCommentServerWorks
};

import { PresentationList, findExecutableInPath, writeFile } from "./main-files";

import { app } from "electron";
import * as fs from 'fs';
import * as path from 'path';
import { Manifest } from "../viewer/types";
import { sendMessageToRenderer, sendStatus } from "./main";
import { restartServer } from "./main-server";


type SlajdomatSettings = {
    port: number,
    directory?: string,
    ffmpeg: string,
    ffprobe: string,
    comments : boolean,
    commentServer : string
}

let slajdomatSettings: SlajdomatSettings;

function loadSettings() {

    try {
        const fileName = path.join(app.getPath('userData'), 'settings.json');
        const data = fs.readFileSync(fileName).toString();
        slajdomatSettings = JSON.parse(data) as SlajdomatSettings;
    }
    catch (err) {
        // this should be called when there are no settings, i.e. the app is loaded for the first time


        slajdomatSettings = {
            ffmpeg: findExecutableInPath('ffmpeg'),
            ffprobe: findExecutableInPath('ffprobe'),
            port: 3001,
            comments : false,
            commentServer : undefined
        }
    }

    sendMessageToRenderer({ type: 'settings', settings: slajdomatSettings });
}


//our choice parameters for stringify
function myStringify(x: PresentationList | Manifest | SlajdomatSettings): string {
    return JSON.stringify(x, null, 2)
}


function saveSettings(): void {
    const fileName = path.join(app.getPath('userData'), 'settings.json')
    writeFile(fileName, myStringify(slajdomatSettings));
}

//I use this function, because the variable slajdomatSettings is read-only outside this module
function assignSettings(arg: SlajdomatSettings): void {

    //the directory is not sent, so we keep its old value
    arg.directory = slajdomatSettings.directory;

    if (slajdomatSettings.port != arg.port) {
        //the port has been changed, so we restart the server
       restartServer();
    }
    slajdomatSettings = arg;
    saveSettings();
    sendStatus('Saved settings', 'quick')
}

async function checkIfCommentServerWorks(url : string) {
    let script = url;
    script += '&type=probe';
    try {
        const response = await fetch(script);
        sendStatus('success '+ response.text(), 'quick');
    }
    catch (e) {
        sendStatus('error '+ e, 'quick');
    }
}