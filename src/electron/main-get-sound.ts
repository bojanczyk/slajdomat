/*
this code takes care of receiving sound from the viewer, and saving it to disk
*/

export { createLive, onGetWav };

import { freshName, toAlphaNumeric } from "../common/helper";
import { MessageToServerLive, MessageToServerSound, ServerResponse } from "../common/messages-viewer-server";
import { StateJSON } from "../common/types";
import { sendStatus } from "./main";
import { presentationDir, readManifest, slideDir, writeManifest } from "./main-files";
import { slajdomatSettings } from "./main-settings";

import * as child from 'child_process';
import * as fs from 'fs';
import * as path from 'path';






function sameStateJSON(state1: StateJSON, state2: StateJSON): boolean {
    if (state1 == undefined || state2 == undefined)
        return false;
    if (state1.type != state2.type)
        return false;
    if (state1.type == 'start' && state2.type == 'start')
        return state1.slideId == state2.slideId;
    else if (state1.type == 'afterEvent' && state2.type == 'afterEvent')
        return state1.eventId == state2.eventId && state1.slideId == state2.slideId;
}

// returns a list of the mp3 files in the given path, without the mp3
function existingSoundNames(path: string): string[] {
    let retval: string[] = [];
    try {
        retval = fs.readdirSync(path).filter((name) => { return name.endsWith('.mp3') });
    }
    catch (e) {
        //do nothing
    }
    // remover the mp3 suffix
    retval = retval.map((name) => { return name.slice(0, -4) });
    return retval;
}


//we get a single sound, in the wav format
function onGetWav(msg: MessageToServerSound): ServerResponse {

    // the description of the sound, for the status and error messages
    let textDescribingSound: string;
    if (msg.forWhat.type == 'afterEvent') {
        textDescribingSound = 'after event ' + msg.forWhat.eventId;
    }
    else {
        textDescribingSound = 'start of slide ' + msg.forWhat.slideId;
    }


    try {

        const manifest = readManifest(msg.presentation);
        const buffer = new Uint8Array(msg.file)
        const absolutePath = slideDir(manifest, msg.forWhat.slideId);


        // the local name is relative to the presentation directory
        let localFileName: string;
        let absoluteFileName: string;



        // find the index of msg.forWhat in the sound list
        let index = manifest.dfsTimeLine.findIndex((sound) => { return sameStateJSON(sound.state, msg.forWhat) });

        if (msg.live == 'dfs' && index > -1) {
            // the sound is already there, and we are recording the default timeline, then we will replace the sound
            localFileName  = manifest.dfsTimeLine[index].soundFile;
            localFileName = localFileName.slice(0, -4);
            manifest.dfsTimeLine.splice(index, 1);
            absoluteFileName = path.join(presentationDir(msg.presentation), localFileName);
            console.log('absoluteFileName', absoluteFileName);
        }
        else 
        {
            // otherwise, we are recording a live sound, or the sound is not there in the default timeline, then  we need to generate a new sound name
            let shortName: string;
            if (msg.forWhat.type == 'afterEvent') {
                shortName = 'after_' + toAlphaNumeric(msg.forWhat.eventId);
            }
            else {
                shortName = 'start';
            }
    
            shortName = freshName(shortName, existingSoundNames(absolutePath));
            absoluteFileName = path.join(absolutePath, shortName);
            localFileName = path.relative(presentationDir(msg.presentation), absoluteFileName);
        }


        fs.writeFileSync(absoluteFileName + '.wav', Buffer.from(buffer));


        let ffmpeg = slajdomatSettings.ffmpeg;
        if (ffmpeg == '') ffmpeg = 'ffmpeg';
        let ffprobe = slajdomatSettings.ffprobe;
        if (ffprobe == '') ffprobe = 'ffprobe';


        const retval: ServerResponse = {
            status: 'sound recorded'
        };


        try {
            const ffmpegString = `${slajdomatSettings.ffmpeg} -y -i  "${absoluteFileName}.wav" "${absoluteFileName}.mp3"`;
            child.execSync(ffmpegString);
        }
        catch (e) { throw 'Failed to run ffmpeg for ' + absoluteFileName }

        fs.unlinkSync(absoluteFileName + '.wav');


        let duration: number = undefined;
        try {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const probeString = child.execSync(`${slajdomatSettings.ffprobe} -hide_banner -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${absoluteFileName}.mp3"`);
            duration = parseFloat(probeString.toString());
        } catch (e) { throw 'Failed to run ffprobe' }


        const soundDesc = {
            state: msg.forWhat,
            soundDuration: duration,
            soundFile: localFileName + '.mp3'
        };

        // add the sound the description to the appropriate part of the manifest
        if (msg.live == 'dfs')
            manifest.dfsTimeLine.push(soundDesc);
        else
            manifest.liveTimeLine.push(soundDesc);


        writeManifest(manifest);
        sendStatus(`Recorded ${duration.toFixed(2)}s for ${textDescribingSound}`);

        retval.duration = duration;
        return retval;


    } catch (e) {
        sendStatus(`Failed to record sound for ${textDescribingSound}`);
        sendStatus('Error: ' + e);
        return {
            status: e
        };
    }

}





//start a live recording. The result is adding a new array of live steps to the manifest.
function createLive(msg: MessageToServerLive): ServerResponse {
    throw 'not implemented';
}
/*
try {
    sendStatus('going live')
    const manifest: Manifest = readManifest(msg.presentation);
    if (manifest.live == undefined)
        manifest.live = [];


    //create a directory for the liver recording
    const dir = freshName(`live_recording${manifest.live.length}`, dirList(presentationDir(msg.presentation)));
    fs.mkdirSync(path.join(presentationDir(msg.presentation), dir));


    manifest.live.push(
        {
            date: (new Date()).toString(),
            dir: dir,
            steps: []
        });

    sendStatus('has been pushed')

    writeManifest(manifest)
    return {
        status: 'live recording started'
    };
}
catch (e) {
    sendStatus(e)
    return {
        status: 'error',
        explanation: e
    };
}


}
*/