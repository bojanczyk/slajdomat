export {onGetWav, createLive}

import { LiveRecording, Manifest, MessageToServerLive, MessageToServerSound, ServerResponse } from "../viewer/types";
import { dirList, presentationDir, readManifest, slideDir, writeManifest } from "./main-files";
import { slajdomatSettings } from "./main-settings";
import { sendStatus } from "./main";
import { freshName } from "../common/helper";

import * as fs from 'fs';
import * as path from 'path';
import * as child from 'child_process';





//we get a single sound, in the wav format
function onGetWav(msg: MessageToServerSound): ServerResponse {
    let soundDescription: string;


    try {

        const manifest = readManifest(msg.presentation);
        const buffer = new Uint8Array(msg.file)
        let fileName: string;
        let live: LiveRecording;

        if (msg.forWhat.type != 'event') {
            live = manifest.live[manifest.live.length - 1];
            fileName = `${presentationDir(msg.presentation)}/${live.dir}/${live.steps.length}`;
            soundDescription = ` current step in the live recording`;
        }
        else {
            fileName = path.join(slideDir(manifest, msg.forWhat.slideId), msg.forWhat.eventId);
            soundDescription = `for event ${msg.forWhat.eventId} in slide ${manifest.slideDict[msg.forWhat.slideId]}`;
        }

        fs.writeFileSync(fileName + '.wav', Buffer.from(buffer));


        let ffmpeg = slajdomatSettings.ffmpeg;
        if (ffmpeg == '') ffmpeg = 'ffmpeg';
        let ffprobe = slajdomatSettings.ffprobe;
        if (ffprobe == '') ffprobe = 'ffprobe';


        const retval: ServerResponse = {
            status: 'sound recorded'
        };


        try {
            child.execSync(`${slajdomatSettings.ffmpeg} -y -i  ${fileName}.wav ${fileName}.mp3`);
        }
        catch (e) { throw 'Failed to run ffmpeg' }



        fs.unlinkSync(fileName + '.wav');


        let duration: number = undefined;
        try {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const probeString = child.execSync(`${slajdomatSettings.ffprobe} -hide_banner -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ${fileName}.mp3`);
            duration = parseFloat(probeString.toString());
        } catch (e) { throw 'Failed to run ffprobe' }



        if (msg.forWhat.type != 'event') {
            //if we are in live mode, then we push the sound onto the list of live steps
            live.steps.push({
                step: msg.forWhat.description,
                duration: duration
            })
        } else {
            //otherwise, we file the sound in the sound dictionary. 
            if (!(msg.forWhat.slideId in manifest.soundDict)) {
                manifest.soundDict[msg.forWhat.slideId] = {};
            }
            manifest.soundDict[msg.forWhat.slideId][msg.forWhat.eventId] = duration;
        }

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