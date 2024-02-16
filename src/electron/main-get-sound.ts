/*
this code takes care of receiving sound from the viewer, and saving it to disk
*/

export { onGetWav, createLive }

import { Manifest,  StateJSON } from "../common/types";
import { MessageToServerLive, MessageToServerSound, ServerResponse } from "../common/messages-viewer-server";
import { dirList, presentationDir, readManifest, slideDir, writeManifest } from "./main-files";
import { slajdomatSettings } from "./main-settings";
import { sendStatus } from "./main";
import { freshName, sanitize } from "../common/helper";

import * as fs from 'fs';
import * as path from 'path';
import * as child from 'child_process';






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


//we get a single sound, in the wav format
function onGetWav(msg: MessageToServerSound): ServerResponse {
    let soundDescription: string;


    try {

        const manifest = readManifest(msg.presentation);
        const buffer = new Uint8Array(msg.file)
        const absolutePath = slideDir(manifest, msg.forWhat.slideId);
        
        let shortName: string;
        if (msg.forWhat.type == 'afterEvent')
        {
            shortName = 'after_'+sanitize(msg.forWhat.eventId);
            soundDescription = 'after event ' + msg.forWhat.eventId;
        }
        else
        {
            soundDescription = 'start of slide ' + msg.forWhat.slideId;
            shortName = 'start';
        }

        const absoluteFileName = path.join(absolutePath, shortName);
        const localFileName = path.relative(presentationDir(msg.presentation), absoluteFileName);
        




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




        // find the index of msg.forWhat in the sound list
        let index = manifest.defaultTimeLine.findIndex((sound) => {return sameStateJSON(sound.state, msg.forWhat)});

        if (index > -1) {
            manifest.defaultTimeLine.splice(index, 1);
        }


        manifest.defaultTimeLine.push({
            state: msg.forWhat,
            soundDuration: duration,
            soundFile:  localFileName + '.mp3'
        });



        writeManifest(manifest);
        sendStatus(`Recorded ${duration.toFixed(2)}s for ${soundDescription}`);

        retval.duration = duration;
        return retval;


    } catch (e) {
        sendStatus(`Failed to record sound for ${soundDescription}`);
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